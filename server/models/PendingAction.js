const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * PendingAction Model
 *
 * Represents a critical action that requires multi-party approval before execution.
 * This is the core of the Multi-Approval Governance Engine.
 *
 * LIFECYCLE:
 *   pending → approved → executed (or expired/cancelled/vetoed)
 *
 * DESIGN PRINCIPLES:
 * - Critical actions are STAGED, never executed immediately
 * - Multiple independent approvals required (N-of-M quorum)
 * - Approvers must be different from requestor (separation of powers)
 * - Time delays allow observation and veto
 * - All state transitions are audit-logged
 * - Pending actions are visible to all admins for transparency
 *
 * INVARIANTS:
 * - A user cannot approve their own request (unless policy explicitly allows)
 * - The same user cannot approve twice
 * - Expired actions cannot be approved or executed
 * - Vetoed actions are permanently blocked
 */
const pendingActionSchema = new mongoose.Schema({
  // The policy action type this corresponds to (e.g. 'DELETE_ADMIN')
  actionType: { type: String, required: true, index: true },

  // Current status of the pending action
  status: {
    type: String,
    enum: ['pending', 'approved', 'executed', 'cancelled', 'vetoed', 'expired', 'reversed'],
    default: 'pending',
    index: true,
  },

  // Who requested this action
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // The payload/parameters for the action
  actionPayload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },

  // Human-readable reason for the action
  reason: { type: String, required: true },

  // Number of approvals required (captured at creation time from policy)
  requiredApprovals: { type: Number, required: true, min: 1 },

  // List of users who approved this action (with timestamps)
  approvals: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedAt: { type: Date, default: Date.now },
    comment: { type: String, default: '' },
  }],

  // If vetoed, who vetoed and why
  vetoedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vetoReason: { type: String },
  vetoedAt: { type: Date },

  // Execution timestamps
  approvedAt: { type: Date },
  scheduledExecutionAt: { type: Date },
  executedAt: { type: Date },

  // Reversibility
  reversibleUntil: { type: Date },
  reversedAt: { type: Date },
  reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Expiry: pending actions expire if not approved in time
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  },

  // Client IP for audit trail
  requestIp: { type: String },

  // Integrity hash
  integrityHash: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

/**
 * Check if quorum has been reached.
 */
pendingActionSchema.methods.hasQuorum = function () {
  return this.approvals.length >= this.requiredApprovals;
};

/**
 * Check if the action has expired.
 */
pendingActionSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

/**
 * Check if a specific user has already approved.
 */
pendingActionSchema.methods.hasUserApproved = function (userId) {
  return this.approvals.some(
    (a) => a.userId.toString() === userId.toString()
  );
};

/**
 * Check if the action is still within its reversibility window.
 */
pendingActionSchema.methods.isReversible = function () {
  if (!this.reversibleUntil) return false;
  return new Date() < this.reversibleUntil;
};

/**
 * Compute integrity hash before saving.
 */
pendingActionSchema.pre('save', function (next) {
  const payload = `${this.actionType}|${this.status}|${this.requestedBy}|${JSON.stringify(this.actionPayload)}|${this.approvals.length}`;
  this.integrityHash = crypto.createHash('sha256').update(payload).digest('hex');
  this.updatedAt = new Date();
  next();
});

/**
 * Index for finding expired pending actions efficiently.
 */
pendingActionSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('PendingAction', pendingActionSchema);
