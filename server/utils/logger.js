const AuditLog = require('../models/AuditLog');

const logAction = async (userId, action, details) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      details
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
};

module.exports = { logAction };
