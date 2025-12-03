const express = require('express');
const KeyExchange = require('../models/KeyExchange');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Initiate key exchange
router.post('/initiate', async (req, res) => {
  try {
    const { responderId, initiatorPublicKey, initiatorSignature } = req.body;

    if (!responderId || !initiatorPublicKey || !initiatorSignature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if responder exists
    const responder = await require('../models/User').findById(responderId);
    if (!responder) {
      return res.status(404).json({ error: 'Responder not found' });
    }

    // Create key exchange record
    const keyExchange = new KeyExchange({
      initiatorId: req.userId,
      responderId,
      initiatorPublicKey,
      initiatorSignature,
      status: 'pending'
    });

    await keyExchange.save();

    await AuditLog.create({
      eventType: 'KEY_EXCHANGE_INITIATED',
      userId: req.userId,
      ipAddress: req.ip,
      details: {
        responderId,
        keyExchangeId: keyExchange._id
      },
      severity: 'INFO'
    });

    logger.info('Key exchange initiated', {
      initiatorId: req.userId,
      responderId,
      keyExchangeId: keyExchange._id
    });

    res.status(201).json({
      message: 'Key exchange initiated',
      keyExchangeId: keyExchange._id,
      keyExchange
    });
  } catch (error) {
    logger.error('Key exchange initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate key exchange' });
  }
});

// Respond to key exchange
router.post('/respond', async (req, res) => {
  try {
    const { keyExchangeId, responderPublicKey, responderSignature } = req.body;

    if (!keyExchangeId || !responderPublicKey || !responderSignature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const keyExchange = await KeyExchange.findById(keyExchangeId);

    if (!keyExchange) {
      return res.status(404).json({ error: 'Key exchange not found' });
    }

    if (keyExchange.responderId.toString() !== req.userId.toString()) {
      await AuditLog.create({
        eventType: 'KEY_EXCHANGE_FAILED',
        userId: req.userId,
        ipAddress: req.ip,
        details: {
          reason: 'Unauthorized responder',
          keyExchangeId
        },
        severity: 'WARNING'
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (keyExchange.status !== 'pending') {
      return res.status(400).json({ error: 'Key exchange already completed or expired' });
    }

    // Update with responder's public key and signature
    keyExchange.responderPublicKey = responderPublicKey;
    keyExchange.responderSignature = responderSignature;
    keyExchange.status = 'completed';

    await keyExchange.save();

    await AuditLog.create({
      eventType: 'KEY_EXCHANGE_COMPLETED',
      userId: req.userId,
      ipAddress: req.ip,
      details: {
        keyExchangeId: keyExchange._id,
        initiatorId: keyExchange.initiatorId
      },
      severity: 'INFO'
    });

    logger.info('Key exchange completed', {
      keyExchangeId: keyExchange._id,
      initiatorId: keyExchange.initiatorId,
      responderId: req.userId
    });

    res.json({
      message: 'Key exchange completed',
      keyExchange
    });
  } catch (error) {
    logger.error('Key exchange response error:', error);
    res.status(500).json({ error: 'Failed to respond to key exchange' });
  }
});

// Send key confirmation
router.post('/confirm', async (req, res) => {
  try {
    const { keyExchangeId, keyConfirmation } = req.body;

    if (!keyExchangeId || !keyConfirmation) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const keyExchange = await KeyExchange.findById(keyExchangeId);

    if (!keyExchange) {
      return res.status(404).json({ error: 'Key exchange not found' });
    }

    // Verify user is either initiator or responder
    const isInitiator = keyExchange.initiatorId.toString() === req.userId.toString();
    const isResponder = keyExchange.responderId.toString() === req.userId.toString();

    if (!isInitiator && !isResponder) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    keyExchange.keyConfirmation = keyConfirmation;
    await keyExchange.save();

    res.json({
      message: 'Key confirmation received',
      keyExchange
    });
  } catch (error) {
    logger.error('Key confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm key exchange' });
  }
});

// Get key exchanges involving current user (pending or recently completed)
router.get('/pending', async (req, res) => {
  try {
    const exchanges = await KeyExchange.find({
      $or: [
        { initiatorId: req.userId },
        { responderId: req.userId }
      ],
      status: { $in: ['pending', 'completed'] },
      expiresAt: { $gt: new Date() }
    })
      .sort({ timestamp: -1 })
      .populate('initiatorId', 'username')
      .populate('responderId', 'username');

    res.json(exchanges);
  } catch (error) {
    logger.error('Get pending exchanges error:', error);
    res.status(500).json({ error: 'Failed to fetch key exchanges' });
  }
});

// Get completed key exchange
router.get('/:keyExchangeId', async (req, res) => {
  try {
    const keyExchange = await KeyExchange.findById(req.params.keyExchangeId);

    if (!keyExchange) {
      return res.status(404).json({ error: 'Key exchange not found' });
    }

    // Verify user is part of this exchange
    const isInitiator = keyExchange.initiatorId.toString() === req.userId.toString();
    const isResponder = keyExchange.responderId.toString() === req.userId.toString();

    if (!isInitiator && !isResponder) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(keyExchange);
  } catch (error) {
    logger.error('Get key exchange error:', error);
    res.status(500).json({ error: 'Failed to fetch key exchange' });
  }
});

module.exports = router;

