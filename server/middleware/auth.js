const jwt = require('jsonwebtoken');
const ErrorHandler = require('../middleware/errorHandler');
const catchAsyncError = require('../middleware/catchAsyncError');
const User = require('../models/User');

exports.auth = (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};


exports.authMiddleware = catchAsyncError(async (req, res, next) => {
  let token;
  // console.log(req.cookies);

  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ErrorHandler('Access Token Expired', 401));
  }

  try {
    const decoded = await jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (!decoded) {
      return next(new ErrorHandler('Invalid Token', 401));
    }
    const userCheck = await User.findOne({ email: decoded.email });

    req.user = {
      userId: userCheck._id,
      name: userCheck.name,
      email: userCheck.email,
      role: userCheck.role
    };
    next();
  } catch (error) {
    return next(new ErrorHandler('Access Token Expired', 401));
  }
});