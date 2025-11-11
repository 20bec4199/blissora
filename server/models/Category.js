// models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  image: {
    url: String,
    alt: String
  },
  seo: {
    metaTitle: String,
    metaDescription: String
  },
  attributes: [{
    name: String,
    type: {
      type: String,
      enum: ['text', 'number', 'select', 'boolean']
    },
    values: [String], // For select type
    isRequired: {
      type: Boolean,
      default: false
    },
    isFilterable: {
      type: Boolean,
      default: true
    }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  productCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Virtual for child categories
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Virtual for products in this category
categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category'
});

// Pre-save middleware to update slug if name changes
categorySchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  }
  next();
});

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function() {
  const categories = await this.find({ status: 'active' })
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  const buildTree = (parentId = null) => {
    return categories
      .filter(cat => {
        if (parentId === null) return !cat.parent;
        return cat.parent && cat.parent.toString() === parentId.toString();
      })
      .map(cat => ({
        ...cat,
        children: buildTree(cat._id)
      }));
  };

  return buildTree();
};

// Static method to get categories with product count
categorySchema.statics.getCategoriesWithCount = async function() {
  const Product = mongoose.model('Product');
  
  const categories = await this.aggregate([
    { $match: { status: 'active' } },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: 'category',
        as: 'products'
      }
    },
    {
      $project: {
        name: 1,
        slug: 1,
        parent: 1,
        image: 1,
        displayOrder: 1,
        featured: 1,
        productCount: { $size: '$products' }
      }
    },
    { $sort: { displayOrder: 1, name: 1 } }
  ]);

  return categories;
};

// Instance method to get breadcrumb
categorySchema.methods.getBreadcrumb = async function() {
  const breadcrumb = [];
  let currentCategory = this;
  
  while (currentCategory) {
    breadcrumb.unshift({
      _id: currentCategory._id,
      name: currentCategory.name,
      slug: currentCategory.slug
    });
    
    if (currentCategory.parent) {
      const Category = mongoose.model('Category');
      currentCategory = await Category.findById(currentCategory.parent);
    } else {
      currentCategory = null;
    }
  }
  
  return breadcrumb;
};

categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ status: 1, displayOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);