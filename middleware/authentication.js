const {
    validateAccessToken,
    validateRefreshToken,
    createAccessTokenForUser
} = require("../services/authentication");

const User = require("../models/user");

function checkForAuthenticationCookie(cookieName) {
    return async (req, res, next) => {
        try {
            const accessToken = req.cookies.accessToken;
            if (accessToken) {
                const userPayload =  validateAccessToken( accessToken);
                if (userPayload) {
                    const user = await User.findById(userPayload._id).select("-password -salt -refreshToken -otp -otpCreatedAt");
                    if (!user) {
                        return next();
                    }
                    req.user = user;
                    return next();
                }
            }
            const refreshToken = req.cookies.refreshToken;

            if (!refreshToken) {
                return next();
            }

            const refreshPayload = validateRefreshToken(refreshToken);
            if (!refreshPayload) {
                return next();
            }
            const user = await User.findById( refreshPayload._id);
            if (!user || user.refreshToken !== refreshToken) {
                return next();
            }
            const newAccessToken = createAccessTokenForUser(user);

            res.cookie(
                "accessToken",
                newAccessToken,
                {
                    httpOnly: true,
                    secure:
                        process.env.NODE_ENV
                        === "production",
                    sameSite: "strict",
                }
            );
            req.user = user;
        } catch (error) {
            console.log(error.message);
            req.user = null;
        }
        return next();
    };
}

module.exports = {
    checkForAuthenticationCookie
};