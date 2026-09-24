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
                { category: { $regex: /trend/i } },
                { tags: { $regex: /trend|viral/i } },
                { title: { $regex: /\b(trend|trending|viral|surges|buzz|fame)\b/i } }
            ]
        };
    }
    if (cat === 'technology' || cat === 'tech & ai' || cat === 'tech' || cat.includes('tech') || cat.includes('ai')) {
        return {
            $or: [
                { category: { $regex: /tech|ai|artificial intelligence|software|hardware|computing/i } },
                { tags: { $regex: /tech|technology|ai|artificial intelligence|machine learning|software|apple|google|nvidia|microsoft|meta|openai|chatgpt|robot|crypto|cyber|cloud|developer|coding|quantum|chip|semiconductor|deepseek|claude|gemini|llm/i } },
                { title: { $regex: /\b(tech|technology|ai|artificial intelligence|robotics|robot|openai|chatgpt|nvidia|apple|google|microsoft|meta|software|hardware|algorithm|quantum|chip|chips|semiconductor|cyber|hacker|startup|android|ios|deepseek|claude|gemini|llm|coding|developer)\b/i } }
            ]
        };
    }
    if (cat === 'geopolitics' || cat === 'world' || cat.includes('geopolitic') || cat.includes('world')) {
        return {
            $or: [
                { category: { $regex: /geopolitic|world|international|foreign|diplomacy/i } },
                { tags: { $regex: /geopolitic|world|war|defense|diplomacy|un|nato|china|russia|ukraine|israel|iran|palestine|taiwan|putin|biden|trump|modi|military|border/i } },
                { title: { $regex: /\b(geopolitics|world|war|defense|diplomacy|nato|un|china|russia|ukraine|israel|iran|palestine|taiwan|putin|biden|trump|modi|treaty|military|missile|conflict|border|bilateral|foreign|sanctions)\b/i } }
            ]
        };
    }
    if (cat === 'economy' || cat === 'markets' || cat.includes('econom') || cat.includes('market')) {
        return {
            $or: [
                { category: { $regex: /econom|market|business|finance/i } },
                { tags: { $regex: /econom|market|stock|inflation|gdp|recession|fed|rbi|banking|bank|finance|trade|invest|crypto|bitcoin|revenue|tax/i } },
                { title: { $regex: /\b(economy|economic|market|markets|stock|stocks|sensex|nifty|wall street|inflation|gdp|recession|fed|federal reserve|rbi|interest rate|banking|bank|finance|financial|trade|tariffs|invest|investors|crypto|bitcoin|revenue|debt|tax)\b/i } }
            ]
        };
    }
    if (cat === 'breaking news' || cat === 'breaking' || cat.includes('break') || cat.includes('top stor')) {
        return {
            $or: [
                { category: { $regex: /break|top stor|news/i } },
                { tags: { $regex: /break|urgent|alert|top stories|live/i } },
                { title: { $regex: /\b(breaking|alert|live|urgent|crash|disaster|emergency|verdict|dead|killed|rescued|earthquake|storm|curfew|attack)\b/i } }
            ]
        };
    }
    if (cat === 'editorial' || cat === 'opinion' || cat.includes('editorial') || cat.includes('opinion')) {
        return {
            $or: [
                { category: { $regex: /editorial|opinion|essay|column|analysis/i } },
                { tags: { $regex: /editorial|opinion|essay|perspective|analysis|thought/i } },
                { title: { $regex: /\b(opinion|editorial|essay|perspective|viewpoint|column|analysis|why|how|reflections)\b/i } }
            ]
        };
    }
    const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
        $or: [
            { category: { $regex: new RegExp(escaped, 'i') } },
            { tags: { $regex: new RegExp(escaped, 'i') } },
            { title: { $regex: new RegExp(escaped, 'i') } }
        ]
    };
}

app.get('/', async (req, res) => {
    const limit = 9; 
    const page = parseInt(req.query.page) || 1;
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();
    const sort = (req.query.sort || 'newest').trim().toLowerCase();

    const queryConditions = [];
    if (search) {
        queryConditions.push({ title: { $regex: search, $options: 'i' } });
    }
    const catFilter = buildCategoryQuery(category);
    if (catFilter) {
        queryConditions.push(catFilter);
    }

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

    let sortOption = { createdAt: -1 };
    if (sort === 'trending' || sort === 'views') {
        sortOption = { views: -1, createdAt: -1 };
    } else if (sort === 'likes') {
        sortOption = { likes: -1, createdAt: -1 };
    }

    try {
        const cacheKey = `home:page:${page}:cat:${category.toLowerCase()}:sort:${sort}:s:${search.toLowerCase()}`;
        
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

    const queryConditions = [];
    if (search) {
        queryConditions.push({ title: { $regex: search, $options: 'i' } });
    }
    const catFilter = buildCategoryQuery(category);
    if (catFilter) {
        queryConditions.push(catFilter);
    }

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

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