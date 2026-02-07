const mongoose = require('mongoose');

/**
 * SystemSettings Model
 *
 * This collection serves as the single source of truth for system-wide
 * configuration state. The bootstrap document (with _id: 'bootstrap')
 * is the authoritative lock that determines whether the system has been
 * initialized with a super admin account.
 *
 * Why MongoDB and NOT Firebase Auth?
 * - Firebase Auth is an identity provider, not a state store.
 * - Relying on Firebase user existence to decide bootstrap state
 *   causes race conditions and partial-failure inconsistencies.
 * - This document provides an atomic, idempotent lock mechanism.
 */
const systemSettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  bootstrapped: { type: Boolean, required: true, default: false },
  superAdminUid: { type: String, default: null },
  bootstrappedAt: { type: Date, default: null },
}, {
  // `_id: false` prevents Mongoose from auto-generating an ObjectId.
  // We define _id as a String field above to use custom string keys (e.g. 'bootstrap').
  _id: false,
  timestamps: false,
});

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
