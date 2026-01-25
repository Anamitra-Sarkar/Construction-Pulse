const express = require('express');
const router = express.Router();
const QAReport = require('../models/QAReport');
const Site = require('../models/Site');
const Notification = require('../models/Notification');
const User = require('../models/User');
const upload = require('../config/multer');
const { isAdmin, isEngineer } = require('../middleware/auth');
const { logAction } = require('../utils/logger');

// Get all reports (Admin: all, Engineer: own)
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'engineer') {
      query = { engineer: req.user._id };
    }
    const reports = await QAReport.find(query)
      .populate('site', 'name')
      .populate('engineer', 'name')
      .sort({ submittedAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Engineer: Submit report
router.post('/', isEngineer, upload.array('photos', 5), async (req, res) => {
  try {
    const { siteId, checklist } = req.body;
    const parsedChecklist = typeof checklist === 'string' ? JSON.parse(checklist) : checklist;
    
    // Calculate compliance score
    const passCount = parsedChecklist.filter(item => item.status === 'pass').length;
    const totalApplicable = parsedChecklist.filter(item => item.status !== 'n/a').length;
    const complianceScore = totalApplicable > 0 ? Math.round((passCount / totalApplicable) * 100) : 0;

    const photos = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    const report = await QAReport.create({
      site: siteId,
      engineer: req.user._id,
      checklist: parsedChecklist,
      photos,
      complianceScore,
      status: 'pending'
    });

    // Notify admins
    const io = req.app.get('io');
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      const notification = await Notification.create({
        user: admin._id,
        message: `New QA Report submitted by ${req.user.name}`,
        type: 'REPORT_SUBMITTED',
        link: `/admin/reports`
      });
      io.to(admin._id.toString()).emit('notification', notification);
    }

    await logAction(req.user._id, 'SUBMIT_REPORT', 'REPORT', report._id, { siteId });
    res.status(201).json(report);
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(400).json({ message: error.message });
  }
});

// Admin: Review report (approve/reject)
router.patch('/:id/review', isAdmin, async (req, res) => {
  try {
    const { status, adminFeedback } = req.body;
    const report = await QAReport.findById(req.params.id).populate('site engineer');
    
    if (!report) return res.status(404).json({ message: 'Report not found' });

    report.status = status;
    report.adminFeedback = adminFeedback;
    report.reviewedAt = Date.now();
    await report.save();

    // Update site compliance score (average of approved reports)
    const approvedReports = await QAReport.find({ site: report.site._id, status: 'approved' });
    const avgScore = approvedReports.length > 0 
      ? Math.round(approvedReports.reduce((acc, r) => acc + r.complianceScore, 0) / approvedReports.length)
      : 0;
    await Site.findByIdAndUpdate(report.site._id, { complianceScore: avgScore });

    // Notify engineer
    const io = req.app.get('io');
    const notification = await Notification.create({
      user: report.engineer._id,
      message: `Your QA Report for ${report.site.name} has been ${status}`,
      type: 'REPORT_REVIEWED',
      link: `/engineer/reports`
    });
    io.to(report.engineer._id.toString()).emit('notification', notification);

    await logAction(req.user._id, status === 'approved' ? 'APPROVE_REPORT' : 'REJECT_REPORT', 'REPORT', report._id);
    res.json(report);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get report by ID
router.get('/:id', async (req, res) => {
  try {
    const report = await QAReport.findById(req.params.id)
      .populate('site', 'name location')
      .populate('engineer', 'name email');
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
