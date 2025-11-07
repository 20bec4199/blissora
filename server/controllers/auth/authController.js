const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const catchAsyncError = require('../../middleware/catchAsyncError');
const ErrorHandler = require('../../middleware/errorHandler');
const { generateAuthTokens, verifyToken} = require('../../utils/generateToken');

exports.register = catchAsyncError(async (req, res, next) => {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
        return next(new ErrorHandler('User already exists', 400));
    }

    const user = await User.create({
        name,
        email,
        password
    });

    if(user){
        const { refreshToken, accessToken } = await generateAuthTokens({
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        });

        await user.setRefreshToken(refreshToken);

        res.cookie('refreshToken', refreshToken, {
            maxAge: 35 * 60 * 1000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            httpOnly: true,
            priority: 'high'
        });

        res.cookie('accessToken', accessToken, {
            maxAge: 15 * 60 * 1000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            httpOnly: true,
            priority: 'high'
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar
          });
    }
});


exports.login = catchAsyncError(async (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if(err) {
            return next(err);
        }
        if(!user) {
            return res.status(400).json({ message: info.message});
        }

        const {refreshToken, accessToken} = generateAuthTokens({
            user: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        });

        await user.setRefreshToken(refreshToken);

        res.cookie('refreshToken', refreshToken, {
            maxAge: 35 * 60 * 1000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            httpOnly: true,
            priority: 'high'
        });

        res.cookie('accessToken', accessToken, {
            maxAge: 15 * 60 * 1000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            httpOnly: true,
            priority: 'high'
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar
          });
    })(req, res, next);
});

exports.googleCallback = catchAsyncError(async (req, res, next) => {
    try{
        const user = req.user;

        if (!user) {
            return res.redirect(`${process.env.CLIENT_URL  || 'http://localhost:5173'}/auth/error?message=Authentication failed`);
        }

        const { refreshToken, accessToken } = generateAuthTokens({
         userId: user._id,
         name: user.name,
         email: user.email,
         role: user.role
        });

        await user.setRefreshToken(refreshToken);

        res.cookie('refreshToken', refreshToken, {
            maxAge: 35 * 60 * 1000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            httpOnly: true,
            priority: 'high'
        });

        res.cookie('accessToken', accessToken, { 
            maxAge: 15 * 60 * 1000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            httpOnly: true,
            priority: 'high'
        });
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/success`);
        
    } catch (error) {
        console.log('Google OAuth callback error:', error);
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/error?message=Authentication failed`);
    }
});

exports.logout = catchAsyncError(async (req, res, next) => {
    const { refreshToken} = req.cookies;
    if (!refreshToken) {
        return next(new ErrorHandler('session already expired', 401));
    }

    const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findOne({ email: decoded.email });
    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    user.refreshToken = null;
    user.refreshTokenExpires = null;

    res.clearCookie('refreshToken', { httpOnly: true});
    res.clearCookie('accessToken', { httpOnly: true});
    res.status(200).json({
        message: 'Logged out successfully'
    })
});