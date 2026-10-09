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

const { tagAllExistingBlogs } = require("./services/taggerService");

connectToMongoDB(process.env.MONGODB_URL)
    .then(() => {
        console.log("DataBase connected Successfully");
        // Run background keyword auto-tagging & category normalization
        tagAllExistingBlogs().catch(err => console.error("Auto-tagging error:", err));
    })
    .catch((err) => {
        console.error("Database connection Failed\n", err);
    });




const compression = require("compression");
const { globalLimiter } = require("./middleware/rateLimiter");
const { getOptimizedImageUrl } = require("./services/imageOptimizer");
const cacheService = require("./services/cacheService");
const { fetchFeedBlogs } = require("./services/feedAlgo");

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

function buildCategoryQuery(category) {
    if (!category || category.toLowerCase() === 'all') return null;
    const cat = category.toLowerCase().trim();

    if (cat === 'google trends' || cat === 'trends' || cat.includes('trend')) {
        return {
            $or: [
                { category: { $regex: 'trend', $options: 'i' } },
                { tags: { $regex: 'trend|viral', $options: 'i' } },
                { title: { $regex: '\\b(trend|trending|viral|surges|buzz|fame)\\b', $options: 'i' } }
            ]
        };
    }
    if (cat === 'technology' || cat === 'tech & ai' || cat === 'tech' || cat.includes('tech') || cat.includes('ai')) {
        return {
            $or: [
                { category: { $regex: 'tech|ai|artificial intelligence|software|hardware|computing', $options: 'i' } },
                { tags: { $regex: 'tech|technology|ai|artificial intelligence|machine learning|software|apple|google|nvidia|microsoft|meta|openai|chatgpt|robot|crypto|cyber|cloud|developer|coding|quantum|chip|semiconductor|deepseek|claude|gemini|llm', $options: 'i' } },
                { title: { $regex: '\\b(tech|technology|ai|artificial intelligence|robotics|robot|openai|chatgpt|nvidia|apple|google|microsoft|meta|software|hardware|algorithm|quantum|chip|chips|semiconductor|cyber|hacker|startup|android|ios|deepseek|claude|gemini|llm|coding|developer)\\b', $options: 'i' } }
            ]
        };
    }
    if (cat === 'geopolitics' || cat === 'world' || cat.includes('geopolitic') || cat.includes('world')) {
        return {
            $or: [
                { category: { $regex: 'geopolitic|world|international|foreign|diplomacy', $options: 'i' } },
                { tags: { $regex: 'geopolitic|world|war|defense|diplomacy|un|nato|china|russia|ukraine|israel|iran|palestine|taiwan|putin|biden|trump|modi|military|border', $options: 'i' } },
                { title: { $regex: '\\b(geopolitics|world|war|defense|diplomacy|nato|un|china|russia|ukraine|israel|iran|palestine|taiwan|putin|biden|trump|modi|treaty|military|missile|conflict|border|bilateral|foreign|sanctions)\\b', $options: 'i' } }
            ]
        };
    }
    if (cat === 'economy' || cat === 'markets' || cat.includes('econom') || cat.includes('market')) {
        return {
            $or: [
                { category: { $regex: 'econom|market|business|finance', $options: 'i' } },
                { tags: { $regex: 'econom|market|stock|inflation|gdp|recession|fed|rbi|banking|bank|finance|trade|invest|crypto|bitcoin|revenue|tax', $options: 'i' } },
                { title: { $regex: '\\b(economy|economic|market|markets|stock|stocks|sensex|nifty|wall street|inflation|gdp|recession|fed|federal reserve|rbi|interest rate|banking|bank|finance|financial|trade|tariffs|invest|investors|crypto|bitcoin|revenue|debt|tax)\\b', $options: 'i' } }
            ]
        };
    }
    if (cat === 'breaking news' || cat === 'breaking' || cat.includes('break') || cat.includes('top stor')) {
        return {
            $or: [
                { category: { $regex: 'break|top stor|news', $options: 'i' } },
                { tags: { $regex: 'break|urgent|alert|top stories|live', $options: 'i' } },
                { title: { $regex: '\\b(breaking|alert|live|urgent|crash|disaster|emergency|verdict|dead|killed|rescued|earthquake|storm|curfew|attack)\\b', $options: 'i' } }
            ]
        };
    }
    if (cat === 'editorial' || cat === 'opinion' || cat.includes('editorial') || cat.includes('opinion')) {
        return {
            $or: [
                { category: { $regex: 'editorial|opinion|essay|column|analysis', $options: 'i' } },
                { tags: { $regex: 'editorial|opinion|essay|perspective|analysis|thought', $options: 'i' } },
                { title: { $regex: '\\b(opinion|editorial|essay|perspective|viewpoint|column|analysis|why|how|reflections)\\b', $options: 'i' } }
            ]
        };
    }
    const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
        $or: [
            { category: { $regex: escaped, $options: 'i' } },
            { tags: { $regex: escaped, $options: 'i' } },
            { title: { $regex: escaped, $options: 'i' } }
        ]
    };
}

app.get('/fix-bot', async (req, res) => {
    try {
        const User = require('./models/user');
        const Blog = require('./models/blog');
        const update = await User.updateMany(
            { email: 'ainews@newscomplex.in' },
            { $set: { fullName: 'NewsComplex Editorial Team' } }
        );
        res.json({ success: true, update });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/', async (req, res) => {
    const limit = 9; 
    const page = parseInt(req.query.page) || 1;
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();
    const sort = (req.query.sort || 'trending').trim().toLowerCase();

    const queryConditions = [];
    if (search) {
        queryConditions.push({ title: { $regex: search, $options: 'i' } });
    }
    const catFilter = buildCategoryQuery(category);
    if (catFilter) {
        queryConditions.push(catFilter);
    }

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

    try {
        const cacheKey = `home:page:${page}:cat:${category.toLowerCase()}:sort:${sort}:s:${search.toLowerCase()}`;
        
        const data = await cacheService.wrap(cacheKey, 60, async () => {
            const totalBlogs = await Blog.countDocuments(query);
            const totalPages = Math.ceil(totalBlogs / limit);
            
            const blogs = await fetchFeedBlogs(query, sort, page, limit);

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
    const sort = (req.query.sort || 'trending').trim().toLowerCase();

    const queryConditions = [];
    if (search) {
        queryConditions.push({ title: { $regex: search, $options: 'i' } });
    }
    const catFilter = buildCategoryQuery(category);
    if (catFilter) {
        queryConditions.push(catFilter);
    }

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

    try {
        const totalBlogs = await Blog.countDocuments(query);
        const totalPages = Math.ceil(totalBlogs / limit);
        
        const blogs = await fetchFeedBlogs(query, sort, page, limit);

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
    // Schedule AI image fixer to run every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        const { fixOldAiImage } = require('./services/newsAutomation');
        await fixOldAiImage();
    });
    console.log("[Cron] AI Image Fixer job registered (every 30 mins).");
});

module.exports = app;