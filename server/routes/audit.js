const express = require('express');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get audit logs for current user
router.get('/my-logs', async (req, res) => {
  try {
    const { limit = 100, eventType, severity, startDate, endDate } = req.query;

    const query = { userId: req.userId };

    if (eventType) {
      query.eventType = eventType;
    }

    if (severity) {
      query.severity = severity;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(logs);
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get security events (warnings and errors)
router.get('/security-events', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const logs = await AuditLog.find({
      severity: { $in: ['WARNING', 'ERROR', 'CRITICAL'] }
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'username');

    res.json(logs);
  } catch (error) {
    logger.error('Get security events error:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

module.exports = router;

