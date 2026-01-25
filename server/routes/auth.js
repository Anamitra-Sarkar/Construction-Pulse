const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

const logGovernanceAction = async (action, details, ip, userId = null) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      resource: 'USER',
      details,
      ip
    });
  } catch (error) {
    console.error('Failed to log governance action:', error);
  }
};

router.get('/me', verifyToken, async (req, res) => {
  res.json(req.user);
});

router.post('/users', verifyToken, isAdmin, async (req, res) => {
  const { email, password, name, role } = req.body;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  try {
    if (!email || !password || !name || !role) {
      return res.status(400).json({ message: 'Email, password, name, and role are required' });
    }

    if (!['admin', 'engineer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be admin or engineer' });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    const newUser = await User.create({
      firebaseUid: userRecord.uid,
      email,
      name,
      role
    });

    await logAction(req.user._id, 'USER_CREATE', { targetUser: newUser._id, role });
    
    if (role === 'admin') {
      await logGovernanceAction('ADMIN_CREATED', { 
        createdBy: req.user._id.toString(),
        newAdminId: newUser._id.toString(),
        email 
      }, clientIp, req.user._id);
    }

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ message: error.message });
  }
});

router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
    res.json({ users, adminCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/users/:id', verifyToken, isAdmin, async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  try {
    const { status, role } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    const currentAdminCount = await User.countDocuments({ role: 'admin', status: 'active' });
    const isCurrentlyActiveAdmin = user.role === 'admin' && user.status === 'active';
    const willBeActiveAdmin = (role || user.role) === 'admin' && (status || user.status) === 'active';

    if (isCurrentlyActiveAdmin && !willBeActiveAdmin && currentAdminCount <= 1) {
      await logGovernanceAction('LAST_ADMIN_PROTECTION', { 
        attemptedBy: req.user._id.toString(),
        targetUser: user._id.toString(),
        attemptedRole: role,
        attemptedStatus: status
      }, clientIp, req.user._id);

      return res.status(403).json({ 
        message: 'Cannot remove or demote the last active admin. The system must always have at least one admin.',
        code: 'LAST_ADMIN_PROTECTION'
      });
    }

    if (role && role !== user.role) {
      await admin.auth().setCustomUserClaims(user.firebaseUid, { role });
      
      if (user.role === 'admin' && role === 'engineer') {
        await logGovernanceAction('ADMIN_DEMOTED', { 
          demotedBy: req.user._id.toString(),
          demotedUser: user._id.toString(),
          email: user.email
        }, clientIp, req.user._id);
      } else if (user.role === 'engineer' && role === 'admin') {
        await logGovernanceAction('USER_PROMOTED_TO_ADMIN', { 
          promotedBy: req.user._id.toString(),
          promotedUser: user._id.toString(),
          email: user.email
        }, clientIp, req.user._id);
      }

      user.role = role;
    }
    
    if (status && status !== user.status) {
      if (user.role === 'admin' && status === 'inactive') {
        await logGovernanceAction('ADMIN_DEACTIVATED', { 
          deactivatedBy: req.user._id.toString(),
          deactivatedUser: user._id.toString(),
          email: user.email
        }, clientIp, req.user._id);
      }
      user.status = status;
    }
    
    await user.save();
    await logAction(req.user._id, 'USER_UPDATE', { targetUser: user._id, status, role });
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/users/:id', verifyToken, isAdmin, async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  try {
    const user = await User.findById(req.params.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    if (user.role === 'admin' && user.status === 'active') {
      const activeAdminCount = await User.countDocuments({ role: 'admin', status: 'active' });
      
      if (activeAdminCount <= 1) {
        await logGovernanceAction('LAST_ADMIN_DELETE_BLOCKED', { 
          attemptedBy: req.user._id.toString(),
          targetUser: user._id.toString(),
          email: user.email
        }, clientIp, req.user._id);

        return res.status(403).json({ 
          message: 'Cannot delete the last active admin. The system must always have at least one admin.',
          code: 'LAST_ADMIN_PROTECTION'
        });
      }

      await logGovernanceAction('ADMIN_DELETED', { 
        deletedBy: req.user._id.toString(),
        deletedUser: user._id.toString(),
        email: user.email
      }, clientIp, req.user._id);
    }

    try {
      await admin.auth().deleteUser(user.firebaseUid);
    } catch (firebaseError) {
      console.error('Failed to delete Firebase user:', firebaseError);
    }

    await User.findByIdAndDelete(req.params.id);
    await logAction(req.user._id, 'USER_DELETE', { deletedUser: user._id, email: user.email });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/admin-count', verifyToken, isAdmin, async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
    res.json({ adminCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
