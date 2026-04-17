const JWT =require('jsonwebtoken');

const secret = process.env.JWT_SECRET;

function createTokenForUser(user){
    const payload = 
    {
        _id : user._id,
        email:user.email,
        profileImageURL:user.profileImageURL,
        role:user.role,
        fullName:user.fullName,
        bio:user.bio,
    };

    const token = JWT.sign(payload,secret);

    return token;
}



function validateToken(token) {
    try {
        const payload = JWT.verify(token, secret);
        return payload;
    } catch (err) {
        return null; // important
    }
}

module.exports = {
    createTokenForUser,
    validateToken
}