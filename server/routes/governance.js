const express = require('express');
const router = express.Router();

const admin = require('../config/firebase');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const ADMIN_RECOVERY_TOKEN = process.env.ADMIN_RECOVERY_TOKEN || null;

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

/* ---------------- ROUTES ---------------- */

/**
 * GET /api/governance/status
 * Used by frontend to decide bootstrap flow
 */
router.get('/status', async (req, res) => {
  try {
    const adminCount = await User.countDocuments({
      role: 'admin',
      status: 'active',
    });

    return res.json({
      initialized: adminCount > 0,
      adminCount,
    });
  } catch (err) {
    console.error('Governance status error:', err);
    return res.status(500).json({ message: 'Governance status failed' });
  }
});

/**
 * POST /api/governance/bootstrap-admin
 * ONE-TIME ONLY
 */
router.post('/bootstrap-admin', async (req, res) => {
  const { email, password, name } = req.body;
  const ip = getClientIp(req);

  try {
    const adminCount = await User.countDocuments({ role: 'admin' });

    if (adminCount > 0) {
      await logGovernanceAction(
        'BOOTSTRAP_BLOCKED',
        { reason: 'Already initialized', email },
        ip
      );
      return res.status(403).json({
        message: 'System already initialized. Bootstrap disabled.',
      });
    }

    if (!email || !password || !name) {
      return res.status(400).json({
        message: 'Email, password and name are required',
      });
    }

    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await admin.auth().setCustomUserClaims(firebaseUser.uid, {
      role: 'admin',
    });

    const newAdmin = await User.create({
      firebaseUid: firebaseUser.uid,
      email,
      name,
      role: 'admin',
      status: 'active',
    });

    await logGovernanceAction(
      'BOOTSTRAP_SUCCESS',
      { adminId: newAdmin._id.toString(), email },
      ip,
      newAdmin._id
    );

    return res.status(201).json({
      message: 'Admin created successfully',
      user: {
        id: newAdmin._id,
        email: newAdmin.email,
        role: newAdmin.role,
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
 * Emergency only
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

    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await admin.auth().setCustomUserClaims(firebaseUser.uid, {
      role: 'admin',
    });

    const newAdmin = await User.create({
      firebaseUid: firebaseUser.uid,
      email,
      name,
      role: 'admin',
      status: 'active',
    });

    await logGovernanceAction(
      'RECOVERY_SUCCESS',
      { adminId: newAdmin._id.toString(), email },
      ip,
      newAdmin._id
    );

    return res.status(201).json({
      message: 'Recovery admin created successfully',
      user: {
        id: newAdmin._id,
        email,
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
