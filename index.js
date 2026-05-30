const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const methodOverride = require("method-override");


const adminRoute = require("./routes/admin");
const userRoute = require("./routes/user");
const blogRoute = require("./routes/blog");
const Blog = require("./models/blog");




const connectToMongoDB = require("./connect");
const { checkForAuthenticationCookie } = require('./middleware/authentication');


const app = express();
const PORT = process.env.PORT || 8000;

connectToMongoDB(process.env.MONGODB_URL)
    .then(() => {
        console.log("DataBase connected Successfully");
    })
    .catch((err) => {
        console.error("Database connection Failed\n", err);
    })
    ;




app.use(express.json()); // Add this if it's missing!
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(checkForAuthenticationCookie("accessToken"));
app.use(express.static(path.resolve("./public")));
app.use(methodOverride("_method"));
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));




app.get('/', async (req, res) => {
    const limit = 6; 
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const query = search ? { title: { $regex: search, $options: 'i' } } : {};

    try {
        const totalBlogs = await Blog.countDocuments(query);
        const totalPages = Math.ceil(totalBlogs / limit);
        
        const blogs = await Blog.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('home', {
            blogs,
            search,
            currentPage: page,
            totalPages
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});


app.use('/user', userRoute);
app.use('/blog', blogRoute);
app.use('/admin', adminRoute);

app.listen(PORT, () => {
    console.log("App is listening at port", PORT);
})