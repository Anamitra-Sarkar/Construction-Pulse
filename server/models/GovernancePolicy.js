const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * GovernancePolicy Model
 *
 * Data-driven authorization policies that define what actions require
 * multi-party approval, what roles can request/approve, execution delays,
 * and reversibility windows.
 *
 * DESIGN PRINCIPLES:
 * - Permissions are data-driven, NOT hardcoded
 * - Policies specify: who can request, who must approve, delay, reversibility
 * - Policy changes are themselves protected actions (self-referential governance)
 * - No single user can unilaterally modify policies
 *
 * INVARIANT: The system ships with default policies that cannot be fully removed.
 * At minimum, critical actions always require multi-party approval.
 */
const governancePolicySchema = new mongoose.Schema({
  // Unique action identifier (e.g. 'DELETE_ADMIN', 'MODIFY_POLICY', 'SYSTEM_RECOVERY')
  actionType: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Human-readable description of what this policy governs
  description: { type: String, required: true },

  // Minimum number of approvals required (the "N" in N-of-M)
  requiredApprovals: { type: Number, required: true, min: 1, default: 2 },

  // Roles that are allowed to REQUEST this action
  allowedRequestors: {
    type: [String],
    required: true,
    default: ['admin'],
  },

  // Roles that are allowed to APPROVE this action
  allowedApprovers: {
    type: [String],
    required: true,
    default: ['admin'],
  },

  // Whether the same user who requested can also approve (always false for critical)
  selfApprovalAllowed: { type: Boolean, default: false },

  // Delay in seconds before an approved action is executed
  // Allows observation and veto during this window
  executionDelaySecs: { type: Number, default: 300, min: 0 },

  // Window in seconds after execution where the action can be reversed
  reversibilityWindowSecs: { type: Number, default: 3600, min: 0 },

  // Whether this policy is a system default (cannot be deleted, only modified)
  isSystemDefault: { type: Boolean, default: false },

  // Whether this policy is currently active
  enabled: { type: Boolean, default: true },

  // Integrity hash for tamper detection
  integrityHash: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

/**
 * Compute integrity hash before saving to detect unauthorized modifications.
 */
governancePolicySchema.pre('save', function (next) {
  const payload = `${this.actionType}|${this.requiredApprovals}|${this.allowedRequestors.join(',')}|${this.allowedApprovers.join(',')}|${this.selfApprovalAllowed}|${this.executionDelaySecs}|${this.reversibilityWindowSecs}|${this.enabled}`;
  this.integrityHash = crypto.createHash('sha256').update(payload).digest('hex');
  this.updatedAt = new Date();
  next();
});

/**
 * Verify that the stored hash matches the current data.
 * Returns false if the document was tampered with outside the application.
 */
governancePolicySchema.methods.verifyIntegrity = function () {
  const payload = `${this.actionType}|${this.requiredApprovals}|${this.allowedRequestors.join(',')}|${this.allowedApprovers.join(',')}|${this.selfApprovalAllowed}|${this.executionDelaySecs}|${this.reversibilityWindowSecs}|${this.enabled}`;
  const computed = crypto.createHash('sha256').update(payload).digest('hex');
  return computed === this.integrityHash;
};

module.exports = mongoose.model('GovernancePolicy', governancePolicySchema);
