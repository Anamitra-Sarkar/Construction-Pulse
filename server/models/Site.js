const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  status: { type: String, enum: ['on-track', 'delayed', 'completed', 'on_hold'], default: 'on-track' },
  assignedEngineers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  description: { type: String },
  complianceScore: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Site', siteSchema);
