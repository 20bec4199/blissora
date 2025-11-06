const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();
const { register, login } = require('../controllers/auth/authController');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your_jwt_secret', {
    expiresIn: '7d'
  });
};

// Set JWT Cookie
const setTokenCookie = (res, token) => {
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', register);
// router.post('/register', async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     // Check if user exists
//     const userExists = await User.findOne({ email });
//     if (userExists) {
//       return res.status(400).json({ message: 'User already exists' });
//     }

//     // Create user
//     const user = await User.create({
//       name,
//       email,
//       password
//     });

//     if (user) {
//       const token = generateToken(user._id);
//       setTokenCookie(res, token);

//       res.status(201).json({
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         avatar: user.avatar
//       });
//     }
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', login);
// router.post('/login', (req, res, next) => {
//   passport.authenticate('local', (err, user, info) => {
//     if (err) {
//       return next(err);
//     }
//     if (!user) {
//       return res.status(400).json({ message: info.message });
//     }

//     const token = generateToken(user._id);
//     setTokenCookie(res, token);

//     res.json({
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       avatar: user.avatar
//     });
//   })(req, res, next);
// });

// @desc    Google OAuth
// @route   GET /api/auth/google
// @access  Public
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const token = generateToken(req.user._id);
    setTokenCookie(res, token);
    
    // Redirect to frontend with success
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/success`);
  }
);

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', (req, res) => {
  res.clearCookie('jwt');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;