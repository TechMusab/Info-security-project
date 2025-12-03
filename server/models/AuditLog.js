const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'AUTH_ATTEMPT',
      'AUTH_SUCCESS',
      'AUTH_FAILURE',
      'KEY_EXCHANGE_INITIATED',
      'KEY_EXCHANGE_COMPLETED',
      'KEY_EXCHANGE_FAILED',
      'MESSAGE_SENT',
      'MESSAGE_DECRYPTION_FAILED',
      'REPLAY_ATTACK_DETECTED',
      'INVALID_SIGNATURE',
      'FILE_UPLOADED',
      'FILE_DOWNLOADED',
      'METADATA_ACCESS'
    ],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  ipAddress: {
    type: String,
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  severity: {
    type: String,
    enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
    default: 'INFO',
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

