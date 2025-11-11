// models/Cart.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  variant: {
    name: String,
    value: String,
    price: Number
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: true });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  summary: {
    itemsCount: {
      type: Number,
      default: 0
    },
    totalQuantity: {
      type: Number,
      default: 0
    },
    subtotal: {
      type: Number,
      default: 0
    },
    shipping: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  coupon: {
    code: String,
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    discountValue: Number,
    maxDiscount: Number
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate cart totals
cartSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

// Instance method to calculate cart totals
cartSchema.methods.calculateTotals = function() {
  let itemsCount = 0;
  let totalQuantity = 0;
  let subtotal = 0;

  this.items.forEach(item => {
    itemsCount += 1;
    totalQuantity += item.quantity;
    subtotal += (item.price * item.quantity);
  });

  // Calculate discount
  let discount = 0;
  if (this.coupon && this.coupon.code) {
    if (this.coupon.discountType === 'percentage') {
      discount = (subtotal * this.coupon.discountValue) / 100;
      if (this.coupon.maxDiscount && discount > this.coupon.maxDiscount) {
        discount = this.coupon.maxDiscount;
      }
    } else if (this.coupon.discountType === 'fixed') {
      discount = this.coupon.discountValue;
    }
  }

  // Calculate shipping (example logic - you can customize this)
  const shipping = subtotal > 500 ? 0 : 40; // Free shipping above 500

  // Calculate tax (example: 10% tax)
  const tax = (subtotal - discount) * 0.1;

  const total = Math.max(0, subtotal - discount + shipping + tax);

  this.summary = {
    itemsCount,
    totalQuantity,
    subtotal,
    shipping,
    tax,
    discount,
    total
  };

  this.lastUpdated = new Date();
};

// Instance method to add item to cart
cartSchema.methods.addItem = function(itemData) {
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === itemData.product.toString() &&
    this.isVariantEqual(item.variant, itemData.variant)
  );

  if (existingItemIndex > -1) {
    // Update quantity if item already exists
    this.items[existingItemIndex].quantity += itemData.quantity;
  } else {
    // Add new item
    this.items.push(itemData);
  }

  this.calculateTotals();
};

// Instance method to update item quantity
cartSchema.methods.updateItemQuantity = function(productId, variant, quantity) {
  const item = this.items.find(item => 
    item.product.toString() === productId.toString() &&
    this.isVariantEqual(item.variant, variant)
  );

  if (item) {
    if (quantity <= 0) {
      this.removeItem(productId, variant);
    } else {
      item.quantity = quantity;
      this.calculateTotals();
    }
  }
};

// Instance method to remove item from cart
cartSchema.methods.removeItem = function(productId, variant) {
  this.items = this.items.filter(item => 
    !(item.product.toString() === productId.toString() &&
    this.isVariantEqual(item.variant, variant))
  );
  this.calculateTotals();
};

// Instance method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.coupon = undefined;
  this.calculateTotals();
};

// Helper method to compare variants
cartSchema.methods.isVariantEqual = function(variant1, variant2) {
  if (!variant1 && !variant2) return true;
  if (!variant1 || !variant2) return false;
  
  return variant1.name === variant2.name && variant1.value === variant2.value;
};

// Static method to get cart by user ID
cartSchema.statics.findByUserId = function(userId) {
  return this.findOne({ user: userId }).populate('items.product', 'name images inventory status price');
};

cartSchema.index({ user: 1 });
cartSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days

module.exports = mongoose.model('Cart', cartSchema);