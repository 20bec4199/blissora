const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String
  },
  googleId: {
    type: String
  },
  avatar: {
    type: String
  },
  profile: {
    phone: String,
    avatar: String,
    dateOfBirth: Date
  },
  address: [{
    type: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'home'
    },
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
    isDefault: Boolean
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  sellerProfile: {
    storeName: String,
    storeDescription: String,
    businessEmail: String,
    taxId: String,
    isApproved: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      default: 0
    },
    totalSales: {
      type: Number,
      default: 0
    }
  },
  preferences: {
    newsletter: {
      type: Boolean,
      default: true
    },
    notifications: {
      type: Boolean,
      default: true
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'seller'],
    default: 'user'
  },
  refreshToken: {
    type: String,
    select: false
  },
  refreshTokenExpires: {
    type: Date,
    select: false
  },
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.setRefreshToken = async function (token) {
  const salt = await bcrypt.genSalt(10);
  this.refreshToken = await bcrypt.hash(token, salt);
  this.refreshTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
  await this.save();
}

UserSchema.methods.isValidRefreshToken = async function (token) {
  return await bcrypt.compare(token, this.refreshToken);
}

module.exports = mongoose.model('User', UserSchema);