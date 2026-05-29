const { Router } = require("express");
const Blog = require("../models/blog");
const User = require("../models/user");
const { restrictTo } = require("../middleware/authorization");
const { deleteCloudinary } = require("../services/cloudinary");

const  router = Router();

router.get('/dashboard', async (req, res) => {
    try {
        const { searchId } = req.query;
        let queryFilter = {};

        // Check if an ID was searched and make sure it's a valid MongoDB ObjectId format
        if (searchId && searchId.trim().match(/^[0-9a-fA-F]{24}$/)) {
            queryFilter._id = searchId.trim();
        }

        // Fetch filtered or global results
        const blogs = await Blog.find(queryFilter).populate('createdBy');

        res.render('admin', {
            user: req.user, 
            blogs: blogs,
            queryId: searchId || '' // Keeps track of what input was searched
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

router.post("/blog/delete/:id",restrictTo(["ADMIN","OWNER"]), async (req, res) => {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if(!blog){
        return res.status(404).send("Blog not found");
     }
    deleteCloudinary(blog.coverImagePublicId);
    await blog.deleteOne();
    return res.redirect("/admin/dashboard");
});

router.post('/assign-role',restrictTo(["OWNER"]), async (req, res) => {
    try {
        const { email, actionType } = req.body;
        const targetEmail = email.toLowerCase().trim();

        let newRole = 'USER';
        if (actionType === 'PROMOTE') {
            newRole = 'ADMIN';
        } else if (actionType === 'DEMOTE') {
            newRole = 'USER';
        } else {
            return res.status(400).send("Invalid action type submitted.");
        }
        const updatedUser = await User.findOneAndUpdate(
            { email: targetEmail },
            { $set: { role: newRole } },
            { new: true }
        ).select("-password -salt -refreshToken -otp"); 

        if (!updatedUser) {
            return res.status(404).send("User with that email address was not found.");
        }
        res.redirect('/admin/dashboard');

    } catch (error) {
        console.error("Owner Action Defect:", error);
        res.status(500).send("Internal database operation error encountered.");
    }
});

module.exports = router;