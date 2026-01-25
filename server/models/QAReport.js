const mongoose = require('mongoose');

const qaReportSchema = new mongoose.Schema({
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  engineer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  checklist: [{
    item: { type: String, required: true },
    status: { type: String, enum: ['pass', 'fail', 'n/a'], required: true },
    comments: { type: String }
  }],
  photos: [{ type: String }],
  complianceScore: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminFeedback: { type: String },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date }
});

module.exports = mongoose.model('QAReport', qaReportSchema);
