const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * AuditLog Model — Immutable, Tamper-Evident Audit Ledger
 *
 * DESIGN PRINCIPLES:
 * - Append-only: entries are never updated or deleted by the application
 * - Cryptographically chained: each entry includes a hash of the previous entry
 * - Tampering is detectable: breaking the chain or modifying an entry invalidates all subsequent hashes
 * - Logs survive partial DB corruption: each entry is independently verifiable against its predecessor
 *
 * CHAIN STRUCTURE:
 *   Entry N:
 *     previousHash = Entry(N-1).entryHash
 *     entryHash    = SHA-256(previousHash + action + resource + user + details + timestamp)
 *
 * INVARIANT: No audit log entry may be modified or deleted. The chain can be verified
 * at any time by walking entries in order and recomputing hashes.
 */
const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },

  // Cryptographic chain fields
  // Hash of the previous audit log entry (genesis entry uses 'GENESIS')
  previousHash: { type: String, default: 'GENESIS' },
  // Hash of this entry (computed from previousHash + content)
  entryHash: { type: String },
  // Monotonic sequence number for ordering verification
  sequenceNumber: { type: Number, index: true },

  createdAt: { type: Date, default: Date.now }
});

/**
 * Compute the SHA-256 hash for this audit log entry.
 * Includes previousHash to form the cryptographic chain.
 */
auditLogSchema.methods.computeHash = function () {
  const payload = [
    this.previousHash || 'GENESIS',
    this.action,
    this.resource,
    this.resourceId || '',
    this.user ? this.user.toString() : 'SYSTEM',
    JSON.stringify(this.details || {}),
    this.ip || '',
    this.createdAt ? this.createdAt.toISOString() : new Date().toISOString(),
    this.sequenceNumber != null ? this.sequenceNumber.toString() : '0',
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * Verify that this entry's hash is valid (not tampered with).
 */
auditLogSchema.methods.verifyIntegrity = function () {
  return this.entryHash === this.computeHash();
};

// Index for efficient chain verification queries
auditLogSchema.index({ createdAt: 1 });
auditLogSchema.index({ sequenceNumber: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
