const mongoose = require('mongoose');

const keyExchangeSchema = new mongoose.Schema({
  initiatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  responderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // ECDH public key exchange
  initiatorPublicKey: {
    type: String,
    required: true
  },
  responderPublicKey: {
    type: String,
    default: null
  },
  // Digital signatures for authenticity
  initiatorSignature: {
    type: String,
    required: true
  },
  responderSignature: {
    type: String,
    default: null
  },
  // Key confirmation
  keyConfirmation: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  }
}, {
  timestamps: true
});

// Index for efficient lookups
keyExchangeSchema.index({ initiatorId: 1, responderId: 1, status: 1 });
keyExchangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('KeyExchange', keyExchangeSchema);

