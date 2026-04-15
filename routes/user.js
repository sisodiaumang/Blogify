const validator = require("validator");
const { Router } = require("express");
const path = require("path");
const crypto = require("crypto");


const User = require("../models/user");
const Blog = require("../models/blog");
const multer = require("multer");
const { uploadOnCloudinary, deleteCloudinary } = require("../services/cloudinary");
const { createTokenForUser } = require("../services/authentication");
const generateOTP = require("../services/otpGenerator");
const {sendOTP,sendWelcomeEmail} = require("../services/nodeMailer");


const router = Router();



const storage = multer.memoryStorage();

const upload = multer({ storage: storage })


router.get('/signin', (req, res) => {
    return res.render("signin");

})

router.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.render("signin", { error: "Email and Password can not be empty" });
    }

    try {
        const token = await User.matchPasswordAndGenerateToken(email, password);
        return res.cookie('token', token).redirect("/");
    } catch (error) {
        return res.render("signin", { error: "Incorrect Password or Email" });
    };

});


router.get('/signup', (req, res) => {
    return res.render("signup");
})

router.post('/signup', async (req, res) => {
    const { fullName, email, password } = req.body;
    if (!validator.isEmail(email)) {
        return res.status(400).render("signup", { error: "Enter an Valid email" });
    }
    const user = await User.findOne({email});
    if(user){
        return res.render("signup",{error:"Email already exist"});
    }
    await User.create({
        fullName,
        email,
        password,
    });
    await sendWelcomeEmail(email,fullName);
    return res.redirect("/");
});


router.get('/logout', (req, res) => {
    res.clearCookie("token");
    return res.redirect('/');
})

router.get("/forgot-password", (req, res) => {
    return res.render("forgotPassword");
});
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email: `${email}` });
    if (!user) {
        return res.render("forgetPassword", { error: "Account does not exist" });
    }
    const otp = crypto.randomInt(100000, 1000000);
    user.otp = otp;
    user.otpCreatedAt = Date.now();
    await user.save();
    await sendOTP(email, otp);
    return res.render("verifyOtp", {
        otpCreatedAt: user.otpCreatedAt.getTime()
    });
});

router.post("/verifyOtp", async (req, res) => {
    const { otp } = req.body;

    const user = await User.findOne({ otp: otp });

    if (!user) {
        return res.render("verifyOtp", {
            error: "Invalid OTP",
            otpCreatedAt: Date.now() 
        });
    }

    const createdTime = user.otpCreatedAt.getTime();
    const expiryTime = createdTime + 5 * 60 * 1000;

    if (Date.now() > expiryTime) {
        return res.render("verifyOtp", { 
            error: "OTP expired", 
            otpCreatedAt: createdTime 
        });
    }

    return res.redirect(`/user/resetPassword/${user.otp}`);
});

router.get("/resetPassword/:otp", (req, res) => {
    res.render("resetPassword", {
        otp: req.params.otp
    });
});

router.post("/resetPassword/:otp", async (req, res) => {
    const { password, confirmPassword } = req.body;
    if (!password || !confirmPassword) {
        return res.render("resetPassword", { error: "Password can not be empty" });
    }

    if (password !== confirmPassword) {
        return res.render("resetPassword", { error: "Password and Confirm password are not same" });
    }
    const user = await User.findOne({ otp: req.params.otp });
    if (!user) {
        console.log("User not found");
    }
    user.password = confirmPassword;
    user.otp=undefined;
    await user.save();
    return res.redirect("/user/signin");
})

router.get("/settings", (req, res) => {
    // req.user is provided by your auth middleware
    if (!req.user) return res.redirect("/user/signin");
    
    return res.render("accountSetting", {
        // user: req.user
    });
});

router.get("/:id", async (req, res) => {
    try {
        const allUserBlogs = await Blog.find({
            createdBy: req.params.id
        }).populate("createdBy", "fullName email");

        return res.render("profile", {
            // user: req.user,
            blogs: allUserBlogs,
        });

    } catch (err) {
        return res.status(500).send("Something went wrong");
    }
});

router.patch("/update-profile", upload.single("profileImage"), async (req, res) => {
    const { fullName } = req.body;
    const user = await User.findById(req.user._id);

    user.fullName = fullName;
    
    if (req.file?.buffer) {
        if (user.profileImagePublicId) {
            await deleteCloudinary(user.profileImagePublicId);
        }

        const result = await uploadOnCloudinary(req.file.buffer);

        user.profileImageURL = result.secure_url;
        user.profileImagePublicId = result.public_id;
    }
    
    await user.save();

    const newToken = createTokenForUser(user);
    res.cookie("token", newToken).redirect("/user/settings");
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
    res.clearCookie("token").redirect("/user/signup");
});



module.exports = router;