require('dotenv').config();
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

/**
 * Checks if a Cloudinary upload error is related to quota, storage, or rate limits.
 */
function isStorageLimitError(error) {
    if (!error) return false;
    const msg = (error.message || JSON.stringify(error)).toLowerCase();
    const httpCode = error.http_code || error.status;
    return (
        httpCode === 420 ||
        httpCode === 429 ||
        msg.includes('storage') ||
        msg.includes('quota') ||
        msg.includes('credit') ||
        msg.includes('limit') ||
        msg.includes('exceeded') ||
        msg.includes('resource limit') ||
        msg.includes('account limit') ||
        msg.includes('bandwidth')
    );
}

/**
 * Deletes the oldest blogs (FIFO Queue) from MongoDB along with all their
 * Cloudinary images (cover + inline gallery) and comments to reclaim storage.
 * @param {number} count Number of oldest blogs to prune (default: 3)
 */
async function pruneOldestBlogs(count = 3) {
    try {
        const Blog = require("../models/blog");
        const Comment = require("../models/comment");
        const cacheService = require("./cacheService");

        // Find the oldest blogs
        const oldestBlogs = await Blog.find()
            .sort({ createdAt: 1 })
            .limit(count);

        if (!oldestBlogs || oldestBlogs.length === 0) {
            console.log("[Storage FIFO Queue] No existing blogs to prune.");
            return 0;
        }

        console.log(`[Storage FIFO Queue] Pruning ${oldestBlogs.length} oldest blog(s) to free Cloudinary storage...`);

        let prunedCount = 0;
        for (const blog of oldestBlogs) {
            // 1. Delete Hero Cover image from Cloudinary
            const coverPublicId = blog.coverImagePublicId || getPublicId(blog.coverImageURL);
            if (coverPublicId) {
                await deleteCloudinary(coverPublicId);
            }

            // 2. Delete any inline / gallery images from Cloudinary
            if (blog.images && Array.isArray(blog.images) && blog.images.length > 0) {
                for (const img of blog.images) {
                    const imgPublicId = img.public_id || getPublicId(img.url);
                    if (imgPublicId) {
                        await deleteCloudinary(imgPublicId);
                    }
                }
            }

            // 3. Delete comments associated with this blog
            await Comment.deleteMany({ commentedOn: blog._id });

            // 4. Delete the blog document from MongoDB
            await Blog.findByIdAndDelete(blog._id);

            prunedCount++;
            console.log(`[Storage FIFO Queue] Pruned blog: "${blog.title}" (${blog._id})`);
        }

        // Invalidate caching layer
        if (cacheService && typeof cacheService.invalidateBlogCaches === 'function') {
            cacheService.invalidateBlogCaches();
        }

        return prunedCount;
    } catch (err) {
        console.error("[Storage FIFO Queue] Error while pruning oldest blogs:", err);
        return 0;
    }
}

/**
 * Uploads a file buffer to Cloudinary with automatic FIFO queue pruning if storage limits are hit.
 * @param {Buffer} fileBuffer 
 * @param {number} retryAttempts Number of retry attempts with FIFO pruning
 */
const uploadOnCloudinary = async (fileBuffer, retryAttempts = 1) => {
    try {
        if (!fileBuffer) return null;

        return await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { resource_type: "auto" },
                (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(result);
                }
            );

            streamifier.createReadStream(fileBuffer).pipe(stream);
        });

    } catch (error) {
        console.warn("[Cloudinary] Upload error encountered:", error?.message || error);

        // If storage/quota limit is hit (or on upload failure with retries left), prune oldest blogs (FIFO) and retry
        if (retryAttempts > 0 && isStorageLimitError(error)) {
            console.log("[Cloudinary] Storage limit detected. Triggering FIFO queue prune of oldest blogs...");
            const pruned = await pruneOldestBlogs(3);
            if (pruned > 0) {
                console.log("[Cloudinary] Retrying upload after pruning storage...");
                return await uploadOnCloudinary(fileBuffer, retryAttempts - 1);
            }
        }

        return null;
    }
};

const deleteCloudinary = async (publicId) => {
    try {
        if (!publicId) return null;
        const res = await cloudinary.uploader.destroy(publicId);
        return res;
    } catch (error) {
        console.warn("[Cloudinary] Delete error for publicId", publicId, ":", error?.message || error);
        return null;
    }
};

const getPublicId = (url) => {
    if (!url || typeof url !== 'string' || !url.includes('/upload/')) return null;

    try {
        // Take only part after /upload/
        const afterUpload = url.split("/upload/")[1];
        // Remove transformations if present and version number
        const noVersion = afterUpload.replace(/^(?:[a-zA-Z0-9_]+,[a-zA-Z0-9_,-]+\/)?(?:v\d+\/)?/, "");
        // Remove extension (.png, .jpg etc)
        return noVersion.split(".")[0];
    } catch (err) {
        return null;
    }
};

module.exports = { 
    uploadOnCloudinary, 
    deleteCloudinary, 
    getPublicId,
    pruneOldestBlogs,
    isStorageLimitError
};