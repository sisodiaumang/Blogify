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
 * Fetches real-time trending search topics and attached verified news coverage
 * directly from Google Trends RSS feeds (India & Global/US).
 */
async function fetchGoogleTrends(cutoffTime) {
    const googleTrendsParser = new Parser({
        customFields: {
            item: [
                ['ht:approx_traffic', 'approxTraffic'],
                ['ht:news_item', 'newsItems', { keepArray: true }],
                ['ht:picture', 'picture'],
                ['ht:picture_source', 'pictureSource']
            ]
        }
    });

    const trendFeeds = [
        { name: 'Google Trends (India)', url: 'https://trends.google.com/trending/rss?geo=IN', region: 'India' },
        { name: 'Google Trends (Global/US)', url: 'https://trends.google.com/trending/rss?geo=US', region: 'Global' }
    ];

    const trendingArticles = [];

    for (const feed of trendFeeds) {
        try {
            const feedData = await googleTrendsParser.parseURL(feed.url);
            if (!feedData || !feedData.items) continue;

            for (const item of feedData.items) {
                const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
                if (cutoffTime && pubDate < cutoffTime) {
                    continue;
                }

                const trendQuery = cleanHtml(item.title || '');
                const traffic = item.approxTraffic ? `${item.approxTraffic} searches` : 'Trending Search';

                // Extract verified news headlines covering this trend
                const newsItems = item.newsItems || [];
                const headlines = [];
                let primaryLink = item.link || 'https://trends.google.com/trends/';

                for (const n of newsItems) {
                    const rawTitle = cleanHtml(n['ht:news_item_title']?.[0] || '');
                    const rawSnippet = cleanHtml(n['ht:news_item_snippet']?.[0] || '');
                    const rawSource = cleanHtml(n['ht:news_item_source']?.[0] || '');
                    const rawUrl = n['ht:news_item_url']?.[0] || '';

                    if (rawTitle) {
                        headlines.push(`- Headline: "${rawTitle}" (Source: ${rawSource}) ${rawSnippet}`.trim());
                    }
                    if (rawUrl && primaryLink.includes('trends.google.com')) {
                        primaryLink = rawUrl;
                    }
                }

                if (!trendQuery || headlines.length === 0) continue;

                // Pick the most comprehensive headline as title
                const mainHeadline = headlines[0].replace(/^- Headline:\s*"/, '').replace(/"\s*\(Source:.*$/, '').trim();
                const displayTitle = mainHeadline.length > 25 ? mainHeadline : `${trendQuery}: Why This Topic is Trending on Google`;

                const contextSummary = `Trending Query on Google Trends (${feed.region} - ${traffic}): "${trendQuery}".\nKey Verified News Coverage:\n${headlines.join('\n')}`;

                trendingArticles.push({
                    title: displayTitle,
                    trendQuery: trendQuery,
                    source: `Google Trends (${feed.region})`,
                    category: 'Trending News',
                    link: primaryLink,
                    pubDate,
                    traffic,
                    snippet: contextSummary,
                    content: contextSummary,
                    isTrending: true
                });
            }
        } catch (err) {
            console.warn(`[newsFetcher] Google Trends ${feed.name} notice: ${err.message}`);
        }
    }

    console.log(`[newsFetcher] Fetched ${trendingArticles.length} live trending topics from Google Trends.`);
    return trendingArticles;
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
 * Fetches news items published within the specified hours window.
 * PRIORITIZES live Google Trends topics (India & Global) alongside top editorial feeds.
 * @param {number} hoursWindow Max age of news in hours (default 4)
 * @returns {Promise<Array>} List of unique news items
 */
async function fetchRecentNews(hoursWindow = 4) {
    const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
    console.log(`[newsFetcher] Fetching real-time Google Trends & editorial feeds after: ${cutoffTime.toISOString()} (last ${hoursWindow} hours)`);

    const allArticles = [];
    const seenTitles = new Set();

    // 1. Google Trends (India & Global) - Highest Priority
    const googleTrends = await fetchGoogleTrends(cutoffTime);
    for (const trend of googleTrends) {
        const norm = trend.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenTitles.has(norm) && norm.length > 5) {
            seenTitles.add(norm);
            allArticles.push(trend);
        }
    }

    // 2. Direct fetch from The Quint API
    const quintArticles = await fetchFromQuintAPI(cutoffTime);
    for (const art of quintArticles) {
        const norm = art.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenTitles.has(norm) && norm.length > 5) {
            seenTitles.add(norm);
            allArticles.push(art);
        }
    }

    // 3. Direct fetch from ABP Live Blog Section
    const abpArticles = await fetchFromABPLiveBlog(cutoffTime);
    for (const art of abpArticles) {
        const norm = art.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenTitles.has(norm) && norm.length > 5) {
            seenTitles.add(norm);
            allArticles.push(art);
        }
    }

    // 4. RSS Feeds for India Today, The Quint, ABP Live & Google News
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

    console.log(`[newsFetcher] Found ${allArticles.length} matching candidate articles (Google Trends + Feeds).`);
    return allArticles;
}

/**
 * Fetches exclusively editorial news feeds (The Quint, ABP Live, India Today).
 */
async function fetchEditorialNews(hoursWindow = 4) {
    const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
    const allArticles = [];
    const seenTitles = new Set();

    // 1. The Quint API
    const quintArticles = await fetchFromQuintAPI(cutoffTime);
    for (const art of quintArticles) {
        const norm = art.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenTitles.has(norm) && norm.length > 5) {
            seenTitles.add(norm);
            allArticles.push(art);
        }
    }

    // 2. ABP Live
    const abpArticles = await fetchFromABPLiveBlog(cutoffTime);
    for (const art of abpArticles) {
        const norm = art.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenTitles.has(norm) && norm.length > 5) {
            seenTitles.add(norm);
            allArticles.push(art);
        }
    }

    // 3. RSS Feeds
    for (const feed of RSS_FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);
            if (!feedData || !feedData.items) continue;

            for (const item of feedData.items) {
                const pubDate = item.pubDate || item.isoDate;
                const articleDate = pubDate ? new Date(pubDate) : null;
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
                if (seenTitles.has(norm) || norm.length < 5) continue;
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

    allArticles.sort((a, b) => b.pubDate - a.pubDate);
    console.log(`[newsFetcher] Fetched ${allArticles.length} editorial news articles.`);
    return allArticles;
}

module.exports = { 
    fetchRecentNews, 
    fetchGoogleTrends, 
    fetchEditorialNews, 
    RSS_FEEDS, 
    fetchFromQuintAPI, 
    fetchFromABPLiveBlog 
};
