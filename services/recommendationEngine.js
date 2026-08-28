const Blog = require('../models/blog');
const User = require('../models/user');
const Comment = require('../models/comment');

// Common English Stopwords to filter out during keyword extraction
const STOPWORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot',
    'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d',
    'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
    'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s',
    'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
    'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll',
    'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
    'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
    'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
    'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which',
    'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d',
    'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'opinion', 'editorial', 'exclusive',
    'analysis', 'report', 'read', 'also', 'said', 'will', 'new', 'one', 'two', 'first', 'last'
]);

/**
 * Extracts meaningful keyword tokens from text.
 * @param {string} text 
 * @returns {Set<string>} Set of lowercase normalized keywords
 */
function extractKeywords(text) {
    if (!text) return new Set();
    const clean = text
        .toLowerCase()
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ');

    const words = clean.split(' ');
    const keywords = new Set();

    for (const word of words) {
        const trimmed = word.trim();
        if (trimmed.length > 2 && !STOPWORDS.has(trimmed) && isNaN(trimmed)) {
            keywords.add(trimmed);
        }
    }
    return keywords;
}

/**
 * Calculates Jaccard / Overlap similarity between two keyword sets.
 */
function calculateKeywordSimilarity(setA, setB) {
    if (!setA.size || !setB.size) return 0;
    let intersection = 0;
    for (const item of setA) {
        if (setB.has(item)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? (intersection / union) : 0;
}

/**
 * Recommends related blogs for a given blog post using Hybrid Content-Based & Engagement Ranking.
 * @param {string} blogId Target blog ID
 * @param {number} limit Maximum number of recommended blogs (default 6)
 * @returns {Promise<Array>} List of ranked recommended blog documents
 */
async function getRelatedBlogs(blogId, limit = 6) {
    try {
        const currentBlog = await Blog.findById(blogId).lean();
        if (!currentBlog) {
            return await getTrendingBlogs(limit);
        }

        const currentTitleKeywords = extractKeywords(currentBlog.title);
        const currentBodyKeywords = extractKeywords(currentBlog.body?.substring(0, 1500));
        const currentCategory = currentBlog.category || 'Editorial';
        const currentAuthorId = currentBlog.createdBy?.toString();
        const currentTags = new Set(currentBlog.tags || []);

        // Fetch candidate blogs (excluding the current one)
        const candidates = await Blog.find({ _id: { $ne: blogId } })
            .populate('createdBy', 'fullName profileImageURL bio')
            .sort({ createdAt: -1 })
            .limit(40)
            .lean();

        if (!candidates.length) return [];

        // Fetch comment counts for candidates
        const candidateIds = candidates.map(c => c._id);
        const commentCounts = await Comment.aggregate([
            { $match: { commentedOn: { $in: candidateIds } } },
            { $group: { _id: '$commentedOn', count: { $sum: 1 } } }
        ]);
        const commentMap = new Map(commentCounts.map(item => [item._id.toString(), item.count]));

        const now = Date.now();

        // Score each candidate
        const scoredCandidates = candidates.map(candidate => {
            const candidateTitleKeywords = extractKeywords(candidate.title);
            const candidateBodyKeywords = extractKeywords(candidate.body?.substring(0, 1000));
            const candidateTags = new Set(candidate.tags || []);

            // 1. Content Relevance (Title has 3x weight of body)
            const titleSim = calculateKeywordSimilarity(currentTitleKeywords, candidateTitleKeywords);
            const bodySim = calculateKeywordSimilarity(currentBodyKeywords, candidateBodyKeywords);
            const tagSim = calculateKeywordSimilarity(currentTags, candidateTags);
            const contentScore = (titleSim * 50) + (tagSim * 30) + (bodySim * 20); // max ~100

            // 2. Category Match Bonus
            let categoryScore = 0;
            if (candidate.category && currentCategory && candidate.category.toLowerCase() === currentCategory.toLowerCase()) {
                categoryScore = 25;
            }

            // 3. Author Affinity
            let authorScore = 0;
            if (candidate.createdBy && candidate.createdBy._id?.toString() === currentAuthorId) {
                authorScore = 15;
            }

            // 4. Engagement Score (Views + Comments)
            const comments = commentMap.get(candidate._id.toString()) || 0;
            const views = candidate.views || 0;
            const engagementScore = Math.min(25, (comments * 4) + Math.log2(views + 1) * 2);

            // 5. Freshness / Time-Decay Score (Exponential decay over 14 days)
            const ageInDays = Math.max(0, (now - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            const freshnessScore = Math.exp(-ageInDays / 14) * 20; // max 20

            // Final Composite Score
            const totalScore = (contentScore * 0.50) + categoryScore + authorScore + engagementScore + freshnessScore;

            return {
                ...candidate,
                recommendationScore: totalScore
            };
        });

        // Sort descending by score
        scoredCandidates.sort((a, b) => b.recommendationScore - a.recommendationScore);

        return scoredCandidates.slice(0, limit);
    } catch (err) {
        console.error('[RecommendationEngine] Error computing related blogs:', err);
        return await Blog.find({ _id: { $ne: blogId } })
            .populate('createdBy', 'fullName profileImageURL')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }
}

/**
 * Returns trending blogs based on engagement velocity and time decay.
 * @param {number} limit 
 */
async function getTrendingBlogs(limit = 6) {
    try {
        const blogs = await Blog.find()
            .populate('createdBy', 'fullName profileImageURL bio')
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

        if (!blogs.length) return [];

        const blogIds = blogs.map(b => b._id);
        const commentCounts = await Comment.aggregate([
            { $match: { commentedOn: { $in: blogIds } } },
            { $group: { _id: '$commentedOn', count: { $sum: 1 } } }
        ]);
        const commentMap = new Map(commentCounts.map(item => [item._id.toString(), item.count]));

        const now = Date.now();

        const trending = blogs.map(blog => {
            const comments = commentMap.get(blog._id.toString()) || 0;
            const views = blog.views || 0;
            const ageInHours = Math.max(0.5, (now - new Date(blog.createdAt).getTime()) / (1000 * 60 * 60));

            // Gravity / Velocity score = (Engagement) / (Age + 2)^1.2
            const score = (views + (comments * 8) + 10) / Math.pow(ageInHours + 2, 1.2);

            return {
                ...blog,
                trendingScore: score
            };
        });

        trending.sort((a, b) => b.trendingScore - a.trendingScore);
        return trending.slice(0, limit);
    } catch (err) {
        console.error('[RecommendationEngine] Error computing trending blogs:', err);
        return await Blog.find()
            .populate('createdBy', 'fullName profileImageURL')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }
}

/**
 * Returns personalized recommendations for a logged-in user based on reading & commenting history.
 * @param {string} userId 
 * @param {number} limit 
 */
async function getPersonalizedFeed(userId, limit = 8) {
    try {
        if (!userId) {
            return await getTrendingBlogs(limit);
        }

        // Find blogs user commented on
        const userComments = await Comment.find({ createdBy: userId }).limit(20).lean();
        if (!userComments.length) {
            return await getTrendingBlogs(limit);
        }

        const interactedBlogIds = userComments.map(c => c.commentedOn);
        const interactedBlogs = await Blog.find({ _id: { $in: interactedBlogIds } }).lean();

        // Build User Interest Profile
        const userInterestKeywords = new Set();
        const categoryCounts = {};

        for (const blog of interactedBlogs) {
            const kw = extractKeywords(blog.title + ' ' + (blog.tags || []).join(' '));
            kw.forEach(k => userInterestKeywords.add(k));
            if (blog.category) {
                categoryCounts[blog.category] = (categoryCounts[blog.category] || 0) + 1;
            }
        }

        // Candidates user has NOT commented on
        const candidates = await Blog.find({ _id: { $nin: interactedBlogIds } })
            .populate('createdBy', 'fullName profileImageURL bio')
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

        const scored = candidates.map(candidate => {
            const candKw = extractKeywords(candidate.title + ' ' + (candidate.tags || []).join(' '));
            const kwSim = calculateKeywordSimilarity(userInterestKeywords, candKw);
            const catBonus = (categoryCounts[candidate.category] || 0) * 15;
            const ageInDays = Math.max(0, (Date.now() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            const freshness = Math.exp(-ageInDays / 10) * 20;

            const score = (kwSim * 60) + catBonus + freshness;
            return { ...candidate, personalScore: score };
        });

        scored.sort((a, b) => b.personalScore - a.personalScore);
        return scored.slice(0, limit);
    } catch (err) {
        console.error('[RecommendationEngine] Error computing personalized feed:', err);
        return await getTrendingBlogs(limit);
    }
}

module.exports = {
    getRelatedBlogs,
    getTrendingBlogs,
    getPersonalizedFeed,
    extractKeywords,
    calculateKeywordSimilarity
};
