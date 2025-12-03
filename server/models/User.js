const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  passwordHash: {
    type: String,
    required: true
  },
  publicKey: {
    type: String,
    required: true
  },
  // Metadata only - private key never stored on server
  keyAlgorithm: {
    type: String,
    enum: ['RSA', 'ECC'],
    default: 'RSA'
  },
  keySize: {
    type: Number,
    default: 2048
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster lookups
userSchema.index({ username: 1 });

// Method to verify password
userSchema.methods.verifyPassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);

