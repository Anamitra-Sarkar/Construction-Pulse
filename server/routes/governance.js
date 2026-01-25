const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const ADMIN_RECOVERY_TOKEN = process.env.ADMIN_RECOVERY_TOKEN;

const logGovernanceAction = async (action, details, ip, userId = null) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      resource: 'GOVERNANCE',
      details,
      ip
    });
  } catch (error) {
    console.error('Failed to log governance action:', error);
  }
};

router.get('/status', async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
    res.json({
      initialized: adminCount > 0,
      adminCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/bootstrap-admin', async (req, res) => {
  const { email, password, name } = req.body;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  try {
    const adminCount = await User.countDocuments({ role: 'admin' });

    if (adminCount > 0) {
      await logGovernanceAction('BOOTSTRAP_REJECTED', { reason: 'System already initialized', email }, clientIp);
      return res.status(403).json({ 
        message: 'System already initialized. Bootstrap is permanently disabled.' 
      });
    }

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required' });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });

    const newAdmin = await User.create({
      firebaseUid: userRecord.uid,
      email,
      name,
      role: 'admin',
      status: 'active'
    });

    await logGovernanceAction('BOOTSTRAP_ADMIN_CREATED', { 
      adminId: newAdmin._id.toString(),
      email,
      name
    }, clientIp, newAdmin._id);

    res.status(201).json({
      message: 'Bootstrap admin created successfully. Bootstrap is now permanently disabled.',
      user: {
        id: newAdmin._id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role
      }
    });
  } catch (error) {
    await logGovernanceAction('BOOTSTRAP_ERROR', { error: error.message, email }, clientIp);
    console.error('Bootstrap admin error:', error);
    res.status(400).json({ message: error.message });
  }
});

router.post('/admin-recovery', async (req, res) => {
  const { recoveryToken, email, password, name } = req.body;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  try {
    if (!ADMIN_RECOVERY_TOKEN) {
      await logGovernanceAction('RECOVERY_REJECTED', { reason: 'Recovery token not configured' }, clientIp);
      return res.status(503).json({ message: 'Admin recovery is not configured' });
    }

    if (!recoveryToken || recoveryToken !== ADMIN_RECOVERY_TOKEN) {
      await logGovernanceAction('RECOVERY_REJECTED', { reason: 'Invalid recovery token', email }, clientIp);
      return res.status(401).json({ message: 'Invalid recovery token' });
    }

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required' });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });

    const newAdmin = await User.create({
      firebaseUid: userRecord.uid,
      email,
      name,
      role: 'admin',
      status: 'active'
    });

    await logGovernanceAction('ADMIN_RECOVERY_SUCCESS', { 
      adminId: newAdmin._id.toString(),
      email,
      name
    }, clientIp, newAdmin._id);

    res.status(201).json({
      message: 'Recovery admin created successfully',
      user: {
        id: newAdmin._id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role
      }
    });
  } catch (error) {
    await logGovernanceAction('RECOVERY_ERROR', { error: error.message, email }, clientIp);
    console.error('Admin recovery error:', error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
