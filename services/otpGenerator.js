const crypto = require("crypto");

function generateOTP(userSalt) {
    const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000));
    const raw = `${userSalt}:${timeWindow}`;
    const hash = crypto.createHmac("sha256", raw).digest("hex");
    const otp = (parseInt(hash.substring(0, 8), 16) % 1000000).toString().padStart(6, "0");
    return otp;
}

module.exports = generateOTP;