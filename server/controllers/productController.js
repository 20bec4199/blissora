// controllers/productController.js
const Product = require('../models/Product');
const Category = require('../models/Category');
const { cache } = require('../services/cacheService');

const productController = {
  // Get all products with advanced filtering
  async getProducts(req, res, next) {
    try {
      const {
        page = 1,
        limit = 12,
        category,
        seller,
        minPrice,
        maxPrice,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        status = 'active'
      } = req.query;

      const cacheKey = `products:${JSON.stringify(req.query)}`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const filter = { status };
      if (category) filter.category = category;
      if (seller) filter.seller = seller;
      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
      }
      if (search) {
        filter.$text = { $search: search };
      }

      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
      
      const products = await Product.find(filter)
        .populate('seller', 'name sellerProfile.storeName')
        .populate('category', 'name')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await Product.countDocuments(filter);

      const result = {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };

      await cache.set(cacheKey, JSON.stringify(result), 300); // Cache for 5 minutes
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // Get single product with related products
  async getProduct(req, res, next) {
    try {
      const { id } = req.params;
      
      const product = await Product.findById(id)
        .populate('seller', 'name sellerProfile rating')
        .populate('category', 'name')
        .lean();

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Get related products
      const relatedProducts = await Product.find({
        category: product.category,
        _id: { $ne: product._id },
        status: 'active'
      })
      .limit(4)
      .select('name price images rating')
      .lean();

      res.json({
        product,
        relatedProducts
      });
    } catch (error) {
      next(error);
    }
  },

  // Create product (Seller only)
  async createProduct(req, res, next) {
    try {
      const productData = {
        ...req.body,
        seller: req.user.id
      };

      const product = new Product(productData);
      await product.save();

      // Invalidate relevant caches
      await cache.deletePattern('products:*');
      
      res.status(201).json({
        message: 'Product created successfully',
        product
      });
    } catch (error) {
      next(error);
    }
  },

  // Update product (Seller only)
  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      
      const product = await Product.findOne({
        _id: id,
        seller: req.user.id
      });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      Object.assign(product, req.body);
      await product.save();

      // Invalidate caches
      await cache.deletePattern('products:*');
      await cache.delete(`product:${id}`);

      res.json({
        message: 'Product updated successfully',
        product
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = productController;