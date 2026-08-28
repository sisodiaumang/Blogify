const rateLimit = require('express-rate-limit');

// 1. General Global Limiter (Protects server from overall DDoS and scraping)
const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // max 120 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after a minute."
});

// 2. OTP Generation Limiter (Prevents OTP spam and Gmail exhaustion)
const otpRequestLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 4, // Max 4 OTP requests per 10 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many OTP requests. Please wait a few minutes before requesting another OTP.",
    handler: (req, res, next, options) => {
        if (req.accepts('html')) {
            return res.status(429).render('forgotPassword', {
                error: "Too many OTP requests from your IP. Please wait 10 minutes before trying again."
            });
        }
        return res.status(429).json({ error: options.message });
    }
});

// 3. OTP Verification Limiter (Prevents brute-force OTP guessing)
const otpVerifyLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 6, // Max 6 attempts per 10 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many incorrect OTP attempts. Please wait 10 minutes.",
    handler: (req, res, next, options) => {
        if (req.accepts('html')) {
            return res.status(429).render('verifyOtp', {
                error: "Too many failed OTP attempts. Please wait 10 minutes.",
                otpCreatedAt: Date.now()
            });
        }
        return res.status(429).json({ error: options.message });
    }
});

// 4. Auth Limiter (Login & Signup protection against credential stuffing)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // Max 15 attempts per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login/signup attempts. Please try again later.",
    handler: (req, res, next, options) => {
        if (req.accepts('html')) {
            return res.status(429).render('signin', {
                error: "Too many login attempts. Please try again after 15 minutes."
            });
        }
        return res.status(429).json({ error: options.message });
    }
});

// 5. Comment & Interaction Limiter (Prevents automated bot comment spam)
const commentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // Max 20 comments per 5 minutes per user/IP
    standardHeaders: true,
    legacyHeaders: false,
    message: "You are posting comments too fast. Please slow down."
});

module.exports = {
    globalLimiter,
    otpRequestLimiter,
    otpVerifyLimiter,
    authLimiter,
    commentLimiter
};
