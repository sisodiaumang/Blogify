require('dotenv').config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const methodOverride = require("method-override");



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


app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(checkForAuthenticationCookie("token"));
app.use(express.static(path.resolve("./public")));
app.use(methodOverride("_method"));

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));




app.get("/", async (req, res) => {
    const search = req.query.search; // ✅ correct place

    const query = search
        ? { title: { $regex: search, $options: "i" } }
        : {};

    const blogs = await Blog.find(query);

    res.render("home", {
        user: req.user,
        blogs: blogs,
        search: search || null, // optional (for showing in input box)
    });
});


app.use('/user', userRoute);
app.use('/blog', blogRoute);

app.listen(PORT, () => {
    console.log("App is listening at port", PORT);
})