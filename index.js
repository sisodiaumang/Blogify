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
const seoRoute = require("./routes/seo");
const Blog = require("./models/blog");
const emailVerifyRoute = require("./routes/emailVerify");
const cron = require("node-cron");
const { runNewsAutomation } = require("./services/newsAutomation");



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




const compression = require("compression");
const { globalLimiter } = require("./middleware/rateLimiter");
const { getOptimizedImageUrl } = require("./services/imageOptimizer");
const cacheService = require("./services/cacheService");

app.use(compression());
app.use(globalLimiter);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(checkForAuthenticationCookie("accessToken"));
app.use(express.static(path.join(__dirname, "public"), {
    maxAge: '7d',
    etag: true
}));
app.use(methodOverride("_method"));
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.imgOpt = getOptimizedImageUrl;
    next();
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get('/', async (req, res) => {
    const limit = 9; 
    const page = parseInt(req.query.page) || 1;
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();
    const sort = (req.query.sort || 'newest').trim().toLowerCase();

    const query = {};
    if (search) {
        query.title = { $regex: search, $options: 'i' };
    }
    if (category && category.toLowerCase() !== 'all') {
        if (category.toLowerCase() === 'trends') {
            query.category = { $regex: /trend/i };
        } else {
            query.category = { $regex: new RegExp(category, 'i') };
        }
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'trending' || sort === 'views') {
        sortOption = { views: -1, createdAt: -1 };
    } else if (sort === 'likes') {
        sortOption = { likes: -1, createdAt: -1 };
    }

    try {
        const cacheKey = `home:page:${page}:cat:${category}:sort:${sort}:s:${search.toLowerCase()}`;
        
        const data = await cacheService.wrap(cacheKey, 60, async () => {
            const totalBlogs = await Blog.countDocuments(query);
            const totalPages = Math.ceil(totalBlogs / limit);
            
            const blogs = await Blog.find(query)
                .select('title slug coverImageURL category readTimeMinutes views likes createdAt createdBy')
                .populate('createdBy', 'fullName profileImageURL')
                .sort(sortOption)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            return { blogs, totalPages, totalBlogs };
        });

        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=86400');

        return res.render('home', {
            blogs: data.blogs,
            search,
            category,
            sort,
            currentPage: page,
            totalPages: data.totalPages,
            totalBlogs: data.totalBlogs
        });
    } catch (err) {
        console.error("Home route error:", err);
        return res.status(500).send("Server Error");
    }
});

// Infinite Scroll AJAX JSON Feed Endpoint
app.get('/api/feed', async (req, res) => {
    const limit = 9; 
    const page = parseInt(req.query.page) || 1;
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();
    const sort = (req.query.sort || 'newest').trim().toLowerCase();

    const query = {};
    if (search) {
        query.title = { $regex: search, $options: 'i' };
    }
    if (category && category.toLowerCase() !== 'all') {
        if (category.toLowerCase() === 'trends') {
            query.category = { $regex: /trend/i };
        } else {
            query.category = { $regex: new RegExp(category, 'i') };
        }
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'trending' || sort === 'views') {
        sortOption = { views: -1, createdAt: -1 };
    } else if (sort === 'likes') {
        sortOption = { likes: -1, createdAt: -1 };
    }

    try {
        const totalBlogs = await Blog.countDocuments(query);
        const totalPages = Math.ceil(totalBlogs / limit);
        
        const blogs = await Blog.find(query)
            .select('title slug coverImageURL category readTimeMinutes views likes createdAt createdBy')
            .populate('createdBy', 'fullName profileImageURL')
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // Attach optimized thumbnail URLs
        const transformedBlogs = blogs.map(b => ({
            ...b,
            optimizedCardImage: getOptimizedImageUrl(b.coverImageURL, 'card'),
            formattedDate: new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }));

        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=86400');

        return res.status(200).json({
            success: true,
            blogs: transformedBlogs,
            currentPage: page,
            totalPages,
            hasMore: page < totalPages
        });
    } catch (err) {
        console.error("API feed error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});


app.use('/user', userRoute);
app.use('/blog', blogRoute);
app.use('/admin', adminRoute);
app.use('/verify-email', emailVerifyRoute);
app.use('/', seoRoute);

// Automated News Publishing Endpoint (Triggered hourly by GitHub Actions / Cron)
app.get('/api/cron/fetch-news', async (req, res) => {
    console.log('[Hourly Cron] Triggered automated news publishing...');
    try {
        const stats = await runNewsAutomation({ hoursWindow: 2, maxArticles: 15 });
        return res.status(200).json({
            success: true,
            message: "News automation executed successfully for hourly window.",
            stats
        });
    } catch (err) {
        console.error('[Vercel Cron] Execution failed:', err);
        return res.status(500).json({
            success: false,
            message: "News automation failed.",
            error: err.message
        });
    }
});

app.listen(PORT, () => {
    console.log("App is listening at port", PORT);

    // Schedule automated news publishing every 4 hours
    cron.schedule('0 */4 * * *', async () => {
        console.log('[Cron] Running scheduled 4-hour news automation...');
        try {
            await runNewsAutomation({ hoursWindow: 4, maxArticles: 8 });
        } catch (e) {
            console.error('[Cron] Error running news automation:', e);
        }
    });
    console.log("[Cron] Automated 4-hour news publishing job registered.");
});

module.exports = app;