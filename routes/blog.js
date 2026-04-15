const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { marked } = require("marked");


const Blog = require("../models/blog");
const { uploadOnCloudinary, deleteCloudinary } = require("../services/cloudinary");


const storage = multer.memoryStorage();

const upload = multer({ storage: storage })



const router = Router();



router.get("/add-new", (req, res) => {
    return res.render('addBlog', {
        // user:req.user,
    });
})


router.get("/:id", async (req, res) => {
    const blog = await Blog.findById(req.params.id).populate("createdBy", "fullName profileImageURL");
    const htmlContent = marked(blog.body);

    return res.render("blog", {
        blog,
        htmlContent,
        // user:req.user,

    });
})

router.post("/", upload.single("coverImage"), async (req, res) => {
    const {
        title,
        body,
    } = req.body;
    let coverImageURL;
    let coverImagePublicId;
    if (req.file?.buffer) {
        const result = await uploadOnCloudinary(req.file.buffer);
        coverImageURL = result.secure_url;
        coverImagePublicId = result.public_id;
    }

    const blog = await Blog.create({
        title,
        body,
        createdBy: req.user._id,
        coverImageURL: coverImageURL,
        coverImagePublicId: coverImagePublicId,
    })

    return res.redirect(`blog/${blog._id}`);
})



router.get("/edit/:id", async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    return res.render("editBlog", {
        blog,

        // user:req.user

    });
})

router.patch("/edit/:id", upload.single("coverImage"), async (req, res) => {
    const { title, body } = req.body;
    const blog = await Blog.findById(req.params.id);

    if (!blog || blog.createdBy.toString() !== req.user._id.toString()) return res.redirect("/");



    if (req.file?.buffer) {
        if (blog.coverImagePublicId) {
            try {
                await deleteCloudinary(blog.coverImagePublicId);
            } catch (err) {
                console.log("Old image delete failed");
            }
        }

        const result = await uploadOnCloudinary(req.file.buffer);

        blog.coverImageURL = result.secure_url;
        blog.coverImagePublicId = result.public_id;
    }

    blog.title = title;
    blog.body = body;

    await blog.save();

    return res.redirect(`/blog/${blog._id}`);
});

router.delete("/delete/:id", async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    if (blog.createdBy.toString() !== req.user._id.toString()) {
        return res.redirect("/");
    }
    deleteCloudinary(blog.coverImagePublicId);
    await blog.deleteOne();
    return res.redirect(`/`);
});

module.exports = router;