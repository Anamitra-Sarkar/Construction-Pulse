const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');
const GovernancePolicy = require('../models/GovernancePolicy');
const PendingAction = require('../models/PendingAction');
const User = require('../models/User');

/**
 * Governance Utilities
 *
 * Core engine for the enterprise governance system. Provides:
 * 1. Tamper-evident audit logging (cryptographically chained)
 * 2. Policy-driven authorization checks
 * 3. Multi-party approval workflow
 * 4. Lockout prevention invariants
 * 5. Default policy seeding
 *
 * DESIGN: All critical operations flow through this module.
 * Direct database writes for governance actions are forbidden elsewhere.
 */

/* ================================================================
   1. TAMPER-EVIDENT AUDIT LOGGING
   ================================================================ */

/**
 * Append a tamper-evident audit log entry.
 * Each entry is cryptographically chained to its predecessor.
 *
 * WHY: Standard audit logs can be silently modified or deleted.
 * Cryptographic chaining makes tampering detectable — modifying
 * any entry breaks the hash chain for all subsequent entries.
 */
const appendAuditLog = async (action, resource, details, ip, userId = null, resourceId = null) => {
  try {
    // Get the last entry in the chain to obtain its hash and sequence number
    const lastEntry = await AuditLog.findOne()
      .sort({ sequenceNumber: -1 })
      .select('entryHash sequenceNumber')
      .lean();

    const previousHash = lastEntry ? lastEntry.entryHash : 'GENESIS';
    const sequenceNumber = lastEntry ? (lastEntry.sequenceNumber ?? 0) + 1 : 1;

    const entry = new AuditLog({
      user: userId,
      action,
      resource,
      resourceId,
      details,
      ip,
      previousHash,
      sequenceNumber,
      createdAt: new Date(),
    });

    // Compute and set the cryptographic hash
    entry.entryHash = entry.computeHash();
    await entry.save();

    return entry;
  } catch (err) {
    // Audit logging must never crash the application — log and continue
    console.error('Tamper-evident audit log failed:', err.message);
    return null;
  }
};

/**
 * Verify the integrity of the audit log chain.
 * Returns { valid: boolean, brokenAt: number|null, checked: number }.
 *
 * WHY: Allows administrators to detect if any log entries were
 * modified, deleted, or inserted out of order.
 */
const verifyAuditChain = async (limit = 1000) => {
  const entries = await AuditLog.find()
    .sort({ sequenceNumber: 1 })
    .limit(limit)
    .lean();

  if (entries.length === 0) {
    return { valid: true, brokenAt: null, checked: 0 };
  }

  let previousHash = 'GENESIS';

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Verify chain link
    if (entry.previousHash !== previousHash) {
      return { valid: false, brokenAt: entry.sequenceNumber, checked: i + 1 };
    }

    // Recompute hash and verify
    const tempDoc = new AuditLog(entry);
    const computedHash = tempDoc.computeHash();

    if (entry.entryHash !== computedHash) {
      return { valid: false, brokenAt: entry.sequenceNumber, checked: i + 1 };
    }

    previousHash = entry.entryHash;
  }

  return { valid: true, brokenAt: null, checked: entries.length };
};

/* ================================================================
   2. POLICY ENGINE
   ================================================================ */

/**
 * Default governance policies that are seeded on first startup.
 * These define the minimum security requirements for critical actions.
 *
 * INVARIANT: System default policies cannot be deleted, only modified
 * (and modification itself requires multi-party approval).
 */
const DEFAULT_POLICIES = [
  {
    actionType: 'DELETE_ADMIN',
    description: 'Delete an administrator account',
    requiredApprovals: 2,
    allowedRequestors: ['admin'],
    allowedApprovers: ['admin'],
    selfApprovalAllowed: false,
    executionDelaySecs: 300,
    reversibilityWindowSecs: 3600,
    isSystemDefault: true,
  },
  {
    actionType: 'DEMOTE_ADMIN',
    description: 'Demote an administrator to engineer',
    requiredApprovals: 2,
    allowedRequestors: ['admin'],
    allowedApprovers: ['admin'],
    selfApprovalAllowed: false,
    executionDelaySecs: 300,
    reversibilityWindowSecs: 3600,
    isSystemDefault: true,
  },
  {
    actionType: 'DEACTIVATE_ADMIN',
    description: 'Deactivate an administrator account',
    requiredApprovals: 2,
    allowedRequestors: ['admin'],
    allowedApprovers: ['admin'],
    selfApprovalAllowed: false,
    executionDelaySecs: 300,
    reversibilityWindowSecs: 3600,
    isSystemDefault: true,
  },
  {
    actionType: 'MODIFY_POLICY',
    description: 'Modify a governance policy (self-referential protection)',
    requiredApprovals: 2,
    allowedRequestors: ['admin'],
    allowedApprovers: ['admin'],
    selfApprovalAllowed: false,
    executionDelaySecs: 600,
    reversibilityWindowSecs: 7200,
    isSystemDefault: true,
  },
  {
    actionType: 'SYSTEM_RECOVERY',
    description: 'Emergency system recovery — create new admin when all are disabled',
    requiredApprovals: 1,
    allowedRequestors: ['admin'],
    allowedApprovers: ['admin'],
    selfApprovalAllowed: true,
    executionDelaySecs: 600,
    reversibilityWindowSecs: 3600,
    isSystemDefault: true,
  },
  {
    actionType: 'DISABLE_AUDIT',
    description: 'Disable or modify audit logging configuration',
    requiredApprovals: 2,
    allowedRequestors: ['admin'],
    allowedApprovers: ['admin'],
    selfApprovalAllowed: false,
    executionDelaySecs: 900,
    reversibilityWindowSecs: 0,
    isSystemDefault: true,
  },
];

/**
 * Seed default governance policies if they don't exist.
 * Called on server startup to ensure minimum governance is always in place.
 *
 * WHY: The system must always have governance policies.
 * Without this, the first deployment would have no protections.
 */
const seedDefaultPolicies = async () => {
  try {
    for (const policy of DEFAULT_POLICIES) {
      await GovernancePolicy.findOneAndUpdate(
        { actionType: policy.actionType },
        { $setOnInsert: policy },
        { upsert: true, new: true }
      );
    }
    console.log('Governance policies seeded successfully');
  } catch (err) {
    console.error('Failed to seed governance policies:', err.message);
  }
};

/**
 * Get the governance policy for a specific action type.
 * Returns null if no policy exists (action is not governed).
 */
const getPolicy = async (actionType) => {
  return GovernancePolicy.findOne({ actionType, enabled: true }).lean();
};

/* ================================================================
   3. LOCKOUT PREVENTION
   ================================================================ */

/**
 * Minimum number of active admins the system must maintain.
 * This is a mathematical guarantee against total lockout.
 *
 * INVARIANT: No operation that would reduce active admins below
 * this threshold is allowed to execute, regardless of approval count.
 */
const MIN_ACTIVE_ADMINS = 1;

/**
 * Check if an action would violate the minimum admin count invariant.
 * Returns { safe: boolean, currentCount: number, wouldRemove: number }.
 *
 * WHY: Even with full multi-party approval, the system must never
 * allow all administrators to be removed/disabled/demoted.
 * This is a structural guarantee, not a trust-based one.
 */
const checkAdminCountSafety = async (targetUserId, action) => {
  const activeAdminCount = await User.countDocuments({
    role: 'admin',
    status: 'active',
  });

  const targetUser = await User.findById(targetUserId).lean();

  if (!targetUser) {
    return { safe: true, currentCount: activeAdminCount, wouldRemove: 0 };
  }

  const isActiveAdmin =
    targetUser.role === 'admin' && targetUser.status === 'active';

  // If the target is not an active admin, this action won't reduce the count
  if (!isActiveAdmin) {
    return { safe: true, currentCount: activeAdminCount, wouldRemove: 0 };
  }

  // This action would remove one active admin
  const resultingCount = activeAdminCount - 1;

  return {
    safe: resultingCount >= MIN_ACTIVE_ADMINS,
    currentCount: activeAdminCount,
    wouldRemove: 1,
    resultingCount,
  };
};

/* ================================================================
   4. PENDING ACTION WORKFLOW
   ================================================================ */

/**
 * Default expiration window for pending actions (24 hours in milliseconds).
 * Extracted as a constant to ensure consistency between schema defaults
 * and runtime action creation.
 */
const PENDING_ACTION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Create a pending action that requires multi-party approval.
 *
 * FLOW:
 * 1. Validate the requestor has permission per the policy
 * 2. Check lockout safety for admin-affecting actions
 * 3. Create the pending action record
 * 4. Log the request in the audit trail
 */
const createPendingAction = async (actionType, requestorId, payload, reason, ip) => {
  const policy = await getPolicy(actionType);

  if (!policy) {
    throw new Error(`No governance policy found for action: ${actionType}`);
  }

  const requestor = await User.findById(requestorId).lean();

  if (!requestor || !policy.allowedRequestors.includes(requestor.role)) {
    throw new Error('You do not have permission to request this action');
  }

  // For admin-affecting actions, check lockout safety
  if (['DELETE_ADMIN', 'DEMOTE_ADMIN', 'DEACTIVATE_ADMIN'].includes(actionType)) {
    const safety = await checkAdminCountSafety(payload.targetUserId, actionType);
    if (!safety.safe) {
      throw new Error(
        `Action blocked: would reduce active admins below minimum (${MIN_ACTIVE_ADMINS}). ` +
        `Current active admins: ${safety.currentCount}`
      );
    }
  }

  const pendingAction = await PendingAction.create({
    actionType,
    requestedBy: requestorId,
    actionPayload: payload,
    reason,
    requiredApprovals: policy.requiredApprovals,
    requestIp: ip,
    expiresAt: new Date(Date.now() + PENDING_ACTION_EXPIRY_MS),
  });

  await appendAuditLog(
    'PENDING_ACTION_CREATED',
    'GOVERNANCE',
    { actionType, actionId: pendingAction._id.toString(), reason, payload },
    ip,
    requestorId
  );

  return pendingAction;
};

/**
 * Approve a pending action. If quorum is reached, marks it as approved
 * and schedules execution after the policy delay.
 */
const approvePendingAction = async (actionId, approverId, comment, ip) => {
  const pendingAction = await PendingAction.findById(actionId);

  if (!pendingAction) {
    throw new Error('Pending action not found');
  }

  if (pendingAction.status !== 'pending') {
    throw new Error(`Cannot approve action with status: ${pendingAction.status}`);
  }

  if (pendingAction.isExpired()) {
    pendingAction.status = 'expired';
    await pendingAction.save();
    throw new Error('This pending action has expired');
  }

  const policy = await getPolicy(pendingAction.actionType);

  if (!policy) {
    throw new Error('Governance policy not found for this action');
  }

  const approver = await User.findById(approverId).lean();

  if (!approver || !policy.allowedApprovers.includes(approver.role)) {
    throw new Error('You do not have permission to approve this action');
  }

  // Separation of powers: requestor cannot approve their own action (unless policy allows)
  if (
    !policy.selfApprovalAllowed &&
    pendingAction.requestedBy.toString() === approverId.toString()
  ) {
    throw new Error('You cannot approve your own request (separation of powers)');
  }

  // Prevent duplicate approvals
  if (pendingAction.hasUserApproved(approverId)) {
    throw new Error('You have already approved this action');
  }

  // Re-check admin count safety at approval time (state may have changed)
  if (['DELETE_ADMIN', 'DEMOTE_ADMIN', 'DEACTIVATE_ADMIN'].includes(pendingAction.actionType)) {
    const safety = await checkAdminCountSafety(
      pendingAction.actionPayload.targetUserId,
      pendingAction.actionType
    );
    if (!safety.safe) {
      throw new Error(
        `Approval blocked: action would now reduce active admins below minimum (${MIN_ACTIVE_ADMINS})`
      );
    }
  }

  pendingAction.approvals.push({
    userId: approverId,
    approvedAt: new Date(),
    comment: comment || '',
  });

  // Check if quorum is now reached
  if (pendingAction.hasQuorum()) {
    pendingAction.status = 'approved';
    pendingAction.approvedAt = new Date();
    pendingAction.scheduledExecutionAt = new Date(
      Date.now() + (policy.executionDelaySecs || 0) * 1000
    );
  }

  await pendingAction.save();

  await appendAuditLog(
    'PENDING_ACTION_APPROVED',
    'GOVERNANCE',
    {
      actionId: pendingAction._id.toString(),
      actionType: pendingAction.actionType,
      approver: approverId.toString(),
      totalApprovals: pendingAction.approvals.length,
      quorumReached: pendingAction.hasQuorum(),
      comment,
    },
    ip,
    approverId
  );

  return pendingAction;
};

/**
 * Veto a pending action. Permanently blocks it from execution.
 * Any admin can veto any pending action.
 *
 * WHY: Veto power ensures that even if multiple admins collude,
 * a single honest admin can stop a harmful action.
 */
const vetoPendingAction = async (actionId, vetoerId, reason, ip) => {
  const pendingAction = await PendingAction.findById(actionId);

  if (!pendingAction) {
    throw new Error('Pending action not found');
  }

  if (!['pending', 'approved'].includes(pendingAction.status)) {
    throw new Error(`Cannot veto action with status: ${pendingAction.status}`);
  }

  // If approved but not yet executed, check if still within execution delay
  if (pendingAction.status === 'approved' && pendingAction.scheduledExecutionAt) {
    if (new Date() >= pendingAction.scheduledExecutionAt) {
      throw new Error('Cannot veto: execution delay has passed');
    }
  }

  const vetoer = await User.findById(vetoerId).lean();

  if (!vetoer || vetoer.role !== 'admin') {
    throw new Error('Only administrators can veto actions');
  }

  pendingAction.status = 'vetoed';
  pendingAction.vetoedBy = vetoerId;
  pendingAction.vetoReason = reason;
  pendingAction.vetoedAt = new Date();
  await pendingAction.save();

  await appendAuditLog(
    'PENDING_ACTION_VETOED',
    'GOVERNANCE',
    {
      actionId: pendingAction._id.toString(),
      actionType: pendingAction.actionType,
      vetoer: vetoerId.toString(),
      reason,
    },
    ip,
    vetoerId
  );

  return pendingAction;
};

/**
 * Cancel a pending action. Only the original requestor can cancel.
 */
const cancelPendingAction = async (actionId, userId, ip) => {
  const pendingAction = await PendingAction.findById(actionId);

  if (!pendingAction) {
    throw new Error('Pending action not found');
  }

  if (pendingAction.status !== 'pending') {
    throw new Error(`Cannot cancel action with status: ${pendingAction.status}`);
  }

  if (pendingAction.requestedBy.toString() !== userId.toString()) {
    throw new Error('Only the original requestor can cancel this action');
  }

  pendingAction.status = 'cancelled';
  await pendingAction.save();

  await appendAuditLog(
    'PENDING_ACTION_CANCELLED',
    'GOVERNANCE',
    { actionId: pendingAction._id.toString(), actionType: pendingAction.actionType },
    ip,
    userId
  );

  return pendingAction;
};

/**
 * Expire stale pending actions.
 * Called periodically (or on-demand) to clean up expired actions.
 */
const expireStaleActions = async () => {
  const now = new Date();
  const result = await PendingAction.updateMany(
    { status: 'pending', expiresAt: { $lt: now } },
    { $set: { status: 'expired', updatedAt: now } }
  );
  return result.modifiedCount;
};

module.exports = {
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
};
