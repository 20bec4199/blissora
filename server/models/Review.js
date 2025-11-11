// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  images: [{
    url: String,
    alt: String
  }],
  verifiedPurchase: {
    type: Boolean,
    default: false
  },
  helpful: {
    count: {
      type: Number,
      default: 0
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  report: {
    count: {
      type: Number,
      default: 0
    },
    reasons: [String],
    reportedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'spam'],
    default: 'pending'
  },
  moderatorNotes: String,
  featured: {
    type: Boolean,
    default: false
  },
  sellerResponse: {
    comment: String,
    respondedAt: Date,
    isPublic: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Compound index to ensure one review per product per user
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Index for efficient querying
reviewSchema.index({ product: 1, status: 1, rating: 1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware to verify purchase
reviewSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Order = mongoose.model('Order');
    const order = await Order.findOne({
      _id: this.order,
      user: this.user,
      status: 'delivered',
      'items.product': this.product
    });
    
    this.verifiedPurchase = !!order;
  }
  next();
});

// Post-save middleware to update product rating
reviewSchema.post('save', async function() {
  if (this.status === 'approved') {
    await this.updateProductRating();
  }
});

// Post-remove middleware to update product rating
reviewSchema.post('remove', async function() {
  await this.updateProductRating();
});

// Instance method to update product rating
reviewSchema.methods.updateProductRating = async function() {
  const Review = mongoose.model('Review');
  const Product = mongoose.model('Product');
  
  const stats = await Review.aggregate([
    {
      $match: {
        product: this.product,
        status: 'approved'
      }
    },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (stats.length > 0) {
    const { averageRating, reviewCount, ratingDistribution } = stats[0];
    
    // Calculate rating distribution
    const distribution = {
      1: ratingDistribution.filter(r => r === 1).length,
      2: ratingDistribution.filter(r => r === 2).length,
      3: ratingDistribution.filter(r => r === 3).length,
      4: ratingDistribution.filter(r => r === 4).length,
      5: ratingDistribution.filter(r => r === 5).length
    };

    await Product.findByIdAndUpdate(this.product, {
      'rating.average': Math.round(averageRating * 10) / 10, // Round to 1 decimal
      'rating.count': reviewCount,
      'rating.distribution': distribution
    });
  }
};

// Instance method to mark review as helpful
reviewSchema.methods.markHelpful = function(userId) {
  if (!this.helpful.users.includes(userId)) {
    this.helpful.users.push(userId);
    this.helpful.count += 1;
    return true;
  }
  return false;
};

// Instance method to remove helpful mark
reviewSchema.methods.removeHelpful = function(userId) {
  const userIndex = this.helpful.users.indexOf(userId);
  if (userIndex > -1) {
    this.helpful.users.splice(userIndex, 1);
    this.helpful.count = Math.max(0, this.helpful.count - 1);
    return true;
  }
  return false;
};

// Instance method to report review
reviewSchema.methods.report = function(userId, reason) {
  if (!this.report.reportedBy.includes(userId)) {
    this.report.reportedBy.push(userId);
    this.report.reasons.push(reason);
    this.report.count += 1;
    return true;
  }
  return false;
};

// Static method to get product reviews with filters
reviewSchema.statics.getProductReviews = async function(productId, filters = {}) {
  const {
    page = 1,
    limit = 10,
    rating,
    sortBy = 'helpful.count',
    sortOrder = 'desc',
    withImages = false
  } = filters;

  const match = {
    product: mongoose.Types.ObjectId(productId),
    status: 'approved'
  };

  if (rating) {
    match.rating = parseInt(rating);
  }

  if (withImages) {
    match.images = { $exists: true, $ne: [] };
  }

  const reviews = await this.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        'user.password': 0,
        'user.oauthId': 0,
        'user.oauthProvider': 0
      }
    },
    { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit * 1 }
  ]);

  const total = await this.countDocuments(match);

  return {
    reviews,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get review statistics for a product
reviewSchema.statics.getReviewStats = async function(productId) {
  const stats = await this.aggregate([
    {
      $match: {
        product: mongoose.Types.ObjectId(productId),
        status: 'approved'
      }
    },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        },
        withImages: {
          $sum: {
            $cond: [{ $gt: [{ $size: '$images' }, 0] }, 1, 0]
          }
        },
        verifiedPurchases: {
          $sum: {
            $cond: ['$verifiedPurchase', 1, 0]
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      withImages: 0,
      verifiedPurchases: 0
    };
  }

  const { averageRating, totalReviews, ratingDistribution, withImages, verifiedPurchases } = stats[0];

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews,
    ratingDistribution: {
      1: ratingDistribution.filter(r => r === 1).length,
      2: ratingDistribution.filter(r => r === 2).length,
      3: ratingDistribution.filter(r => r === 3).length,
      4: ratingDistribution.filter(r => r === 4).length,
      5: ratingDistribution.filter(r => r === 5).length
    },
    withImages,
    verifiedPurchases
  };
};

module.exports = mongoose.model('Review', reviewSchema);