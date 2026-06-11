const crypto = require("crypto");
async function generateEmailConfirmationToken() {
    const token = await crypto.randomBytes(32).toString("hex");
    return token;
}

module.exports = {
    generateEmailConfirmationToken
}