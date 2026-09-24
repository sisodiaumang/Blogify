const Blog = require('../models/blog');
const cacheService = require('./cacheService');

// Keyword dictionaries for auto-classification and tagging
const CATEGORY_KEYWORDS = {
    Technology: [
        'tech', 'technology', 'ai', 'artificial intelligence', 'machine learning',
        'deep learning', 'neural', 'llm', 'openai', 'chatgpt', 'claude', 'gemini',
        'deepseek', 'nvidia', 'apple', 'google', 'microsoft', 'meta', 'software',
        'hardware', 'chip', 'semiconductor', 'quantum', 'cyber', 'cybersecurity',
        'developer', 'coding', 'programming', 'startup', 'smartphone', 'android',
        'ios', 'robotics', 'robot', 'autonomous', 'cloud', 'gadgets', 'spacex'
    ],
    Geopolitics: [
        'geopolitics', 'world', 'international', 'war', 'military', 'defense',
        'army', 'missile', 'conflict', 'border', 'treaty', 'diplomacy', 'foreign policy',
        'un', 'nato', 'russia', 'ukraine', 'china', 'taiwan', 'israel', 'iran',
        'palestine', 'gaza', 'middle east', 'us', 'usa', 'india', 'president',
        'prime minister', 'modi', 'biden', 'trump', 'putin', 'xi jinping', 'sanctions', 'bilateral'
    ],
    Economy: [
        'economy', 'economic', 'market', 'markets', 'stock', 'stocks', 'sensex',
        'nifty', 'wall street', 'inflation', 'gdp', 'recession', 'interest rate',
        'fed', 'federal reserve', 'rbi', 'banking', 'bank', 'finance', 'financial',
        'trade', 'tariffs', 'invest', 'investor', 'investment', 'crypto', 'bitcoin',
        'ethereum', 'revenue', 'debt', 'tax', 'budget', 'earnings', 'ipo'
    ],
    'Breaking News': [
        'breaking', 'urgent', 'alert', 'disaster', 'earthquake', 'flood',
        'storm', 'cyclone', 'crash', 'emergency', 'killed', 'dead', 'rescued',
        'curfew', 'explosion', 'attack', 'verdict', 'tragedy'
    ],
    'Google Trends': [
        'trend', 'trending', 'viral', 'google trends', 'buzz', 'fame',
        'sensation', 'celebrity', 'actor', 'actress', 'box office', 'trailer', 'cricket', 'score'
    ],
    Editorial: [
        'editorial', 'opinion', 'essay', 'perspective', 'viewpoint',
        'commentary', 'reflections', 'analysis', 'deep dive', 'critique', 'culture'
    ]
};

/**
 * Detects tags and category recommendations based on title and content.
 */
function extractTagsAndCategory(title = '', body = '', currentCategory = '') {
    const text = `${title} ${body}`.toLowerCase();
    const extractedTags = new Set();
    const scores = {};

    for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        scores[categoryName] = 0;
        for (const kw of keywords) {
            // Check if title or body contains whole-word or substring match
            const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (regex.test(title.toLowerCase())) {
                scores[categoryName] += 3; // Higher weight for title
                extractedTags.add(kw.toLowerCase());
            } else if (regex.test(text)) {
                scores[categoryName] += 1;
                if (extractedTags.size < 8) {
                    extractedTags.add(kw.toLowerCase());
                }
            }
        }
    }

    // Determine highest scoring category
    let bestCategory = currentCategory || 'Editorial';
    let highestScore = 0;

    for (const [cat, score] of Object.entries(scores)) {
        if (score > highestScore) {
            highestScore = score;
            bestCategory = cat;
        }
    }

    // If current category is generic (e.g. 'Top Stories', 'General', 'Editorial & Opinion') and we have a strong match:
    if (highestScore >= 2 && (!currentCategory || currentCategory === 'Editorial' || currentCategory === 'Top Stories' || currentCategory === 'General')) {
        // use bestCategory
    } else if (currentCategory) {
        bestCategory = currentCategory;
    }

    return {
        category: bestCategory,
        tags: Array.from(extractedTags).slice(0, 10)
    };
}

/**
 * Scans all existing blogs in MongoDB, extracts relevant tags and assigns proper category keywords.
 */
async function tagAllExistingBlogs() {
    try {
        console.log('[taggerService] Starting auto-tagging for all blogs...');
        const blogs = await Blog.find({});
        let updatedCount = 0;

        for (const blog of blogs) {
            const { category: suggestedCategory, tags: detectedTags } = extractTagsAndCategory(
                blog.title || '',
                blog.body || '',
                blog.category
            );

            // Merge detected tags with any existing tags
            const existingTags = Array.isArray(blog.tags) ? blog.tags : [];
            const mergedTags = Array.from(new Set([...existingTags.map(t => t.toLowerCase()), ...detectedTags]));

            let shouldUpdate = false;
            if (mergedTags.length > existingTags.length) {
                blog.tags = mergedTags;
                shouldUpdate = true;
            }

            // If category was generic or empty, update to suggested
            if (!blog.category || blog.category === 'General' || blog.category === 'Top Stories') {
                blog.category = suggestedCategory;
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                await Blog.findByIdAndUpdate(blog._id, {
                    tags: blog.tags,
                    category: blog.category
                });
                updatedCount++;
            }
        }

        console.log(`[taggerService] Auto-tagging complete. Updated ${updatedCount}/${blogs.length} blogs.`);
        cacheService.flush();
        return { total: blogs.length, updated: updatedCount };
    } catch (err) {
        console.error('[taggerService] Error during auto-tagging:', err);
        throw err;
    }
}

module.exports = {
    CATEGORY_KEYWORDS,
    extractTagsAndCategory,
    tagAllExistingBlogs
};
