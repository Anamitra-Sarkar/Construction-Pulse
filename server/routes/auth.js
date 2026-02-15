const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/logger');
const {
  appendAuditLog,
  getPolicy,
  checkAdminCountSafety,
  createPendingAction,
  MIN_ACTIVE_ADMINS,
} = require('../utils/governance');

router.get('/me', verifyToken, async (req, res) => {
  res.json(req.user);
});

/**
 * POST /api/auth/users
 *
 * Create a new user. Admin-only.
 * Uses idempotent resolveFirebaseUser pattern for safety.
 */
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
      await appendAuditLog(
        'ADMIN_CREATED',
        'USER',
        {
          createdBy: req.user._id.toString(),
          newAdminId: newUser._id.toString(),
          email,
        },
        clientIp,
        req.user._id
      );
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

/**
 * PATCH /api/auth/users/:id
 *
 * Update a user's role or status. Admin-only.
 *
 * GOVERNANCE ENFORCEMENT:
 * - Demoting an admin requires multi-party approval via pending action
 * - Deactivating an admin requires multi-party approval via pending action
 * - Last-admin protection prevents reducing active admins below minimum
 * - All changes are audit-logged with tamper-evident chain
 * 
 * SECURITY:
 * - Validates all input fields before processing
 * - Only allows updating status and role fields (prevents document replacement)
 * - Enforces role enum values: ['admin', 'engineer']
 * - Enforces status enum values: ['active', 'inactive']
 */
router.patch('/users/:id', verifyToken, isAdmin, async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  try {
    const { status, role } = req.body;
    
    // VALIDATION: Ensure only allowed fields are present in the update
    const allowedFields = ['status', 'role'];
    const receivedFields = Object.keys(req.body);
    const invalidFields = receivedFields.filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({ 
        message: `Invalid fields in request: ${invalidFields.join(', ')}. Only 'status' and 'role' are allowed.`,
        code: 'INVALID_FIELDS'
      });
    }
    
    // VALIDATION: If status is provided, ensure it's a valid value
    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status value: '${status}'. Must be 'active' or 'inactive'.`,
        code: 'INVALID_STATUS'
      });
    }
    
    // VALIDATION: If role is provided, ensure it's a valid value
    if (role && !['admin', 'engineer'].includes(role)) {
      return res.status(400).json({ 
        message: `Invalid role value: '${role}'. Must be 'admin' or 'engineer'.`,
        code: 'INVALID_ROLE'
      });
    }
    
    // VALIDATION: At least one field must be provided
    if (!status && !role) {
      return res.status(400).json({ 
        message: 'At least one field (status or role) must be provided for update.',
        code: 'NO_FIELDS'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    const currentAdminCount = await User.countDocuments({ role: 'admin', status: 'active' });
    const isCurrentlyActiveAdmin = user.role === 'admin' && user.status === 'active';
    const willBeActiveAdmin = (role || user.role) === 'admin' && (status || user.status) === 'active';

    // Last-admin structural protection — cannot be bypassed by any user
    if (isCurrentlyActiveAdmin && !willBeActiveAdmin && currentAdminCount <= MIN_ACTIVE_ADMINS) {
      await appendAuditLog(
        'LAST_ADMIN_PROTECTION',
        'USER',
        {
          attemptedBy: req.user._id.toString(),
          targetUser: user._id.toString(),
          attemptedRole: role,
          attemptedStatus: status,
        },
        clientIp,
        req.user._id
      );

      return res.status(403).json({ 
        message: 'Cannot remove or demote the last active admin. The system must always have at least one admin.',
        code: 'LAST_ADMIN_PROTECTION'
      });
    }

    // GOVERNANCE: Demoting an admin requires multi-party approval
    if (isCurrentlyActiveAdmin && role && role !== 'admin') {
      const demotePolicy = await getPolicy('DEMOTE_ADMIN');
      if (demotePolicy && demotePolicy.requiredApprovals > 1) {
        const pendingAction = await createPendingAction(
          'DEMOTE_ADMIN',
          req.user._id,
          {
            targetUserId: user._id.toString(),
            targetEmail: user.email,
            newRole: role,
          },
          `Demote admin ${user.email} to ${role}`,
          clientIp
        );
        return res.status(202).json({
          message: 'Admin demotion requires multi-party approval. Pending action created.',
          code: 'PENDING_APPROVAL',
          pendingActionId: pendingAction._id,
        });
      }
    }

    // GOVERNANCE: Deactivating an admin requires multi-party approval
    if (isCurrentlyActiveAdmin && status === 'inactive') {
      const deactivatePolicy = await getPolicy('DEACTIVATE_ADMIN');
      if (deactivatePolicy && deactivatePolicy.requiredApprovals > 1) {
        const pendingAction = await createPendingAction(
          'DEACTIVATE_ADMIN',
          req.user._id,
          {
            targetUserId: user._id.toString(),
            targetEmail: user.email,
          },
          `Deactivate admin ${user.email}`,
          clientIp
        );
        return res.status(202).json({
          message: 'Admin deactivation requires multi-party approval. Pending action created.',
          code: 'PENDING_APPROVAL',
          pendingActionId: pendingAction._id,
        });
      }
    }

    // Apply changes (for non-governed actions or single-approval policies)
    if (role && role !== user.role) {
      // Update Firebase custom claims with the new role
      await admin.auth().setCustomUserClaims(user.firebaseUid, { role });
      
      if (user.role === 'admin' && role === 'engineer') {
        await appendAuditLog(
          'ADMIN_DEMOTED',
          'USER',
          {
            demotedBy: req.user._id.toString(),
            demotedUser: user._id.toString(),
            email: user.email,
          },
          clientIp,
          req.user._id
        );
      } else if (user.role === 'engineer' && role === 'admin') {
        await appendAuditLog(
          'USER_PROMOTED_TO_ADMIN',
          'USER',
          {
            promotedBy: req.user._id.toString(),
            promotedUser: user._id.toString(),
            email: user.email,
          },
          clientIp,
          req.user._id
        );
      }

      user.role = role;
    }
    
    if (status && status !== user.status) {
      if (user.role === 'admin' && status === 'inactive') {
        await appendAuditLog(
          'ADMIN_DEACTIVATED',
          'USER',
          {
            deactivatedBy: req.user._id.toString(),
            deactivatedUser: user._id.toString(),
            email: user.email,
          },
          clientIp,
          req.user._id
        );
      }
      user.status = status;
    }
    
    // Save updates (mongoose will only update changed fields)
    await user.save();
    await logAction(req.user._id, 'USER_UPDATE', { targetUser: user._id, status, role });
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * DELETE /api/auth/users/:id
 *
 * Delete a user. Admin-only.
 *
 * GOVERNANCE ENFORCEMENT:
 * - Deleting an admin requires multi-party approval via pending action
 * - Self-deletion is forbidden
 * - Last-admin protection is enforced structurally
 * - All deletions are audit-logged
 */
router.delete('/users/:id', verifyToken, isAdmin, async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  try {
    const user = await User.findById(req.params.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Self-deletion prevention
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    if (user.role === 'admin' && user.status === 'active') {
      const activeAdminCount = await User.countDocuments({ role: 'admin', status: 'active' });
      
      // Last-admin structural protection
      if (activeAdminCount <= MIN_ACTIVE_ADMINS) {
        await appendAuditLog(
          'LAST_ADMIN_DELETE_BLOCKED',
          'USER',
          {
            attemptedBy: req.user._id.toString(),
            targetUser: user._id.toString(),
            email: user.email,
          },
          clientIp,
          req.user._id
        );

        return res.status(403).json({ 
          message: 'Cannot delete the last active admin. The system must always have at least one admin.',
          code: 'LAST_ADMIN_PROTECTION'
        });
      }

      // GOVERNANCE: Deleting an admin requires multi-party approval
      const deletePolicy = await getPolicy('DELETE_ADMIN');
      if (deletePolicy && deletePolicy.requiredApprovals > 1) {
        const pendingAction = await createPendingAction(
          'DELETE_ADMIN',
          req.user._id,
          {
            targetUserId: user._id.toString(),
            targetEmail: user.email,
            targetName: user.name,
          },
          `Delete admin ${user.email}`,
          clientIp
        );
        return res.status(202).json({
          message: 'Admin deletion requires multi-party approval. Pending action created.',
          code: 'PENDING_APPROVAL',
          pendingActionId: pendingAction._id,
        });
      }

      await appendAuditLog(
        'ADMIN_DELETED',
        'USER',
        {
          deletedBy: req.user._id.toString(),
          deletedUser: user._id.toString(),
          email: user.email,
        },
        clientIp,
        req.user._id
      );
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
