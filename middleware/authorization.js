
function restrictTo(roles=[]) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).send("Unauthorized: Please log in.");
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).send("Forbidden: You do not have permission to access this resource.");
        }

        next();
    };
}


module.exports = {
    restrictTo
}