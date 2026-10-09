const Blog = require('../models/blog');
const User = require('../models/user');
const { fetchRecentNews, fetchGoogleTrends, fetchEditorialNews } = require('./newsFetcher');
const { rewriteNewsToBlog } = require('./groqService');
const { fetchAndUploadNonCopyrightedImage } = require('./imageSearchService');
const { generateAndUploadImage } = require('./imageGenService');
const { pingGoogleSearch } = require('./seoService');
const { extractTagsAndCategory } = require('./taggerService');

/**
 * Ensures an author user exists for automated AI news posts.
 */
async function getOrCreateNewsBotUser() {
    // Look for existing AI bot or Admin/Owner
    let botUser = await User.findOne({ email: { $in: ['ainews@newscomplex.in', 'ainews@blogify.com'] } });
    
    // Automatically rebrand old AI bot to appear strictly as a human editorial desk (AdSense approval requirement)
    if (botUser && botUser.fullName.includes('AI')) {
        botUser.fullName = 'NewsComplex Editorial Team';
        botUser.email = 'ainews@newscomplex.in';
        botUser.bio = 'The official editorial desk of NewsComplex, delivering curated breaking news, global trends, and comprehensive political analysis.';
        await botUser.save();
        console.log('[newsAutomation] Renamed AI bot to Editorial Team for E-E-A-T AdSense compliance.');
    }
    
    if (botUser) return botUser;

    botUser = await User.findOne({ role: { $in: ['ADMIN', 'OWNER'] } });
    if (botUser) return botUser;

    // Create a new dedicated AI Reporter user
    try {
        botUser = await User.create({
            fullName: 'NewsComplex Editorial Team',
            email: 'ainews@newscomplex.in',
            password: 'AutoNewsBotSecretPassword123!',
            isVerified: true,
            role: 'ADMIN',
            bio: 'The official editorial desk of NewsComplex, delivering curated breaking news, global trends, and comprehensive political analysis.',
            profileImageURL: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=200&h=200&fit=crop&crop=faces'
        });
        console.log('[newsAutomation] Created Editorial Team author user.');
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
 * @param {'all'|'trends'|'news'} options.mode Target feed mode (default: 'all')
 */
async function runNewsAutomation({ hoursWindow = 4, maxArticles = 25, mode = 'all' } = {}) {
    console.log(`\n======================================================`);
    console.log(`[newsAutomation] Starting news automation pipeline (${mode.toUpperCase()} MODE)...`);
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

        // 1. Fetch articles based on mode
        const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
        let articles = [];

        if (mode === 'trends') {
            articles = await fetchGoogleTrends(cutoffTime);
        } else if (mode === 'news') {
            articles = await fetchEditorialNews(hoursWindow);
        } else {
            articles = await fetchRecentNews(hoursWindow);
        }

        stats.totalFetched = articles.length;

        if (articles.length === 0) {
            console.log(`[newsAutomation] No new articles found for mode "${mode}" in the last ${hoursWindow} hours.`);
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

                // 4. Multi-Image Pipeline: Fetch & Upload Hero Cover + Secondary Inline Image
                const imagesArray = [];

                // 4A. Primary Hero Cover Image
                console.log(`[newsAutomation] Finding Hero Cover non-copyrighted image...`);
                let coverData = await fetchAndUploadNonCopyrightedImage(
                    generatedContent.searchKeywords || [article.title]
                );

                if (!coverData) {
                    console.log(`[newsAutomation] Generating topic-specific AI Hero image...`);
                    coverData = await generateAndUploadImage(generatedContent.imagePrompt || generatedContent.title);
                }

                if (coverData?.coverImageURL) {
                    imagesArray.push({
                        url: coverData.coverImageURL,
                        public_id: coverData.coverImagePublicId || null,
                        caption: generatedContent.title
                    });
                }

                // 4B. Secondary Inline Context Image
                console.log(`[newsAutomation] Finding Secondary Inline non-copyrighted image...`);
                let inlineData = await fetchAndUploadNonCopyrightedImage(
                    generatedContent.inlineSearchKeywords || [article.title]
                );

                if (!inlineData && generatedContent.inlineImagePrompt) {
                    console.log(`[newsAutomation] Generating secondary AI inline image...`);
                    inlineData = await generateAndUploadImage(generatedContent.inlineImagePrompt);
                }

                if (inlineData?.coverImageURL) {
                    imagesArray.push({
                        url: inlineData.coverImageURL,
                        public_id: inlineData.coverImagePublicId || null,
                        caption: generatedContent.inlineSearchKeywords?.[0] || 'Editorial Context'
                    });

                    // Embed inline image into markdown content
                    const inlineMarkdown = `\n\n![${generatedContent.inlineSearchKeywords?.[0] || 'Editorial Context'}](${inlineData.coverImageURL})\n*${generatedContent.inlineSearchKeywords?.[0] || generatedContent.title}*\n\n`;
                    if (finalBody.includes('{{INLINE_IMAGE_1}}')) {
                        finalBody = finalBody.replace('{{INLINE_IMAGE_1}}', inlineMarkdown);
                    } else {
                        // Insert in middle of body if placeholder was omitted
                        const paragraphs = finalBody.split('\n\n');
                        if (paragraphs.length >= 3) {
                            paragraphs.splice(Math.floor(paragraphs.length / 2), 0, inlineMarkdown);
                            finalBody = paragraphs.join('\n\n');
                        }
                    }
                } else {
                    finalBody = finalBody.replace(/\{\{INLINE_IMAGE_1\}\}/g, '');
                }

                // Extract smart category and keyword tags
                const { category: detectedCategory, tags: detectedTags } = extractTagsAndCategory(
                    generatedContent.title,
                    finalBody,
                    article.category
                );

                // 5. Save the multi-image blog post in MongoDB
                const newBlog = await Blog.create({
                    title: generatedContent.title,
                    body: finalBody,
                    category: detectedCategory || article.category || "Editorial",
                    tags: detectedTags || [],
                    coverImageURL: coverData?.coverImageURL || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&h=630&fit=crop',
                    coverImagePublicId: coverData?.coverImagePublicId || null,
                    images: imagesArray,
                    createdBy: botUser._id,
                    sourceUrl: article.link,
                    sourceTitle: article.title
                });

                console.log(`[newsAutomation] SUCCESS! Created multi-image blog: "${newBlog.title}" (ID: ${newBlog._id}, Images: ${imagesArray.length})`);
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

        if (stats.successfullyCreated > 0) {
            console.log(`[newsAutomation] Pinging Google Search to re-crawl updated sitemap...`);
            await pingGoogleSearch();
        }

        return stats;

    } catch (err) {
        console.error(`[newsAutomation] Critical error in automation pipeline:`, err);
        throw err;
    }
}

module.exports = { runNewsAutomation, fixOldAiImage };

const { deleteCloudinary } = require('./cloudinary');
const cloudinary = require("cloudinary").v2;

async function fixOldAiImage() {
    console.log('[aiImageFixer] Running background job to fix old AI slop images...');
    try {
        const botUser = await User.findOne({ email: { $in: ['ainews@newscomplex.in', 'ainews@blogify.com'] } });
        if (!botUser) return;
        
        const blogToFix = await Blog.findOne({ 
            createdBy: botUser._id, 
            aiImageFixed: { $ne: true } 
        }).sort({ createdAt: -1 });

        if (blogToFix) {
            console.log(`[aiImageFixer] Inspecting blog: "${blogToFix.title}"`);
            
            let isAiSlop = false;
            if (blogToFix.coverImagePublicId) {
                const resource = await cloudinary.api.resource(blogToFix.coverImagePublicId).catch(() => null);
                if (resource && resource.width === 1200 && resource.height === 630) {
                    isAiSlop = true;
                }
            }

            if (isAiSlop) {
                console.log(`[aiImageFixer] Identified 1200x630 AI slop. Regenerating...`);
                const coverData = await generateAndUploadImage(blogToFix.title);
                if (coverData && coverData.coverImageURL) {
                    if (blogToFix.coverImagePublicId) {
                        await deleteCloudinary(blogToFix.coverImagePublicId).catch(() => {});
                    }
                    blogToFix.coverImageURL = coverData.coverImageURL;
                    blogToFix.coverImagePublicId = coverData.coverImagePublicId;
                }
            } else {
                console.log(`[aiImageFixer] Image is likely a stock photo (not 1200x630). Keeping original.`);
            }

            // Mark as processed whether it was replaced or kept
            blogToFix.aiImageFixed = true;
            await blogToFix.save();
            console.log(`[aiImageFixer] Successfully processed: "${blogToFix.title}"`);
            
        } else {
            console.log('[aiImageFixer] No more AI slop images to fix!');
        }
    } catch (err) {
        console.error('[aiImageFixer] Error:', err);
    }
}
