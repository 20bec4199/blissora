// controllers/adminController.js
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { generateReports } = require('../services/analyticsService');

const adminController = {
  // Dashboard statistics
  async getDashboardStats(req, res, next) {
    try {
      const [
        totalUsers,
        totalSellers,
        totalProducts,
        totalOrders,
        recentOrders,
        topProducts
      ] = await Promise.all([
        User.countDocuments({ role: 'user' }),
        User.countDocuments({ role: 'seller' }),
        Product.countDocuments({ status: 'active' }),
        Order.countDocuments(),
        Order.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name'),
        Product.find({ status: 'active' })
          .sort({ 'rating.average': -1 })
          .limit(5)
          .select('name price images rating')
      ]);

      // Revenue calculation
      const revenueData = await Order.aggregate([
        { $match: { status: 'delivered' } },
        { $group: {
          _id: null,
          totalRevenue: { $sum: '$summary.total' },
          averageOrderValue: { $avg: '$summary.total' }
        }}
      ]);

      const stats = {
        users: { total: totalUsers, sellers: totalSellers },
        products: totalProducts,
        orders: totalOrders,
        revenue: revenueData[0] || { totalRevenue: 0, averageOrderValue: 0 },
        recentOrders,
        topProducts
      };

      res.json(stats);
    } catch (error) {
      next(error);
    }
  },

  // Generate comprehensive reports
  async generateReports(req, res, next) {
    try {
      const { type, startDate, endDate } = req.query;
      
      const reports = await generateReports(type, startDate, endDate);
      
      res.json({
        message: 'Report generated successfully',
        report: reports
      });
    } catch (error) {
      next(error);
    }
  },

  // Manage sellers
  async manageSellers(req, res, next) {
    try {
      const { action, sellerId } = req.body;
      
      const seller = await User.findById(sellerId);
      if (!seller || seller.role !== 'seller') {
        return res.status(404).json({ message: 'Seller not found' });
      }

      switch (action) {
        case 'approve':
          seller.sellerProfile.isApproved = true;
          break;
        case 'suspend':
          seller.sellerProfile.isApproved = false;
          break;
        case 'delete':
          await User.findByIdAndDelete(sellerId);
          return res.json({ message: 'Seller deleted successfully' });
      }

      await seller.save();
      res.json({ message: `Seller ${action}d successfully` });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = adminController;