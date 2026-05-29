const { Schema, model } = require("mongoose");
const { createHmac, randomBytes } = require('crypto');
const { createAccessTokenForUser,createRefreshTokenForUser } = require("../services/authentication");



const userSchema = new Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    salt: {
        type: String,
    },
    refreshToken: {
        type: String,
    },
    password: {
        type: String,
        required: true,
    },
    profileImageURL: {
        type: String,
    },
    profileImagePublicId: {
        type: String,
    },
    otp: {
        type: Number,
    },
    otpCreatedAt: {
        type: Date
    },
    role: {
        type: String,
        enum: ['USER', 'ADMIN','OWNER'],
        default: 'USER'
    },
    bio: {
        type: String,
        default: "Sharing stories and ideas on Blogify.",
        maxlength: 160,
    }
}, {
    timestamps: true
});


userSchema.pre('save', async function () {
    const user = this;

    if (!user.isModified("password")) return;


    const salt = randomBytes(16).toString("hex");
    const hashedPassword = createHmac('sha256', salt)
        .update(user.password)
        .digest("hex");

    this.salt = salt;
    this.password = hashedPassword;

})


userSchema.statics.matchPasswordAndGenerateToken =async function (email, password) {

    const user = await this.findOne({ email });

    if (!user) {
        throw new Error("User not found");
    }
    const salt = user.salt;
    const hashedPassword = user.password;
    const userProvidedHash = createHmac(
        'sha256',
        salt
    )
        .update(password)
        .digest("hex");

    if (hashedPassword !== userProvidedHash) {
        throw new Error("Incorrect Password");
    }
    const accessToken = createAccessTokenForUser(user);
    const refreshToken = createRefreshTokenForUser(user);

    user.refreshToken = refreshToken;

    await user.save();

    return {
        accessToken,
        refreshToken,
        user: {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
        }
    };
}




const User = model('user', userSchema);

module.exports = User;