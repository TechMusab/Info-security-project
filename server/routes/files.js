const express = require('express');
const multer = require('multer');
const File = require('../models/File');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Configure multer for file uploads (but files are already encrypted client-side)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Upload encrypted file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { receiverId, filename, mimeType, originalSize, chunks } = req.body;

    if (!receiverId || !filename || !chunks) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Parse chunks (should be array of encrypted chunks)
    let parsedChunks;
    try {
      parsedChunks = JSON.parse(chunks);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid chunks format' });
    }

    // Validate chunks structure
    if (!Array.isArray(parsedChunks) || parsedChunks.length === 0) {
      return res.status(400).json({ error: 'Chunks must be a non-empty array' });
    }

    // Calculate encrypted size
    const encryptedSize = parsedChunks.reduce((sum, chunk) => {
      return sum + (chunk.ciphertext ? Buffer.from(chunk.ciphertext, 'base64').length : 0);
    }, 0);

    // Create file record
    const file = new File({
      filename,
      originalSize: parseInt(originalSize) || 0,
      encryptedSize,
      mimeType: mimeType || 'application/octet-stream',
      chunks: parsedChunks.map((chunk, index) => ({
        ciphertext: chunk.ciphertext,
        iv: chunk.iv,
        authTag: chunk.authTag,
        chunkIndex: chunk.chunkIndex !== undefined ? chunk.chunkIndex : index
      })),
      senderId: req.userId,
      receiverId
    });

    await file.save();

    await AuditLog.create({
      eventType: 'FILE_UPLOADED',
      userId: req.userId,
      ipAddress: req.ip,
      details: {
        fileId: file._id,
        filename,
        receiverId,
        size: encryptedSize
      },
      severity: 'INFO'
    });

    logger.info('File uploaded', {
      fileId: file._id,
      senderId: req.userId,
      receiverId,
      filename
    });

    res.status(201).json({
      message: 'File uploaded successfully',
      fileId: file._id,
      filename: file.filename
    });
  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Download encrypted file
router.get('/:fileId', async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify user is sender or receiver
    const isSender = file.senderId.toString() === req.userId.toString();
    const isReceiver = file.receiverId.toString() === req.userId.toString();

    if (!isSender && !isReceiver) {
      await AuditLog.create({
        eventType: 'METADATA_ACCESS',
        userId: req.userId,
        ipAddress: req.ip,
        details: {
          action: 'unauthorized_file_access',
          fileId: file._id
        },
        severity: 'WARNING'
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await AuditLog.create({
      eventType: 'FILE_DOWNLOADED',
      userId: req.userId,
      ipAddress: req.ip,
      details: {
        fileId: file._id,
        filename: file.filename
      },
      severity: 'INFO'
    });

    res.json({
      fileId: file._id,
      filename: file.filename,
      mimeType: file.mimeType,
      originalSize: file.originalSize,
      chunks: file.chunks
    });
  } catch (error) {
    logger.error('File download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Get files for current user
router.get('/', async (req, res) => {
  try {
    const files = await File.find({
      $or: [
        { senderId: req.userId },
        { receiverId: req.userId }
      ]
    })
    .sort({ uploadedAt: -1 })
    .populate('senderId', 'username')
    .populate('receiverId', 'username')
    .select('filename mimeType originalSize encryptedSize uploadedAt senderId receiverId');

    res.json(files);
  } catch (error) {
    logger.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

module.exports = router;

