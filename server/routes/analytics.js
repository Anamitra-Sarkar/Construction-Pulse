const express = require('express');
const router = express.Router();
const QAReport = require('../models/QAReport');
const Site = require('../models/Site');
const { isAdmin } = require('../middleware/auth');

// Admin: Get analytics summary with daily trends and site comparisons
router.get('/summary', isAdmin, async (req, res) => {
  try {
    const totalSites = await Site.countDocuments();
    const activeSites = await Site.countDocuments({ status: { $ne: 'completed' } });
    const totalReports = await QAReport.countDocuments();
    const approvedReports = await QAReport.countDocuments({ status: 'approved' });
    const rejectedReports = await QAReport.countDocuments({ status: 'rejected' });
    const pendingReports = await QAReport.countDocuments({ status: 'pending' });

    // Calculate average compliance
    const reportsWithScores = await QAReport.find({ status: 'approved' }, 'complianceScore');
    const avgCompliance = reportsWithScores.length > 0 
      ? reportsWithScores.reduce((acc, r) => acc + r.complianceScore, 0) / reportsWithScores.length
      : 0;

    // Daily Trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyTrends = await QAReport.aggregate([
      { $match: { submittedAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
          count: { $sum: 1 },
          avgCompliance: { $avg: "$complianceScore" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Site Comparisons - get top performing sites
    const siteComparison = await QAReport.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: "$site",
          report_count: { $sum: 1 },
          avg_compliance: { $avg: "$complianceScore" }
        }
      },
      { $sort: { avg_compliance: -1 } },
      { $limit: 10 }
    ]);

    // Populate site names
    const siteIds = siteComparison.map(s => s._id);
    const sites = await Site.find({ _id: { $in: siteIds } }, 'name');
    const siteMap = {};
    sites.forEach(site => {
      siteMap[site._id.toString()] = site.name;
    });

    const siteComparisonWithNames = siteComparison.map(s => ({
      site_id: s._id.toString(),
      site_name: siteMap[s._id.toString()] || 'Unknown Site',
      report_count: s.report_count,
      avg_compliance: s.avg_compliance
    }));

    res.json({
      overview: {
        totalSites,
        totalReports,
        approvedReports,
        avgCompliance,
        activeSites,
        pendingReports,
        rejectedReports
      },
      dailyTrends: dailyTrends.map(t => ({
        _id: t._id,
        count: t.count,
        avgCompliance: t.avgCompliance || 0
      })),
      siteComparison: siteComparisonWithNames
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get analytics dashboard data
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const totalSites = await Site.countDocuments();
    const activeSites = await Site.countDocuments({ status: { $ne: 'completed' } });
    const totalReports = await QAReport.countDocuments();
    const approvedReports = await QAReport.countDocuments({ status: 'approved' });
    const rejectedReports = await QAReport.countDocuments({ status: 'rejected' });
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

    // Site Comparison - get all sites with their average compliance
    const siteComparison = await QAReport.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: "$site",
          report_count: { $sum: 1 },
          avg_compliance: { $avg: "$complianceScore" }
        }
      },
      { $sort: { avg_compliance: -1 } }
    ]);

    // Populate site names for comparison
    const siteIds = siteComparison.map(s => s._id);
    const sites = await Site.find({ _id: { $in: siteIds } }, 'name');
    const siteMap = {};
    sites.forEach(site => {
      siteMap[site._id.toString()] = site.name;
    });

    const siteComparisonWithNames = siteComparison.map(s => ({
      site_id: s._id.toString(),
      site_name: siteMap[s._id.toString()] || 'Unknown Site',
      report_count: s.report_count,
      avg_compliance: s.avg_compliance
    }));

    res.json({
      summary: {
        totalSites,
        activeSites,
        totalReports,
        averageCompliance: avgCompliance,
        approvedRate: totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0,
        approvedReports,
        rejectedReports,
        pendingReports
      },
      trends: monthlyTrends.map(t => ({
        month: new Date(t._id.year, t._id.month - 1).toLocaleString('default', { month: 'short' }),
        score: Math.round(t.avgScore),
        count: t.count
      })),
      dailyTrends: [],
      distribution: siteDistribution.map(d => ({
        name: d._id.replace('_', ' ').toUpperCase(),
        value: d.count
      })),
      siteComparison: siteComparisonWithNames
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
