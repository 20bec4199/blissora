// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  comparePrice: {
    type: Number,
    min: 0
  },
  cost: {
    type: Number,
    min: 0
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: Boolean
  }],
  inventory: {
    sku: String,
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    trackQuantity: {
      type: Boolean,
      default: true
    },
    allowBackorder: {
      type: Boolean,
      default: false
    }
  },
  attributes: [{
    name: String,
    value: String
  }],
  variants: [{
    name: String,
    options: [String],
    prices: Map
  }],
  seo: {
    metaTitle: String,
    metaDescription: String,
    slug: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft', 'out_of_stock'],
    default: 'active'
  },
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  tags: [String],
  isFeatured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Product', productSchema);