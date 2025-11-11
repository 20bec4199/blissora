// services/analyticsService.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

class AnalyticsService {
  async generateSalesReport(startDate, endDate) {
    return await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalSales: { $sum: '$summary.total' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$summary.total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
  }

  async generateProductPerformance() {
    return await Product.aggregate([
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'items.product',
          as: 'orders'
        }
      },
      {
        $project: {
          name: 1,
          price: 1,
          totalSold: { $sum: '$orders.items.quantity' },
          totalRevenue: { 
            $multiply: [
              { $sum: '$orders.items.quantity' },
              '$price'
            ]
          },
          rating: '$rating.average'
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);
  }
}

module.exports = new AnalyticsService();