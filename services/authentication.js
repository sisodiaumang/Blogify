const JWT =require('jsonwebtoken');


const accessSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

function createAccessTokenForUser(user){
    const payload = 
    {   _id : user._id,
        email:user.email,
        role:user.role,

    }; 
    return JWT.sign(payload, accessSecret, {
        expiresIn: "15m",
    });
}
 function createRefreshTokenForUser(user){
    const payload = 
    {   _id : user._id,
        email:user.email,
        role:user.role,

    };
    return JWT.sign(payload, refreshSecret, {
        expiresIn: "7d",
    });
}

function validateRefreshToken(token) {
    try {
        const payload = JWT.verify(token, refreshSecret);
        return payload;
    } catch (err) {
        return null; // important
    }
}
function validateAccessToken(token) {
    try {
        const payload = JWT.verify(token, accessSecret);
        return payload;
    } catch (err) {
        return null; // important
    }
}

module.exports = {
    createAccessTokenForUser,
    createRefreshTokenForUser,
    validateRefreshToken,
    validateAccessToken
}