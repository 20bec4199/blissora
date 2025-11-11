// controllers/orderController.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

const orderController = {
  // Create order from cart
  async createOrder(req, res, next) {
    const session = await Order.startSession();
    session.startTransaction();
    
    try {
      const userId = req.user.id;
      const { shippingAddress, billingAddress, paymentMethod } = req.body;

      // Get user's cart
      const cart = await Cart.findOne({ user: userId })
        .populate('items.product')
        .session(session);

      if (!cart || cart.items.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Cart is empty' });
      }

      // Validate stock and calculate totals
      let subtotal = 0;
      const orderItems = [];

      for (const item of cart.items) {
        const product = item.product;
        
        if (product.inventory.quantity < item.quantity && !product.inventory.allowBackorder) {
          await session.abortTransaction();
          return res.status(400).json({ 
            message: `Insufficient stock for ${product.name}` 
          });
        }

        const itemTotal = product.price * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
          product: product._id,
          seller: product.seller,
          quantity: item.quantity,
          price: product.price,
          total: itemTotal
        });

        // Update product inventory
        if (product.inventory.trackQuantity) {
          product.inventory.quantity -= item.quantity;
          if (product.inventory.quantity <= 0) {
            product.status = 'out_of_stock';
          }
          await product.save({ session });
        }
      }

      // Calculate final total
      const shipping = 0; // Calculate based on logic
      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + shipping + tax;

      // Generate order ID
      const orderId = `ORD${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

      // Create order
      const order = new Order({
        orderId,
        user: userId,
        items: orderItems,
        shippingAddress,
        billingAddress,
        summary: {
          subtotal,
          shipping,
          tax,
          total
        },
        payment: {
          method: paymentMethod,
          status: paymentMethod === 'cod' ? 'pending' : 'completed'
        }
      });

      await order.save({ session });

      // Clear cart
      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();

      res.status(201).json({
        message: 'Order created successfully',
        order
      });

    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  },

  // Get user orders
  async getUserOrders(req, res, next) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const filter = { user: req.user.id };
      if (status) filter.status = status;

      const orders = await Order.find(filter)
        .populate('items.product', 'name images')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await Order.countDocuments(filter);

      res.json({
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Get seller orders
  async getSellerOrders(req, res, next) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      
      const orders = await Order.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.seller': req.user._id } },
        { $group: {
          _id: '$_id',
          orderId: { $first: '$orderId' },
          user: { $first: '$user' },
          items: { $push: '$items' },
          status: { $first: '$status' },
          summary: { $first: '$summary' },
          createdAt: { $first: '$createdAt' }
        }},
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit * 1 }
      ]);

      res.json({ orders });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = orderController;