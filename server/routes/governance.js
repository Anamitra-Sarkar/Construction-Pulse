const express = require('express');
const router = express.Router();

const admin = require('../config/firebase');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const SystemSettings = require('../models/SystemSettings');

const ADMIN_RECOVERY_TOKEN = process.env.ADMIN_RECOVERY_TOKEN || null;

/* ================================================================
   BOOTSTRAP LOCK CONSTANT
   This _id is used as a singleton document key in SystemSettings.
   ================================================================ */
const BOOTSTRAP_DOC_ID = 'bootstrap';

/* ---------------- HELPERS ---------------- */

const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0] ||
  req.socket?.remoteAddress ||
  'unknown';

const logGovernanceAction = async (action, details, ip, userId = null) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      resource: 'GOVERNANCE',
      details,
      ip,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
};

/**
 * Checks the SystemSettings collection for the bootstrap lock document.
 * Returns the document if it exists and bootstrapped === true, otherwise null.
 *
 * WHY: MongoDB is the single source of truth for bootstrap state.
 * Firebase Auth user existence alone must never determine this.
 */
const isSystemBootstrapped = async () => {
  const doc = await SystemSettings.findById(BOOTSTRAP_DOC_ID).lean();
  return doc && doc.bootstrapped === true ? doc : null;
};

/**
 * Resolves a Firebase Auth user by email.
 * - If the user already exists, reuses them (idempotent).
 * - If not found, creates a new user.
 * - NEVER blindly calls createUser (avoids auth/email-already-exists).
 *
 * WHY: Partial failures (Firebase created, MongoDB not) must be
 * recoverable by simply retrying bootstrap without manual cleanup.
 */
const resolveFirebaseUser = async (email, password, name) => {
  try {
    // Attempt to find existing Firebase user by email
    const existingUser = await admin.auth().getUserByEmail(email);
    return { user: existingUser, created: false };
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // User does not exist — safe to create
      const newUser = await admin.auth().createUser({
        email,
        password,
        displayName: name,
      });
      return { user: newUser, created: true };
    }
    // Re-throw unexpected errors (e.g. network issues)
    throw err;
  }
};

/* ================================================================
   ROUTES
   ================================================================ */

/**
 * GET /api/governance/status
 *
 * Used by frontend to decide whether to show the bootstrap UI.
 * Reads from the SystemSettings bootstrap lock document.
 *
 * Response:
 *   { bootstrapped: true/false, initialized: true/false }
 *
 * The `initialized` field is kept for backward compatibility
 * with the existing frontend.
 */
router.get('/status', async (req, res) => {
  try {
    const bootstrapDoc = await isSystemBootstrapped();
    const bootstrapped = !!bootstrapDoc;

    return res.json({
      bootstrapped,
      // Backward compatibility: frontend may check `initialized`
      initialized: bootstrapped,
    });
  } catch (err) {
    console.error('Governance status error:', err);
    return res.status(500).json({ message: 'Governance status failed' });
  }
});

/**
 * POST /api/governance/bootstrap-admin
 *
 * ONE-TIME bootstrap endpoint. Creates the first super admin account.
 *
 * IDEMPOTENCY GUARANTEES:
 * 1. Check MongoDB bootstrap lock first — if locked, return 409 immediately.
 * 2. Resolve Firebase user (get-or-create) — never duplicates.
 * 3. Set Firebase custom claims — safe to repeat.
 * 4. Upsert MongoDB User record — never duplicates (uses firebaseUid unique index).
 * 5. Atomically write bootstrap lock — after this, system is permanently bootstrapped.
 *
 * EDGE CASES HANDLED:
 * - Bootstrap called twice → second call gets 409.
 * - Firebase user exists, MongoDB record missing → reuses Firebase user, creates MongoDB record.
 * - MongoDB record exists, Firebase user missing → creates Firebase user, upserts MongoDB record.
 * - Server crash between Firebase and MongoDB writes → retry converges to correct state.
 * - Rapid concurrent POST requests → second request either gets 409 or harmlessly upserts.
 */
router.post('/bootstrap-admin', async (req, res) => {
  const { email, password, name } = req.body;
  const ip = getClientIp(req);

  try {
    /* ── STEP 1: Check bootstrap lock (MongoDB is source of truth) ── */
    const existingLock = await isSystemBootstrapped();
    if (existingLock) {
      await logGovernanceAction(
        'BOOTSTRAP_BLOCKED',
        { reason: 'System already bootstrapped', email },
        ip
      );
      return res.status(409).json({
        message: 'System already bootstrapped. Bootstrap is permanently disabled.',
      });
    }

    /* ── STEP 2: Validate input ── */
    if (!email || !password || !name) {
      return res.status(400).json({
        message: 'Email, password and name are required',
      });
    }

    /* ── STEP 3: Resolve Firebase user (get-or-create, never duplicate) ── */
    const { user: firebaseUser } = await resolveFirebaseUser(email, password, name);

    /* ── STEP 4: Set Firebase custom claims (idempotent operation) ── */
    await admin.auth().setCustomUserClaims(firebaseUser.uid, {
      role: 'super_admin',
    });

    /* ── STEP 5: Upsert MongoDB User record (never create duplicates) ── */
    const adminUser = await User.findOneAndUpdate(
      { firebaseUid: firebaseUser.uid },
      {
        $set: {
          email,
          name,
          role: 'admin',
          status: 'active',
        },
        $setOnInsert: {
          firebaseUid: firebaseUser.uid,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    /* ── STEP 6: Write bootstrap lock atomically ── */
    await SystemSettings.findOneAndUpdate(
      { _id: BOOTSTRAP_DOC_ID },
      {
        $set: {
          bootstrapped: true,
          superAdminUid: firebaseUser.uid,
          bootstrappedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    await logGovernanceAction(
      'BOOTSTRAP_SUCCESS',
      { adminId: adminUser._id.toString(), email },
      ip,
      adminUser._id
    );

    return res.status(201).json({
      message: 'Admin created successfully. System is now bootstrapped.',
      user: {
        id: adminUser._id,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    await logGovernanceAction(
      'BOOTSTRAP_ERROR',
      { error: err.message, email },
      ip
    );
    return res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/governance/admin-recovery
 *
 * Emergency admin recovery endpoint. Protected by ADMIN_RECOVERY_TOKEN.
 * Uses the same idempotent get-or-create pattern as bootstrap.
 */
router.post('/admin-recovery', async (req, res) => {
  const { recoveryToken, email, password, name } = req.body;
  const ip = getClientIp(req);

  try {
    if (!ADMIN_RECOVERY_TOKEN) {
      return res.status(503).json({
        message: 'Admin recovery not configured',
      });
    }

    if (recoveryToken !== ADMIN_RECOVERY_TOKEN) {
      await logGovernanceAction(
        'RECOVERY_DENIED',
        { email },
        ip
      );
      return res.status(401).json({ message: 'Invalid recovery token' });
    }

    /* Resolve Firebase user (get-or-create, never duplicate) */
    const { user: firebaseUser } = await resolveFirebaseUser(email, password, name);

    /* Set Firebase custom claims (idempotent) */
    await admin.auth().setCustomUserClaims(firebaseUser.uid, {
      role: 'admin',
    });

    /* Upsert MongoDB User record (never create duplicates) */
    const adminUser = await User.findOneAndUpdate(
      { firebaseUid: firebaseUser.uid },
      {
        $set: {
          email,
          name,
          role: 'admin',
          status: 'active',
        },
        $setOnInsert: {
          firebaseUid: firebaseUser.uid,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await logGovernanceAction(
      'RECOVERY_SUCCESS',
      { adminId: adminUser._id.toString(), email },
      ip,
      adminUser._id
    );

    return res.status(201).json({
      message: 'Recovery admin created successfully',
      user: {
        id: adminUser._id,
        email: adminUser.email,
        role: 'admin',
      },
    });
  } catch (err) {
    console.error('Recovery error:', err);
    await logGovernanceAction(
      'RECOVERY_ERROR',
      { error: err.message, email },
      ip
    );
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;
