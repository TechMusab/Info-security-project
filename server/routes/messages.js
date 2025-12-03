const express = require('express');
const Message = require('../models/Message');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Send encrypted message
router.post('/send', async (req, res) => {
  try {
    const { receiverId, ciphertext, iv, authTag, nonce, sequenceNumber, messageType, fileId } = req.body;

    // Validation
    if (!receiverId || !ciphertext || !iv || !authTag || !nonce || sequenceNumber === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for replay attack (nonce must be unique)
    const existingMessage = await Message.findOne({ nonce });
    if (existingMessage) {
      await AuditLog.create({
        eventType: 'REPLAY_ATTACK_DETECTED',
        userId: req.userId,
        ipAddress: req.ip,
        details: {
          nonce,
          reason: 'Duplicate nonce detected'
        },
        severity: 'CRITICAL'
      });
      logger.warn('Replay attack detected', { nonce, userId: req.userId });
      return res.status(400).json({ error: 'Replay attack detected: duplicate nonce' });
    }

    // Check timestamp (reject messages older than 5 minutes)
    const messageTimestamp = new Date();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Create message
    const message = new Message({
      senderId: req.userId,
      receiverId,
      ciphertext,
      iv,
      authTag,
      nonce,
      timestamp: messageTimestamp,
      sequenceNumber,
      messageType: messageType || 'text',
      fileId: fileId || null
    });

    await message.save();

    await AuditLog.create({
      eventType: 'MESSAGE_SENT',
      userId: req.userId,
      ipAddress: req.ip,
      details: {
        receiverId,
        messageId: message._id,
        messageType: message.messageType
      },
      severity: 'INFO'
    });

    logger.info('Message sent', {
      senderId: req.userId,
      receiverId,
      messageId: message._id
    });

    res.status(201).json({
      message: 'Message sent successfully',
      messageId: message._id,
      timestamp: message.timestamp
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error (nonce)
      await AuditLog.create({
        eventType: 'REPLAY_ATTACK_DETECTED',
        userId: req.userId,
        ipAddress: req.ip,
        details: {
          reason: 'Duplicate nonce detected (database constraint)'
        },
        severity: 'CRITICAL'
      });
      return res.status(400).json({ error: 'Replay attack detected: duplicate nonce' });
    }
    logger.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages between current user and another user
router.get('/conversation/:otherUserId', async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const { limit = 50, before } = req.query;

    const query = {
      $or: [
        { senderId: req.userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: req.userId }
      ]
    };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('senderId', 'username')
      .populate('receiverId', 'username');

    await AuditLog.create({
      eventType: 'METADATA_ACCESS',
      userId: req.userId,
      ipAddress: req.ip,
      details: {
        action: 'fetch_conversation',
        otherUserId
      },
      severity: 'INFO'
    });

    res.json(messages.reverse()); // Return in chronological order
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Report decryption failure (for security monitoring)
router.post('/decryption-failure', async (req, res) => {
  try {
    const { messageId, reason } = req.body;

    await AuditLog.create({
      eventType: 'MESSAGE_DECRYPTION_FAILED',
      userId: req.userId,
      ipAddress: req.ip,
      details: {
        messageId,
        reason: reason || 'Unknown'
      },
      severity: 'ERROR'
    });

    logger.warn('Decryption failure reported', {
      userId: req.userId,
      messageId
    });

    res.json({ message: 'Decryption failure logged' });
  } catch (error) {
    logger.error('Log decryption failure error:', error);
    res.status(500).json({ error: 'Failed to log decryption failure' });
  }
});

module.exports = router;

