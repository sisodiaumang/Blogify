const validator = require("validator");
const { Router } = require("express");
const path = require("path");
const crypto = require("crypto");
const { createAccessTokenForUser } = require("../services/authentication");
const JWT = require("jsonwebtoken");
const User = require("../models/user");
const Blog = require("../models/blog");
const multer = require("multer");
const { uploadOnCloudinary, deleteCloudinary } = require("../services/cloudinary");

const generateOTP = require("../services/otpGenerator");
const { sendOTP, sendWelcomeEmail } = require("../services/nodeMailer");
const { sendConfirmation } = require("../services/nodeMailer");
const {generateEmailConfirmationToken} = require("../services/emailConfirmationToken");

const router = Router();



const storage = multer.memoryStorage();

const upload = multer({ storage: storage })


const { otpRequestLimiter, otpVerifyLimiter, authLimiter } = require("../middleware/rateLimiter");

router.get('/signin', (req, res) => {
    return res.render("signin");
})

router.post('/signin', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.render("signin", { error: "Email and Password can not be empty" });
    }

    try {
        const {
            accessToken,
            refreshToken,
            user
        } = await User.matchPasswordAndGenerateToken(email, password);
        if(user.isVerified === false){
            return res.render("signin", { error: "Please verify your email before signing in." });
        }
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        return res.redirect("/");
    } catch (error) {
        return res.render("signin", { error: "Incorrect Password or Email" });
    };
});

router.get('/signup', (req, res) => {
    return res.render("signup");
})

router.post("/signup", authLimiter, async (req, res) => {
    const { fullName, email, password, confirmPassword } = req.body;

    if (!fullName || !email || !password || !confirmPassword) {
        return res.render("signup", { error: "All fields are required" });
    }
    if (password !== confirmPassword) {
        return res.render("signup", { error: "Password and Confirm Password do not match" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.render("signup", { error: "Account with this email already exists" });
    }

    try {
        const verificationToken = generateEmailConfirmationToken();
        const user = await User.create({
            fullName,
            email,
            password,
            emailVerificationToken: verificationToken,
            isVerified: false
        });

        await sendConfirmation(email, verificationToken);
        return res.render("verifyNotice", { email });
    } catch (err) {
        console.error("Signup error:", err);
        return res.render("signup", { error: "Failed to create account. Please try again." });
    }
});

router.get("/logout", (req, res) => {
    try {
        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
        return res.redirect("/");
    } catch (err) {
        console.log(err);
        return res.redirect("/");
    }
});

// Forgot Password Request (Rate Limited + 60s Cooldown)
router.get("/forgot-password", (req, res) => {
    return res.render("forgotPassword");
});

router.post("/forgot-password", otpRequestLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.render("forgotPassword", { error: "Please provide your email address." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
        return res.render("forgotPassword", { error: "Account with this email does not exist." });
    }

    // 60-second cooldown check to prevent spamming
    if (user.otpCreatedAt && (Date.now() - user.otpCreatedAt.getTime() < 60 * 1000)) {
        const remainingSeconds = Math.ceil((60 * 1000 - (Date.now() - user.otpCreatedAt.getTime())) / 1000);
        return res.render("forgotPassword", { 
            error: `Please wait ${remainingSeconds} seconds before requesting another OTP.` 
        });
    }

    const otp = crypto.randomInt(100000, 1000000);
    user.otp = otp;
    user.otpCreatedAt = new Date();
    user.otpAttempts = 0;
    await user.save();

    await sendOTP(user.email, otp);

    return res.render("verifyOtp", {
        email: user.email,
        otpCreatedAt: user.otpCreatedAt.getTime()
    });
});

// Resend OTP Route (Rate Limited + 60s Cooldown)
router.post("/resend-otp", otpRequestLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.render("forgotPassword", { error: "Session expired. Please enter your email again." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
        return res.render("forgotPassword", { error: "Account not found." });
    }

    // 60-second cooldown check
    if (user.otpCreatedAt && (Date.now() - user.otpCreatedAt.getTime() < 60 * 1000)) {
        const remainingSeconds = Math.ceil((60 * 1000 - (Date.now() - user.otpCreatedAt.getTime())) / 1000);
        return res.render("verifyOtp", {
            email: user.email,
            error: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
            otpCreatedAt: user.otpCreatedAt.getTime()
        });
    }

    const otp = crypto.randomInt(100000, 1000000);
    user.otp = otp;
    user.otpCreatedAt = new Date();
    user.otpAttempts = 0;
    await user.save();

    await sendOTP(user.email, otp);

    return res.render("verifyOtp", {
        email: user.email,
        otpCreatedAt: user.otpCreatedAt.getTime()
    });
});

// Verify OTP (Brute-force protected + Expiration + Max 5 attempts)
router.post("/verifyOtp", otpVerifyLimiter, async (req, res) => {
    const { otp, email } = req.body;

    if (!otp) {
        return res.render("verifyOtp", {
            email,
            error: "Please enter the 6-digit OTP code.",
            otpCreatedAt: Date.now()
        });
    }

    const query = email ? { email: email.trim().toLowerCase() } : { otp: Number(otp) };
    const user = await User.findOne(query);

    if (!user || !user.otp) {
        return res.render("verifyOtp", {
            email,
            error: "Invalid or expired OTP. Please request a new code.",
            otpCreatedAt: Date.now()
        });
    }

    // Max 5 attempts check
    if ((user.otpAttempts || 0) >= 5) {
        user.otp = undefined;
        user.otpCreatedAt = undefined;
        await user.save();
        return res.render("forgotPassword", {
            error: "Too many failed attempts. For security, please request a new OTP."
        });
    }

    // Check expiration (5 minutes)
    const createdTime = user.otpCreatedAt ? user.otpCreatedAt.getTime() : 0;
    if (Date.now() - createdTime > 5 * 60 * 1000) {
        user.otp = undefined;
        await user.save();
        return res.render("verifyOtp", {
            email: user.email,
            error: "OTP has expired. Please click Resend OTP.",
            otpCreatedAt: createdTime
        });
    }

    // Validate OTP match
    if (Number(user.otp) !== Number(otp)) {
        user.otpAttempts = (user.otpAttempts || 0) + 1;
        await user.save();
        const remaining = 5 - user.otpAttempts;
        return res.render("verifyOtp", {
            email: user.email,
            error: `Invalid OTP. ${remaining} attempt(s) remaining.`,
            otpCreatedAt: createdTime
        });
    }

    // OTP Verified successfully -> Generate one-time secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.otp = undefined;
    user.otpAttempts = 0;
    user.resetPasswordToken = resetToken;
    await user.save();

    return res.redirect(`/user/resetPassword/${resetToken}`);
});

router.get("/resetPassword/:token", async (req, res) => {
    const user = await User.findOne({ resetPasswordToken: req.params.token });
    if (!user) {
        return res.render("forgotPassword", {
            error: "Password reset link is invalid or has already been used."
        });
    }
    return res.render("resetPassword", {
        token: req.params.token
    });
});

router.post("/resetPassword/:token", async (req, res) => {
    const { password, confirmPassword } = req.body;
    if (!password || !confirmPassword) {
        return res.render("resetPassword", {
            token: req.params.token,
            error: "Password cannot be empty"
        });
    }

    if (password !== confirmPassword) {
        return res.render("resetPassword", {
            token: req.params.token,
            error: "Password and Confirm password do not match"
        });
    }

    const user = await User.findOne({ resetPasswordToken: req.params.token });
    if (!user) {
        return res.render("forgotPassword", {
            error: "Password reset link is invalid or has already been used."
        });
    }

    user.password = confirmPassword;
    user.resetPasswordToken = undefined;
    await user.save();

    return res.redirect("/user/signin");
});

router.get("/settings", (req, res) => {
    // req.user is provided by your auth middleware
    if (!req.user) return res.redirect("/user/signin");

    return res.render("accountSetting", {
        // user: req.user
    });
});

router.get("/:id", async (req, res) => {
    try {
        const profileUser = await User.findById(req.params.id);
        if (!profileUser) return res.redirect("/");

        const allUserBlogs = await Blog.find({ createdBy: req.params.id });

        return res.render("profile", {
            profileUser: profileUser, // Rename this!
            blogs: allUserBlogs,
            // Notice: We don't pass 'user' here anymore. 
            // res.locals.user handles your navbar session.
        });
    } catch (err) {
        return res.status(500).send("User not found");
    }
});

router.patch("/update-profile", upload.single("profileImage"), async (req, res) => {
    const { fullName, bio } = req.body;
    const user = await User.findById(
        req.user._id
    );

    user.fullName = fullName;
    user.bio = bio;

    if (req.file?.buffer) {
        if (user.profileImagePublicId) {
            await deleteCloudinary(
                user.profileImagePublicId
            );
        }

        const result =
            await uploadOnCloudinary(
                req.file.buffer
            );

        user.profileImageURL = result.secure_url;

        user.profileImagePublicId = result.public_id;
    }

    await user.save();
    return res.redirect(
        "/user/settings"
    );
});

router.delete("/delete-account", async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);
    // Remove Profile Image from Cloudinary
    if (user.profileImagePublicId) await deleteCloudinary(user.profileImagePublicId);

    // Find and delete all blogs by this user (and their images)
    const userBlogs = await Blog.find({ createdBy: userId });
    for (const blog of userBlogs) {
        if (blog.coverImagePublicId) await deleteCloudinary(blog.coverImagePublicId);
        await Blog.findByIdAndDelete(blog._id);
    }

    await User.findByIdAndDelete(userId);
    res.clearCookie("refreshToken").redirect("/user/signup");
});



module.exports = router;