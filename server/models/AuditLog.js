const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true }, // LOGIN, CREATE_USER, CREATE_SITE, ASSIGN_ENGINEER, SUBMIT_REPORT, APPROVE_REPORT, REJECT_REPORT
  resource: { type: String, required: true }, // USER, SITE, REPORT, AUTH
  resourceId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
