const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { marked } = require("marked");


const Blog = require("../models/blog");
const { uploadOnCloudinary, deleteCloudinary } = require("../services/cloudinary");
const Comment = require("../models/comment");
const { findById } = require("../models/user");

const storage = multer.memoryStorage();

const upload = multer({ storage: storage })



const router = Router();



router.get("/add-new", (req, res) => {
    return res.render('addBlog', {
        // user:req.user,
    });
})


router.get("/:id", async (req, res) => {
    const blog = await Blog.findById(req.params.id).populate("createdBy", "fullName profileImageURL bio");
    const htmlContent = marked(blog.body);
    const comments = await Comment.find({
        commentedOn: req.params.id
    }).populate("createdBy", "fullName profileImageURL");
    return res.render("blog", {
        blog,
        htmlContent,
        comments,
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

router.post("/comment/:id", async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
        return res.send("something went wrong");
    }
    const { content } = req.body;

    if (!content) {
        return res.send("something went wrong");
    }

    await Comment.create({
        body: content,
        createdBy: req.user._id,
        commentedOn: req.params.id
    });
    return res.redirect(`/blog/${req.params.id}`);
})

router.post("/comment/edit/:id", async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        
        if (!comment) {
            // Send a 404 status so the frontend 'catch' block triggers
            return res.status(404).send("Comment not found");
        }

        const { content } = req.body;

        comment.body = content;
        await comment.save();
        return res.sendStatus(200); 

    } catch (error) {
        console.error(error);
        return res.status(500).send("Server Error");
    }
});
router.delete("/comment/delete/:id", async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id).populate('createdBy');
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        const isCommentAuthor = comment.createdBy._id.toString() === req.user._id.toString();

        // Also fetch the blog to check if requester is the blog author
        const blog = await Blog.findById(comment.blogId); // adjust field name if needed
        const isBlogAuthor = blog && blog.createdBy.toString() === req.user._id.toString();

        if (!isCommentAuthor && !isBlogAuthor) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        await comment.deleteOne();
        return res.sendStatus(200);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;