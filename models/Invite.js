const mongoose = require('mongoose');

const InviteSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  uses: {
    type: Number,
    default: 0
  },
  maxUses: {
    type: Number,
    default: 10
  },
  expiresAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rewards: {
    type: Object,
    default: {
      creator: {
        recoveryAttempts: 5,
        role: 'premium'
      },
      user: {
        recoveryAttempts: 3
      }
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Gerar código único
InviteSchema.statics.generateCode = function() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

module.exports = mongoose.models.Invite || mongoose.model('Invite', InviteSchema);