const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { marked } = require("marked");

const User = require("../models/user");
const Blog = require("../models/blog");
const { uploadOnCloudinary, deleteCloudinary } = require("../services/cloudinary");
const Comment = require("../models/comment");
const { findById } = require("../models/user");
const { reportToAdmin } = require("../services/nodeMailer");
const { restrictTo } = require("../middleware/authorization");
const { commentLimiter } = require("../middleware/rateLimiter");

const storage = multer.memoryStorage();

const upload = multer({ storage: storage })



const router = Router();


const { getRelatedBlogs, getTrendingBlogs } = require("../services/recommendationEngine");

router.get("/add-new", (req, res) => {
    return res.render('addBlog', {
        // user:req.user,
    });
});

const mongoose = require("mongoose");
const { generateSeoExcerpt, SITE_URL } = require("../services/seoService");
const cacheService = require("../services/cacheService");

router.get(["/:id", "/:id/:slug"], async (req, res) => {
    try {
        const param = req.params.id;
        let blog;

        if (mongoose.Types.ObjectId.isValid(param)) {
            blog = await Blog.findById(param).populate("createdBy", "fullName profileImageURL bio").lean();
        }
        if (!blog) {
            blog = await Blog.findOne({ slug: param }).populate("createdBy", "fullName profileImageURL bio").lean();
        }
        if (!blog) {
            return res.redirect("/");
        }

        // View tracking with deduplication:
        // Check cookie to prevent rapid duplicate counts by the same visitor within 30 minutes
        const viewCookieName = `viewed_${blog._id}`;
        if (!req.cookies || !req.cookies[viewCookieName]) {
            Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } }).exec();
            res.cookie(viewCookieName, '1', {
                maxAge: 30 * 60 * 1000,
                httpOnly: true,
                sameSite: 'lax'
            });
            blog.views = (blog.views || 0) + 1;
        }

        // 1. Cache rendered markdown HTML (5-min TTL)
        const htmlContent = await cacheService.wrap(`blog:html:${blog._id}`, 300, async () => {
            return marked(blog.body);
        });

        // 2. Fetch comments (lean)
        const comments = await Comment.find({
            commentedOn: blog._id
        }).populate("createdBy", "fullName profileImageURL").lean();

        // 3. Cache related stories recommendations (3-min TTL)
        const relatedBlogs = await cacheService.wrap(`blog:related:${blog._id}`, 180, async () => {
            return await getRelatedBlogs(blog._id, 6);
        });

        const seoExcerpt = generateSeoExcerpt(blog.body, 160);
        const canonicalUrl = `${SITE_URL}/blog/${blog._id}`;

        let hasLiked = false;
        if (req.user && blog.likedBy && Array.isArray(blog.likedBy)) {
            hasLiked = blog.likedBy.some(id => id.toString() === req.user._id.toString());
        }

        // Prevent CDN from swallowing requests so views and user-specific like/auth state stay accurate
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

        return res.render("blog", {
            blog,
            htmlContent,
            comments,
            relatedBlogs,
            seoExcerpt,
            canonicalUrl,
            hasLiked
        });
    } catch (err) {
        console.error("Blog route error:", err);
        return res.redirect("/");
    }
});

// Asynchronous Image Upload Endpoint (for Rich Markdown Editor Drag & Drop)
router.post("/upload-image", upload.single("image"), async (req, res) => {
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ success: false, error: "No image file provided" });
        }
        const result = await uploadOnCloudinary(req.file.buffer);
        return res.status(200).json({
            success: true,
            url: result.secure_url,
            public_id: result.public_id
        });
    } catch (err) {
        console.error("Upload image error:", err);
        return res.status(500).json({ success: false, error: "Image upload failed" });
    }
});

// Like / Unlike Reaction Endpoint (Auth verified & Toggleable)
router.post("/:id/like", async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                requireAuth: true,
                error: "Please sign in to like this story."
            });
        }

        const blogId = req.params.id;
        const userId = req.user._id;

        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ success: false, error: "Blog not found" });
        }

        const isLiked = blog.likedBy && blog.likedBy.some(id => id.toString() === userId.toString());

        let updatedBlog;
        if (isLiked) {
            // User already liked -> remove like (unlike)
            updatedBlog = await Blog.findByIdAndUpdate(
                blogId,
                {
                    $pull: { likedBy: userId },
                    $inc: { likes: -1 }
                },
                { new: true }
            ).select('likes likedBy');

            if (updatedBlog.likes < 0) {
                updatedBlog.likes = 0;
                await updatedBlog.save();
            }

            return res.status(200).json({ success: true, liked: false, likes: updatedBlog.likes });
        } else {
            // User has not liked -> add like
            updatedBlog = await Blog.findByIdAndUpdate(
                blogId,
                {
                    $addToSet: { likedBy: userId },
                    $inc: { likes: 1 }
                },
                { new: true }
            ).select('likes likedBy');

            return res.status(200).json({ success: true, liked: true, likes: updatedBlog.likes });
        }
    } catch (err) {
        console.error("Like toggle error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.post("/", upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "galleryImages", maxCount: 8 }]), async (req, res) => {
    const { title, body, category, tags } = req.body;
    let coverImageURL;
    let coverImagePublicId;
    const imagesArray = [];

    // Process Cover Image
    if (req.files?.coverImage?.[0]?.buffer) {
        const result = await uploadOnCloudinary(req.files.coverImage[0].buffer);
        coverImageURL = result.secure_url;
        coverImagePublicId = result.public_id;
        imagesArray.push({
            url: coverImageURL,
            public_id: coverImagePublicId,
            caption: title
        });
    }

    // Process Multiple Gallery Images
    if (req.files?.galleryImages && req.files.galleryImages.length > 0) {
        for (const file of req.files.galleryImages) {
            try {
                const result = await uploadOnCloudinary(file.buffer);
                imagesArray.push({
                    url: result.secure_url,
                    public_id: result.public_id,
                    caption: file.originalname || "Article Image"
                });
            } catch (imgErr) {
                console.warn("Gallery image upload failed:", imgErr.message);
            }
        }
    }

    // Parse tags
    let parsedTags = [];
    if (tags) {
        parsedTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    }

    const blog = await Blog.create({
        title,
        body,
        category: category || "Editorial",
        tags: parsedTags,
        images: imagesArray,
        createdBy: req.user._id,
        coverImageURL: coverImageURL,
        coverImagePublicId: coverImagePublicId,
    });

    cacheService.invalidateBlogCaches();

    return res.redirect(`/blog/${blog._id}`);
});



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
    cacheService.invalidateBlogCaches();

    return res.redirect(`/blog/${blog._id}`);
});

router.delete("/delete/:id", async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    if (blog.createdBy.toString() !== req.user._id.toString()) {
        return res.redirect("/");
    }
    deleteCloudinary(blog.coverImagePublicId);
    await blog.deleteOne();
    cacheService.invalidateBlogCaches();
    return res.redirect(`/`);
});

router.post("/comment/:id", commentLimiter, async (req, res) => {
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
        if (
            comment.createdBy.toString()
            !==
            req.user._id.toString()
        ) {
            return res.status(403).send("Unauthorized");
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
        const blog = await Blog.findById(comment.commentedOn); // adjust field name if needed
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
router.post("/comment/reply/:commentId", commentLimiter, async (req, res) => {
    try {

        const { commentId } = req.params;
        const { content } = req.body;

        const parentComment =
            await Comment.findById(commentId);

        await Comment.create({
            body: content,
            createdBy: req.user._id,
            commentedOn:
                parentComment.commentedOn,
            parentComment: commentId
        });

        return res.json({
            success: true
        });

    } catch (err) {

        console.log(err);
        return res.status(500)
            .json({
                error: err.message
            });
    }
});

router.post("/report", commentLimiter, restrictTo(['USER', 'ADMIN', 'OWNER']), async (req, res) => {
    try {
        const { targetType, targetId, blogId, reason, details } = req.body;

        const owner = await User.findOne({ role: "OWNER" }).select("email");
        
        const admin = await User.findOne({ role: "ADMIN" }).select("email");
        
        if (owner) {
            await reportToAdmin(
                owner.email,
                targetType,
                targetId,
                blogId,
                reason,
                details
            );
            
        }

        console.time("report");
        if (admin) {
            await reportToAdmin(
                admin.email,
                targetType,
                targetId,
                blogId,
                reason,
                details
            );
            
        }
        console.timeEnd("report");
        
        res.json({
            success: true,
            message: "Report submitted successfully"
        });
        return res.redirect('/blog/' + blogId);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Failed to submit report"
        });
    }
});

// Recommendation Engine APIs
router.get("/recommendations/trending", async (req, res) => {
    try {
        const trending = await getTrendingBlogs(10);
        return res.json({ success: true, count: trending.length, data: trending });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.get("/recommendations/personalized", async (req, res) => {
    try {
        const userId = req.user ? req.user._id : null;
        const personalized = await require("../services/recommendationEngine").getPersonalizedFeed(userId, 10);
        return res.json({ success: true, count: personalized.length, data: personalized });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;