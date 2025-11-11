// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'cod', 'paypal']
  },
  paymentGateway: {
    type: String,
    enum: ['razorpay', 'stripe', 'paypal', 'paytm', 'cod', null],
    default: null
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  gatewayResponse: {
    gatewayPaymentId: String,
    gatewayOrderId: String,
    gatewaySignature: String,
    rawResponse: mongoose.Schema.Types.Mixed
  },
  refunds: [{
    refundId: String,
    amount: Number,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed']
    },
    processedAt: Date,
    gatewayRefundId: String
  }],
  billingAddress: {
    name: String,
    email: String,
    phone: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    }
  },
  cardDetails: {
    last4: String,
    network: String,
    type: String,
    issuer: String
  },
  upiDetails: {
    upiId: String,
    provider: String
  },
  walletDetails: {
    walletName: String,
    mobile: String
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    device: String
  },
  notes: String,
  completedAt: Date,
  failedAt: Date
}, {
  timestamps: true
});

// Pre-save middleware to generate payment ID
paymentSchema.pre('save', function(next) {
  if (!this.paymentId) {
    this.paymentId = `PAY${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Instance method to mark payment as completed
paymentSchema.methods.markAsCompleted = function(gatewayResponse = {}) {
  this.status = 'completed';
  this.gatewayResponse = gatewayResponse;
  this.completedAt = new Date();
};

// Instance method to mark payment as failed
paymentSchema.methods.markAsFailed = function(gatewayResponse = {}) {
  this.status = 'failed';
  this.gatewayResponse = gatewayResponse;
  this.failedAt = new Date();
};

// Instance method to process refund
paymentSchema.methods.processRefund = function(refundData) {
  if (this.status !== 'completed') {
    throw new Error('Cannot refund a payment that is not completed');
  }

  const totalRefunded = this.refunds
    .filter(refund => refund.status === 'processed')
    .reduce((sum, refund) => sum + refund.amount, 0);

  if (totalRefunded + refundData.amount > this.amount) {
    throw new Error('Refund amount exceeds payment amount');
  }

  this.refunds.push({
    ...refundData,
    refundId: `REF${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
    status: 'pending'
  });

  // If full amount is refunded, update payment status
  if (totalRefunded + refundData.amount === this.amount) {
    this.status = 'refunded';
  }
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = async function(timeframe = 'month') {
  const timeFilter = {};
  const now = new Date();
  
  switch (timeframe) {
    case 'day':
      timeFilter.$gte = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      timeFilter.$gte = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      timeFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'year':
      timeFilter.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
  }

  const stats = await this.aggregate([
    { $match: { createdAt: timeFilter } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  const totalStats = await this.aggregate([
    { $match: { createdAt: timeFilter } },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalRevenue: { $sum: '$amount' },
        averageTransaction: { $avg: '$amount' }
      }
    }
  ]);

  return {
    byStatus: stats,
    overview: totalStats[0] || {
      totalTransactions: 0,
      totalRevenue: 0,
      averageTransaction: 0
    }
  };
};

// Static method to find payment by gateway ID
paymentSchema.statics.findByGatewayId = function(gatewayPaymentId) {
  return this.findOne({ 'gatewayResponse.gatewayPaymentId': gatewayPaymentId });
};

paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: 1 });
paymentSchema.index({ 'gatewayResponse.gatewayPaymentId': 1 });

module.exports = mongoose.model('Payment', paymentSchema);