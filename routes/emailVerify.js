const router = require("express").Router();
const User = require("../models/user");
const {sendWelcomeEmail} = require("../services/nodeMailer");

router.get("/:token", async (req, res) => {
    const { token } = req.params;
    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) {
        return res.status(400).render("verifyEmail", { error: "Invalid verification link" });
    }
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();
    await sendWelcomeEmail(user.email, user.fullName);
    return res.render("emailVerified");
});

module.exports = router;