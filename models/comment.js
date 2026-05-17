const {Schema,model} = require("mongoose");

const commentSchema = new Schema({
    body: {
        type: String,
        required: true
    },

    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "user"
    },

    commentedOn: {
        type: Schema.Types.ObjectId,
        ref: "blog"
    },

    // reply feature
    parentComment: {
        type: Schema.Types.ObjectId,
        ref: "comment",
        default: null
    }

}, { timestamps: true });

const Comment = model("comment",commentSchema);

module.exports = Comment;