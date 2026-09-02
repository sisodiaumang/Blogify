const { Schema, model } = require("mongoose");

function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 90);
}

const blogSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        trim: true,
        index: true
    },
    metaDescription: {
        type: String,
        trim: true,
        maxlength: 200
    },
    body: {
        type: String,
        required: true,
    },
    coverImageURL: {
        type: String,
        required: false,
    },
    coverImagePublicId: {
        type: String,
    },
    category: {
        type: String,
        default: "Editorial",
        index: true
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true,
        index: true
    }],
    views: {
        type: Number,
        default: 0
    },
    readTimeMinutes: {
        type: Number,
        default: 3
    },
    wordCount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "user"
    },
    sourceUrl: {
        type: String,
        required: false,
    },
    sourceTitle: {
        type: String,
        required: false,
    }
}, { timestamps: true });

// Pre-save hook to auto-compute slug, word count, and reading time
blogSchema.pre('save', function () {
    if (this.title && (!this.slug || this.isModified('title'))) {
        this.slug = slugify(this.title);
    }
    if (this.body) {
        const words = this.body.trim().split(/\s+/).length;
        this.wordCount = words;
        this.readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    }
});

// Text index for full-text search and recommendation scoring
blogSchema.index({
    title: "text",
    body: "text",
    category: "text",
    tags: "text"
}, {
    weights: {
        title: 10,
        tags: 8,
        category: 5,
        body: 1
    },
    name: "BlogTextIndex"
});

const Blog = model("blog", blogSchema);

module.exports = Blog;