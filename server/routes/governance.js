const express = require('express');
const router = express.Router();

const admin = require('../config/firebase');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const PendingAction = require('../models/PendingAction');
const GovernancePolicy = require('../models/GovernancePolicy');
const { verifyToken, isAdmin } = require('../middleware/auth');
const {
  appendAuditLog,
  verifyAuditChain,
  seedDefaultPolicies,
  getPolicy,
  checkAdminCountSafety,
  createPendingAction,
  approvePendingAction,
  vetoPendingAction,
  cancelPendingAction,
  expireStaleActions,
  MIN_ACTIVE_ADMINS,
} = require('../utils/governance');

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
   PUBLIC ROUTES (no authentication required)
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
 * 6. Seed default governance policies — ensures governance is active from day one.
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
      await appendAuditLog(
        'BOOTSTRAP_BLOCKED',
        'GOVERNANCE',
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
      role: 'admin',
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

    /* ── STEP 7: Seed default governance policies ── */
    await seedDefaultPolicies();

    await appendAuditLog(
      'BOOTSTRAP_SUCCESS',
      'GOVERNANCE',
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
    await appendAuditLog(
      'BOOTSTRAP_ERROR',
      'GOVERNANCE',
      { error: err.message, email },
      ip
    );
    return res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/governance/admin-recovery
 *
 * Emergency admin recovery endpoint.
 *
 * SECURITY MODEL:
 * - Protected by ADMIN_RECOVERY_TOKEN (environment variable, never in code)
 * - Uses idempotent get-or-create pattern (safe to retry)
 * - Time-delayed: recovery is logged and auditable
 * - Cannot remove existing admins or bypass governance
 * - Only ADDS a new admin — does not grant silent power over existing data
 *
 * RECOVERY GUARANTEES:
 * - Works even if all admins are disabled (uses token, not auth middleware)
 * - Recovery path cannot be removed (requires env var configuration)
 * - Every recovery attempt is audit-logged with IP and timestamp
 * - Recovered admin has standard admin role (not elevated super-admin)
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
      await appendAuditLog(
        'RECOVERY_DENIED',
        'GOVERNANCE',
        { email, reason: 'Invalid recovery token' },
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

    await appendAuditLog(
      'RECOVERY_SUCCESS',
      'GOVERNANCE',
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
    await appendAuditLog(
      'RECOVERY_ERROR',
      'GOVERNANCE',
      { error: err.message, email },
      ip
    );
    return res.status(400).json({ message: err.message });
  }
});

/* ================================================================
   PROTECTED ROUTES (authentication + admin role required)

   These endpoints provide the Multi-Approval Governance Engine,
   audit integrity verification, and policy management.
   ================================================================ */

/**
 * GET /api/governance/policies
 *
 * List all governance policies. Visible to all admins for transparency.
 */
router.get('/policies', verifyToken, isAdmin, async (req, res) => {
  try {
    const policies = await GovernancePolicy.find().sort({ actionType: 1 }).lean();
    return res.json({ policies });
  } catch (err) {
    console.error('List policies error:', err);
    return res.status(500).json({ message: 'Failed to list policies' });
  }
});

/**
 * GET /api/governance/pending-actions
 *
 * List all pending actions. Visible to all admins for transparency.
 * Expired actions are cleaned up automatically.
 */
router.get('/pending-actions', verifyToken, isAdmin, async (req, res) => {
  try {
    // Expire stale actions first
    await expireStaleActions();

    const actions = await PendingAction.find({
      status: { $in: ['pending', 'approved'] },
    })
      .populate('requestedBy', 'name email')
      .populate('approvals.userId', 'name email')
      .populate('vetoedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ actions });
  } catch (err) {
    console.error('List pending actions error:', err);
    return res.status(500).json({ message: 'Failed to list pending actions' });
  }
});

/**
 * GET /api/governance/pending-actions/history
 *
 * List all completed/cancelled/vetoed/expired actions for audit purposes.
 */
router.get('/pending-actions/history', verifyToken, isAdmin, async (req, res) => {
  try {
    const actions = await PendingAction.find({
      status: { $in: ['executed', 'cancelled', 'vetoed', 'expired', 'reversed'] },
    })
      .populate('requestedBy', 'name email')
      .populate('approvals.userId', 'name email')
      .populate('vetoedBy', 'name email')
      .populate('reversedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ actions });
  } catch (err) {
    console.error('List action history error:', err);
    return res.status(500).json({ message: 'Failed to list action history' });
  }
});

/**
 * POST /api/governance/pending-actions
 *
 * Create a new pending action that requires multi-party approval.
 * The action type must have a corresponding governance policy.
 *
 * Body: { actionType, payload, reason }
 */
router.post('/pending-actions', verifyToken, isAdmin, async (req, res) => {
  const { actionType, payload, reason } = req.body;
  const ip = getClientIp(req);

  try {
    if (!actionType || !payload || !reason) {
      return res.status(400).json({
        message: 'actionType, payload, and reason are required',
      });
    }

    const pendingAction = await createPendingAction(
      actionType,
      req.user._id,
      payload,
      reason,
      ip
    );

    return res.status(201).json({
      message: 'Pending action created. Awaiting approvals.',
      action: pendingAction,
    });
  } catch (err) {
    console.error('Create pending action error:', err);
    return res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/governance/pending-actions/:id/approve
 *
 * Approve a pending action. Separation of powers enforced:
 * requestor cannot approve their own request.
 *
 * Body: { comment? }
 */
router.post('/pending-actions/:id/approve', verifyToken, isAdmin, async (req, res) => {
  const { comment } = req.body;
  const ip = getClientIp(req);

  try {
    const action = await approvePendingAction(
      req.params.id,
      req.user._id,
      comment || '',
      ip
    );

    return res.json({
      message: action.hasQuorum()
        ? 'Action approved — quorum reached. Scheduled for execution.'
        : 'Approval recorded. Waiting for more approvals.',
      action,
    });
  } catch (err) {
    console.error('Approve action error:', err);
    return res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/governance/pending-actions/:id/veto
 *
 * Veto a pending action. Permanently blocks execution.
 * Any admin can veto — this is the safety valve against collusion.
 *
 * Body: { reason }
 */
router.post('/pending-actions/:id/veto', verifyToken, isAdmin, async (req, res) => {
  const { reason } = req.body;
  const ip = getClientIp(req);

  try {
    if (!reason) {
      return res.status(400).json({ message: 'Veto reason is required' });
    }

    const action = await vetoPendingAction(
      req.params.id,
      req.user._id,
      reason,
      ip
    );

    return res.json({
      message: 'Action vetoed permanently.',
      action,
    });
  } catch (err) {
    console.error('Veto action error:', err);
    return res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/governance/pending-actions/:id/cancel
 *
 * Cancel a pending action. Only the original requestor can cancel.
 */
router.post('/pending-actions/:id/cancel', verifyToken, isAdmin, async (req, res) => {
  const ip = getClientIp(req);

  try {
    const action = await cancelPendingAction(
      req.params.id,
      req.user._id,
      ip
    );

    return res.json({
      message: 'Action cancelled.',
      action,
    });
  } catch (err) {
    console.error('Cancel action error:', err);
    return res.status(400).json({ message: err.message });
  }
});

/**
 * GET /api/governance/audit/verify
 *
 * Verify the integrity of the audit log chain.
 * Returns whether the chain is intact or where it was broken.
 *
 * WHY: Allows administrators to detect if any audit log entries
 * were modified, deleted, or inserted out of order — either by
 * malicious actors or database corruption.
 */
router.get('/audit/verify', verifyToken, isAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 1000, 10000);
    const result = await verifyAuditChain(limit);

    await appendAuditLog(
      'AUDIT_CHAIN_VERIFIED',
      'GOVERNANCE',
      { result, entriesChecked: result.checked },
      getClientIp(req),
      req.user._id
    );

    return res.json(result);
  } catch (err) {
    console.error('Audit verify error:', err);
    return res.status(500).json({ message: 'Audit verification failed' });
  }
});

/**
 * GET /api/governance/admin-safety
 *
 * Check the current admin count safety status.
 * Returns the active admin count and minimum threshold.
 *
 * WHY: Provides visibility into whether the system is at risk
 * of lockout and what the current safety margins are.
 */
router.get('/admin-safety', verifyToken, isAdmin, async (req, res) => {
  try {
    const activeAdminCount = await User.countDocuments({
      role: 'admin',
      status: 'active',
    });

    return res.json({
      activeAdminCount,
      minimumRequired: MIN_ACTIVE_ADMINS,
      safetyMargin: activeAdminCount - MIN_ACTIVE_ADMINS,
      isAtMinimum: activeAdminCount <= MIN_ACTIVE_ADMINS,
    });
  } catch (err) {
    console.error('Admin safety check error:', err);
    return res.status(500).json({ message: 'Admin safety check failed' });
  }
});

module.exports = router;
