const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['content:encoded', 'contentEncoded']
        ]
    }
});

const RSS_FEEDS = [
    // 1. India Today Blogs & Opinion
    {
        name: 'India Today Blogs',
        category: 'Editorial & Opinion',
        url: 'https://news.google.com/rss/search?q=site:indiatoday.in/opinion-columns+OR+site:indiatoday.in/blogs-section+OR+site:indiatoday.in/lifestyle&hl=en-IN&gl=IN&ceid=IN:en'
    },
    {
        name: 'India Today Top Stories',
        category: 'Top Stories',
        url: 'https://www.indiatoday.in/rss/home'
    },

    // 2. The Quint Voices & Blogs
    {
        name: 'The Quint Voices',
        category: 'Opinion & Editorial',
        url: 'https://news.google.com/rss/search?q=site:thequint.com/voices+OR+site:thequint.com/opinion&hl=en-IN&gl=IN&ceid=IN:en'
    },

    // 3. ABP Live Blogs & Top News
    {
        name: 'ABP Live Blogs',
        category: 'Editorial & Blogs',
        url: 'https://news.google.com/rss/search?q=site:news.abplive.com/blog&hl=en-IN&gl=IN&ceid=IN:en'
    },
    {
        name: 'ABP Live Top News',
        category: 'Top Stories',
        url: 'https://news.abplive.com/home/feed'
    },

    // General India & Tech Feeds
    {
        name: 'Google News India',
        category: 'Top Stories',
        url: 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en'
    },
    {
        name: 'Google News Technology',
        category: 'Technology',
        url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en'
    }
];

function cleanHtml(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Fetches latest stories directly from The Quint's official JSON API.
 */
async function fetchFromQuintAPI(cutoffTime) {
    const articles = [];
    try {
        const res = await axios.get('https://www.thequint.com/api/v1/stories?limit=25', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        const stories = res.data?.stories || [];
        for (const story of stories) {
            const pubTimestamp = story['published-at'] || story['updated-at'];
            const pubDate = pubTimestamp ? new Date(pubTimestamp) : new Date();

            if (cutoffTime && pubDate < cutoffTime) {
                continue;
            }

            const title = story.headline || story.name;
            if (!title) continue;

            const snippet = story.summary || (story.cards && story.cards[0]?.story_elements?.map(e => e.text).join(' ')) || '';
            const link = story.slug ? (story.slug.startsWith('http') ? story.slug : `https://www.thequint.com/${story.slug}`) : '';

            articles.push({
                title: cleanHtml(title),
                source: 'The Quint',
                category: story.sections?.[0]?.name || 'Editorial',
                link,
                pubDate,
                snippet: cleanHtml(snippet),
                content: cleanHtml(snippet)
            });
        }
    } catch (err) {
        console.warn(`[newsFetcher] The Quint API notice: ${err.message}`);
    }
    return articles;
}

/**
 * Fetches latest blog posts directly from ABP Live Blog section (https://news.abplive.com/blog).
 */
async function fetchFromABPLiveBlog(cutoffTime) {
    const articles = [];
    try {
        const res = await axios.get('https://news.abplive.com/blog', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 10000
        });
        const $ = cheerio.load(res.data);

        $('a').each((_, el) => {
            const href = $(el).attr('href') || '';
            const title = $(el).text().trim();
            if (href.includes('/blog/') && title.length > 25) {
                const fullUrl = href.startsWith('http') ? href : `https://news.abplive.com${href}`;
                if (!articles.some(a => a.link === fullUrl)) {
                    articles.push({
                        title: cleanHtml(title.replace(/^“|”$/g, '')),
                        source: 'ABP Live Blog',
                        category: 'Opinion & Editorial',
                        link: fullUrl,
                        pubDate: new Date(),
                        snippet: title,
                        content: title
                    });
                }
            }
        });
    } catch (err) {
        console.warn(`[newsFetcher] ABP Live Blog scraper notice: ${err.message}`);
    }
    return articles;
}

/**
 * Fetches news items published within the specified hours window (default: 4 hours).
 * Sources include The Quint, India Today, ABP Live, and top Indian news feeds.
 * @param {number} hoursWindow Max age of news in hours (default 4)
 * @returns {Promise<Array>} List of unique news items
 */
async function fetchRecentNews(hoursWindow = 4) {
    const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
    console.log(`[newsFetcher] Fetching news from The Quint, India Today, ABP Live & top feeds after: ${cutoffTime.toISOString()} (last ${hoursWindow} hours)`);

    const allArticles = [];
    const seenTitles = new Set();

    // 1. Direct fetch from The Quint API
    const quintArticles = await fetchFromQuintAPI(cutoffTime);
    for (const art of quintArticles) {
        const norm = art.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenTitles.has(norm) && norm.length > 5) {
            seenTitles.add(norm);
            allArticles.push(art);
        }
    }

    // 2. Direct fetch from ABP Live Blog Section
    const abpArticles = await fetchFromABPLiveBlog(cutoffTime);
    for (const art of abpArticles) {
        const norm = art.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenTitles.has(norm) && norm.length > 5) {
            seenTitles.add(norm);
            allArticles.push(art);
        }
    }

    // 3. RSS Feeds for India Today, The Quint, ABP Live & Google News
    for (const feed of RSS_FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);
            if (!feedData || !feedData.items) continue;

            for (const item of feedData.items) {
                const pubDate = item.pubDate || item.isoDate;
                const articleDate = pubDate ? new Date(pubDate) : null;

                // Check time window
                if (!articleDate || isNaN(articleDate.getTime()) || articleDate < cutoffTime) {
                    continue;
                }

                let title = cleanHtml(item.title || '');
                let source = feed.name;
                if (title.includes(' - ')) {
                    const parts = title.split(' - ');
                    source = parts.pop().trim();
                    title = parts.join(' - ').trim();
                }

                const norm = title.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (seenTitles.has(norm) || norm.length < 5) {
                    continue;
                }
                seenTitles.add(norm);

                const snippet = cleanHtml(item.contentSnippet || item.content || item.summary || '');

                allArticles.push({
                    title,
                    source,
                    category: feed.category,
                    link: item.link,
                    pubDate: articleDate,
                    snippet,
                    content: snippet
                });
            }
        } catch (err) {
            console.warn(`[newsFetcher] RSS feed ${feed.name} notice: ${err.message}`);
        }
    }

    // Sort newest first
    allArticles.sort((a, b) => b.pubDate - a.pubDate);
    console.log(`[newsFetcher] Found ${allArticles.length} matching articles from The Quint, India Today, ABP Live & feeds.`);
    return allArticles;
}

module.exports = { fetchRecentNews, RSS_FEEDS, fetchFromQuintAPI, fetchFromABPLiveBlog };
