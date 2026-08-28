const Parser = require('rss-parser');
const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['content:encoded', 'contentEncoded']
        ]
    }
});

const NEWS_FEEDS = [
    // The Quint (Voices / Blogs / Top Stories)
    {
        name: 'The Quint - Voices & Blogs',
        category: 'Opinion & Editorial',
        url: 'https://news.google.com/rss/search?q=site:thequint.com+voices+OR+blog&hl=en-IN&gl=IN&ceid=IN:en'
    },
    {
        name: 'The Quint - Top Stories',
        category: 'Top Stories',
        url: 'https://news.google.com/rss/search?q=site:thequint.com&hl=en-IN&gl=IN&ceid=IN:en'
    },

    // India Today (Blogs & Top News)
    {
        name: 'India Today - Blogs & Editorial',
        category: 'Editorial & Blogs',
        url: 'https://news.google.com/rss/search?q=site:indiatoday.in/blogs-section+OR+site:indiatoday.in/opinion&hl=en-IN&gl=IN&ceid=IN:en'
    },
    {
        name: 'India Today - Home',
        category: 'Top Stories',
        url: 'https://www.indiatoday.in/rss/home'
    },
    {
        name: 'India Today - Tech & Trends',
        category: 'Technology',
        url: 'https://www.indiatoday.in/rss/1206584'
    },

    // ABP Live (Blogs & Top News)
    {
        name: 'ABP Live - Blogs',
        category: 'Editorial & Blogs',
        url: 'https://news.google.com/rss/search?q=site:news.abplive.com/blog&hl=en-IN&gl=IN&ceid=IN:en'
    },
    {
        name: 'ABP Live - Home',
        category: 'Top Stories',
        url: 'https://news.abplive.com/home/feed'
    },
    {
        name: 'ABP Live - Technology',
        category: 'Technology',
        url: 'https://news.abplive.com/technology/feed'
    },

    // General Breaking News Feeds
    {
        name: 'Google News India - Top Headlines',
        category: 'Top Stories',
        url: 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en'
    },
    {
        name: 'Google News India - Technology',
        category: 'Technology',
        url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en'
    },
    {
        name: 'Google News India - Business',
        category: 'Business',
        url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en'
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
 * Fetches news items published within the specified hours window (default: 4 hours).
 * @param {number} hoursWindow Max age of news in hours (default 4)
 * @returns {Promise<Array>} List of unique news items
 */
async function fetchRecentNews(hoursWindow = 4) {
    const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
    console.log(`[newsFetcher] Fetching news from The Quint, India Today, ABP Live & top feeds after: ${cutoffTime.toISOString()} (last ${hoursWindow} hours)`);

    const allArticles = [];
    const seenTitles = new Set();

    for (const feed of NEWS_FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);
            if (!feedData || !feedData.items) continue;

            for (const item of feedData.items) {
                const pubDate = item.pubDate || item.isoDate;
                const articleDate = pubDate ? new Date(pubDate) : null;

                // Only take news published within the specified hours window
                if (!articleDate || isNaN(articleDate.getTime()) || articleDate < cutoffTime) {
                    continue;
                }

                // Clean title and extract source if available
                let title = cleanHtml(item.title || '');
                let source = feed.name;
                if (title.includes(' - ')) {
                    const parts = title.split(' - ');
                    source = parts.pop().trim();
                    title = parts.join(' - ').trim();
                }

                // Normalize for deduplication
                const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (seenTitles.has(normalizedTitle) || normalizedTitle.length < 5) {
                    continue;
                }
                seenTitles.add(normalizedTitle);

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
            console.warn(`[newsFetcher] Error fetching feed ${feed.name}: ${err.message}`);
        }
    }

    // Sort newest first
    allArticles.sort((a, b) => b.pubDate - a.pubDate);
    console.log(`[newsFetcher] Found ${allArticles.length} new articles from the last ${hoursWindow} hours.`);
    return allArticles;
}

module.exports = { fetchRecentNews, NEWS_FEEDS };
