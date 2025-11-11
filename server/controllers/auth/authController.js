const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const catchAsyncError = require('../../middleware/catchAsyncError');
const ErrorHandler = require('../../middleware/errorHandler');
const { generateAuthTokens, verifyToken } = require('../../utils/generateToken');
const { sendOtpMail } = require('../../email/emailVerify/sendOtpMail');
const { sendSuccessMail } = require('../../email/emailGreetings/successMail');

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

    let options = {
        type: 'registration',
    }

    if (user) {
        sendSuccessMail(user.email, user.name, 'Welcome to Blissora - Registration Successful!', 'Your account has been successfully created. Welcome to our community! You can now access all features and start exploring.',options).catch(error => {
            console.error('Failed to send welcome email:', error);
            // Don't throw error - registration should succeed even if email fails
        });
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
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(400).json({ message: info.message });
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

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            role: user.role
        });
    })(req, res, next);
});

exports.googleCallback = catchAsyncError(async (req, res, next) => {
    try {
        const user = req.user;

        if (!user) {
            return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/error?message=Authentication failed`);
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

exports.refreshToken = catchAsyncError(async (req, res, next) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
        return next(new ErrorHandler('session expired, Please login again', 403));
    }
    const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findOne({ email: decoded.email }).select('+refreshToken +refreshTokenExpires');
    if (!user) {
        return next(new ErrorHandler('Invalid Token', 403));
    }

    if (user.refreshTokenExpires < Date.now()) {
        user.refreshToken = null;
        user.refreshTokenExpires = null;
        await user.save();
        res.clearCookie('refreshToken', { httpOnly: true });
        return next(new ErrorHandler('Refresh Token Expired, Please login again', 403));
    }

    if (!(await user.isValidRefreshToken(refreshToken))) {
        user.refreshToken = null;
        user.refreshTokenExpires = null;
        await user.save();
        res.clearCookie('refreshToken', { httpOnly: true });
        return next(new ErrorHandler('Invalid Refresh Token, Please login again', 403));
    }

    const { refreshToken: newRefreshToken, accessToken } = await generateAuthTokens({
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role
    });

    await user.setRefreshToken(newRefreshToken);

    res.cookie('refreshToken', newRefreshToken, {
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

    res.status(200).json({
        success: true,
        accessToken
    });
});

exports.authMe = catchAsyncError(async (req, res, next) => {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
        return next(new ErrorHandler('session expired, Please login again', 403));
    }

    try {
        const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findOne({ email: decoded.email }).select('+refreshToken +refreshTokenExpires');
        
        if (!user) {
            return next(new ErrorHandler('Invalid Token', 403));
        }

        if (user.refreshTokenExpires < Date.now()) {
            user.refreshToken = null;
            user.refreshTokenExpires = null;
            await user.save();
            res.clearCookie('refreshToken', { httpOnly: true });
            return next(new ErrorHandler('Refresh Token Expired, Please login again', 403));
        }

        if (!(await user.isValidRefreshToken(refreshToken))) {
            user.refreshToken = null;
            user.refreshTokenExpires = null;
            await user.save();
            res.clearCookie('refreshToken', { httpOnly: true });
            return next(new ErrorHandler('Invalid Refresh Token, Please login again', 403));
        }

        const { refreshToken: newRefreshToken, accessToken } = await generateAuthTokens({
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        });

        await user.setRefreshToken(newRefreshToken);

        res.cookie('refreshToken', newRefreshToken, {
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

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            role: user.role
        });

    } catch (error) {
        return next(error);
    }
});

exports.logout = catchAsyncError(async (req, res, next) => {
    const { refreshToken } = req.cookies;
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

    res.clearCookie('refreshToken', { httpOnly: true });
    res.clearCookie('accessToken', { httpOnly: true });
    res.status(200).json({
        message: 'Logged out successfully'
    })
});