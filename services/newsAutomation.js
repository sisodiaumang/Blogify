const Blog = require('../models/blog');
const User = require('../models/user');
const { fetchRecentNews } = require('./newsFetcher');
const { rewriteNewsToBlog } = require('./groqService');
const { fetchAndUploadNonCopyrightedImage } = require('./imageSearchService');
const { generateAndUploadImage } = require('./imageGenService');

/**
 * Ensures an author user exists for automated AI news posts.
 */
async function getOrCreateNewsBotUser() {
    // Look for existing AI bot or Admin/Owner
    let botUser = await User.findOne({ email: 'ainews@blogify.com' });
    if (botUser) return botUser;

    botUser = await User.findOne({ role: { $in: ['ADMIN', 'OWNER'] } });
    if (botUser) return botUser;

    // Create a new dedicated AI Reporter user
    try {
        botUser = await User.create({
            fullName: 'AI News Desk',
            email: 'ainews@blogify.com',
            password: 'AutoNewsBotSecretPassword123!',
            isVerified: true,
            role: 'ADMIN',
            bio: 'Automated global news correspondent delivering curated breaking news powered by Groq AI.',
            profileImageURL: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=200&h=200&fit=crop&crop=faces'
        });
        console.log('[newsAutomation] Created AI News Desk author user.');
        return botUser;
    } catch (err) {
        // Fallback: pick any user
        botUser = await User.findOne({});
        return botUser;
    }
}

/**
 * Runs the full news automation pipeline.
 * @param {Object} options Configuration options
 * @param {number} options.hoursWindow Hours to look back (default 4)
 * @param {number} options.maxArticles Maximum number of articles to process in this run (default 25)
 */
async function runNewsAutomation({ hoursWindow = 4, maxArticles = 25 } = {}) {
    console.log(`\n======================================================`);
    console.log(`[newsAutomation] Starting news automation pipeline...`);
    console.log(`[newsAutomation] Looking back ${hoursWindow} hours (Max limit: ${maxArticles} main articles)`);
    console.log(`======================================================\n`);

    const stats = {
        totalFetched: 0,
        skippedExisting: 0,
        successfullyCreated: 0,
        failed: 0
    };

    try {
        const botUser = await getOrCreateNewsBotUser();
        if (!botUser) {
            throw new Error("Could not find or create an author user for blog posting.");
        }

        // 1. Fetch news articles from last N hours
        const articles = await fetchRecentNews(hoursWindow);
        stats.totalFetched = articles.length;

        if (articles.length === 0) {
            console.log(`[newsAutomation] No new articles found in the last ${hoursWindow} hours.`);
            return stats;
        }

        let createdCount = 0;

        for (let i = 0; i < articles.length; i++) {
            if (createdCount >= maxArticles) {
                console.log(`[newsAutomation] Reached target quota of ${maxArticles} newly created articles. Finishing run.`);
                break;
            }

            const article = articles[i];

            // 2. Check if this article was already imported
            const existingBlog = await Blog.findOne({
                $or: [
                    { sourceUrl: article.link },
                    { sourceTitle: article.title }
                ]
            });

            if (existingBlog) {
                stats.skippedExisting++;
                continue;
            }

            console.log(`\n--- [Created ${createdCount + 1}/${maxArticles} | Checked ${i + 1}/${articles.length}] Processing: "${article.title}" ---`);

            try {
                // 3. Rewrite content with Groq LLM
                console.log(`[newsAutomation] Rewriting news article using Groq AI...`);
                const generatedContent = await rewriteNewsToBlog({
                    title: article.title,
                    snippet: article.snippet,
                    content: article.content,
                    source: article.source,
                    category: article.category
                });

                // Add source attribution at the bottom of the body
                let finalBody = generatedContent.body;
                if (article.link) {
                    finalBody += `\n\n---\n*Original Reporting & Source: [${article.source}](${article.link})*`;
                }

                // 4. Search and Upload Non-Copyrighted Image from Web (Wikimedia / Openverse / CC), or AI Fallback
                console.log(`[newsAutomation] Finding related non-copyrighted image...`);
                let coverData = await fetchAndUploadNonCopyrightedImage(
                    generatedContent.searchKeywords || [article.title]
                );

                if (!coverData) {
                    console.log(`[newsAutomation] Generating topic-specific AI image...`);
                    coverData = await generateAndUploadImage(generatedContent.imagePrompt || generatedContent.title);
                }

                // 5. Save the blog post in MongoDB
                const newBlog = await Blog.create({
                    title: generatedContent.title,
                    body: finalBody,
                    coverImageURL: coverData?.coverImageURL || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&h=630&fit=crop',
                    coverImagePublicId: coverData?.coverImagePublicId || null,
                    createdBy: botUser._id,
                    sourceUrl: article.link,
                    sourceTitle: article.title
                });

                console.log(`[newsAutomation] SUCCESS! Created blog: "${newBlog.title}" (ID: ${newBlog._id})`);
                stats.successfullyCreated++;
                createdCount++;

                // Delay between items to avoid hammering services
                await new Promise(r => setTimeout(r, 2000));

            } catch (itemErr) {
                console.error(`[newsAutomation] Failed to process article "${article.title}":`, itemErr.message);
                stats.failed++;
            }
        }

        console.log(`\n======================================================`);
        console.log(`[newsAutomation] Automation run completed!`);
        console.log(`[newsAutomation] Summary: Fetched: ${stats.totalFetched}, Created: ${stats.successfullyCreated}, Skipped: ${stats.skippedExisting}, Failed: ${stats.failed}`);
        console.log(`======================================================\n`);

        return stats;

    } catch (err) {
        console.error(`[newsAutomation] Critical error in automation pipeline:`, err);
        throw err;
    }
}

module.exports = { runNewsAutomation };
