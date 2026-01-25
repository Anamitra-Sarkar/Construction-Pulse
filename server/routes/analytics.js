const express = require('express');
const router = express.Router();
const QAReport = require('../models/QAReport');
const Site = require('../models/Site');
const { isAdmin } = require('../middleware/auth');

// Admin: Get analytics dashboard data
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const totalSites = await Site.countDocuments();
    const totalReports = await QAReport.countDocuments();
    const approvedReports = await QAReport.countDocuments({ status: 'approved' });
    const pendingReports = await QAReport.countDocuments({ status: 'pending' });

    // Calculate average compliance
    const reportsWithScores = await QAReport.find({ status: 'approved' }, 'complianceScore');
    const avgCompliance = reportsWithScores.length > 0 
      ? Math.round(reportsWithScores.reduce((acc, r) => acc + r.complianceScore, 0) / reportsWithScores.length)
      : 0;

    // Monthly Trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyTrends = await QAReport.aggregate([
      { $match: { submittedAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { month: { $month: "$submittedAt" }, year: { $year: "$submittedAt" } },
          avgScore: { $avg: "$complianceScore" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Site Distribution
    const siteDistribution = await Site.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    res.json({
      summary: {
        totalSites,
        totalReports,
        avgCompliance,
        approvedRate: totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0,
        pendingReports
      },
      trends: monthlyTrends.map(t => ({
        month: new Date(t._id.year, t._id.month - 1).toLocaleString('default', { month: 'short' }),
        score: Math.round(t.avgScore),
        count: t.count
      })),
      distribution: siteDistribution.map(d => ({
        name: d._id.replace('_', ' ').toUpperCase(),
        value: d.count
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
