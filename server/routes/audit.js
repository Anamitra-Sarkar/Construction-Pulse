const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { isAdmin } = require('../middleware/auth');

// Admin: Get all audit logs
router.get('/', isAdmin, async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
