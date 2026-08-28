const { Schema, model } = require("mongoose");

const blogSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
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