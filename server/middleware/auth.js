const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      await AuditLog.create({
        eventType: 'AUTH_FAILURE',
        ipAddress: req.ip,
        details: { reason: 'No token provided' },
        severity: 'WARNING'
      });
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);

    if (!user) {
      await AuditLog.create({
        eventType: 'AUTH_FAILURE',
        ipAddress: req.ip,
        details: { reason: 'User not found' },
        severity: 'WARNING'
      });
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    await AuditLog.create({
      eventType: 'AUTH_FAILURE',
      ipAddress: req.ip,
      details: { error: error.message },
      severity: 'WARNING'
    });
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticateToken };

