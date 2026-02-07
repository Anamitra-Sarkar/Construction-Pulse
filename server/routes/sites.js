const express = require('express');
const router = express.Router();
const Site = require('../models/Site');
const Notification = require('../models/Notification');
const { isAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/logger');

// Get all sites (Admin: all, Engineer: assigned)
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'engineer') {
      query = { assignedEngineers: req.user._id };
    }
    const sites = await Site.find(query).populate('assignedEngineers', 'name email').sort({ updatedAt: -1 });
    res.json(sites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Create site
router.post('/', isAdmin, async (req, res) => {
  try {
    const site = await Site.create(req.body);
    await logAction(req.user._id, 'CREATE_SITE', 'SITE', site._id, { name: site.name });
    res.status(201).json(site);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Update site
router.patch('/:id', isAdmin, async (req, res) => {
  try {
    const site = await Site.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!site) return res.status(404).json({ message: 'Site not found' });
    await logAction(req.user._id, 'UPDATE_SITE', 'SITE', site._id, req.body);
    res.json(site);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Assign engineers to site
router.post('/:id/assign', isAdmin, async (req, res) => {
  try {
    const { engineerIds } = req.body;
    
    // Validate and deduplicate engineer IDs
    if (!Array.isArray(engineerIds)) {
      return res.status(400).json({ message: 'engineerIds must be an array' });
    }
    
    // Remove duplicates to ensure idempotency
    const uniqueEngineerIds = [...new Set(engineerIds)];
    
    const site = await Site.findByIdAndUpdate(
      req.params.id,
      { $set: { assignedEngineers: uniqueEngineerIds, updatedAt: Date.now() } },
      { new: true }
    ).populate('assignedEngineers', 'name email');

    if (!site) return res.status(404).json({ message: 'Site not found' });

    // Send notifications to engineers
    const io = req.app.get('io');
    for (const engineerId of uniqueEngineerIds) {
      const notification = await Notification.create({
        user: engineerId,
        message: `You have been assigned to site: ${site.name}`,
        type: 'SITE_ASSIGNMENT',
        link: `/engineer/sites`
      });
      io.to(engineerId.toString()).emit('notification', notification);
    }

    await logAction(req.user._id, 'ASSIGN_ENGINEER', 'SITE', site._id, { engineers: uniqueEngineerIds });
    res.json(site);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Delete site
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const site = await Site.findByIdAndDelete(req.params.id);
    if (!site) return res.status(404).json({ message: 'Site not found' });
    await logAction(req.user._id, 'DELETE_SITE', 'SITE', site._id, { name: site.name });
    res.json({ message: 'Site deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get site by ID
router.get('/:id', async (req, res) => {
  try {
    const site = await Site.findById(req.params.id).populate('assignedEngineers', 'name email');
    if (!site) return res.status(404).json({ message: 'Site not found' });
    res.json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
