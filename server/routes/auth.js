const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
// Router for authentication-related endpoints
const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, publicKey, keyAlgorithm, keySize } = req.body;

    // Validation
    if (!username || !password || !publicKey) {
      return res.status(400).json({ error: 'Username, password, and publicKey are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      await AuditLog.create({
        eventType: 'AUTH_ATTEMPT',
        ipAddress: req.ip,
        details: { username, reason: 'Username already exists' },
        severity: 'WARNING'
      });
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user (private key never stored on server)
    const user = new User({
      username,
      passwordHash,
      publicKey,
      keyAlgorithm: keyAlgorithm || 'RSA',
      keySize: keySize || 2048
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    await AuditLog.create({
      eventType: 'AUTH_SUCCESS',
      userId: user._id,
      ipAddress: req.ip,
      details: { username },
      severity: 'INFO'
    });

    logger.info('User registered successfully', { username, userId: user._id });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      await AuditLog.create({
        eventType: 'AUTH_FAILURE',
        ipAddress: req.ip,
        details: { username, reason: 'User not found' },
        severity: 'WARNING'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      await AuditLog.create({
        eventType: 'AUTH_FAILURE',
        userId: user._id,
        ipAddress: req.ip,
        details: { username, reason: 'Invalid password' },
        severity: 'WARNING'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    await AuditLog.create({
      eventType: 'AUTH_SUCCESS',
      userId: user._id,
      ipAddress: req.ip,
      details: { username },
      severity: 'INFO'
    });

    logger.info('User logged in successfully', { username, userId: user._id });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user by ID (for public key lookup)
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('username publicKey keyAlgorithm keySize');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Search users by username
router.get('/users/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const users = await User.find({
      username: { $regex: q, $options: 'i' }
    }).select('username publicKey keyAlgorithm').limit(10);

    res.json(users);
  } catch (error) {
    logger.error('User search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;

