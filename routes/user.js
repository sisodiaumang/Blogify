const { Router } = require("express");
const path = require("path");

const User = require("../models/user");
const Blog = require("../models/blog");
const multer = require("multer");
const { uploadOnCloudinary,deleteCloudinary } = require("../services/cloudinary");
const {createTokenForUser} = require("../services/authentication")


const router = Router();



const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.resolve(`./public/uploads/`))
    },
    filename: function (req, file, cb) {
        const fileName = `${Date.now()}-${file.originalname}`;
        cb(null, fileName);
    },
});

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
    await User.create({
        fullName,
        email,
        password
    });
    return res.redirect("/");
});


router.get('/logout', (req, res) => {
    res.clearCookie("token");
    return res.redirect('/');
})

router.get("/:id", async (req, res) => {
    try {
        const allUserBlogs = await Blog.find({
            createdBy: req.params.id
        }).populate("createdBy", "fullName email");

        return res.render("profile", {
            user: req.user,
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
    if(user.profileImagePublicId){
        deleteCloudinary(user.profileImagePublicId);
    }
    if (req.file) {
        const result = await uploadOnCloudinary(`./public/uploads/${req.file.filename}`);
        user.profileImageURL = result.secure_url;
        user.profileImagePublicId = result.public_id;
    }
    await user.save();
    const newToken = createTokenForUser(user);
    res.cookie("token", newToken, {
        httpOnly: true
    });

    res.redirect(`/user/${user._id}`);
});




module.exports = router;