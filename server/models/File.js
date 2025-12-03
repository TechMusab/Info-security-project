const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalSize: {
    type: Number,
    required: true
  },
  encryptedSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  // Encrypted file chunks stored as base64
  chunks: [{
    ciphertext: String,
    iv: String,
    authTag: String,
    chunkIndex: Number
  }],
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('File', fileSchema);

