const { Router } = require('express');
const { generateSitemapXml, generateRssFeedXml, SITE_URL } = require('../services/seoService');

const router = Router();

// 1. Dynamic Google XML Sitemap endpoint
router.get('/sitemap.xml', async (req, res) => {
    try {
        const xml = await generateSitemapXml();
        res.header('Content-Type', 'application/xml; charset=utf-8');
        res.header('Cache-Control', 'public, s-maxage=3600, max-age=1800, stale-while-revalidate=86400');
        return res.send(xml);
    } catch (err) {
        console.error('[SEO Route] Sitemap generation failed:', err);
        return res.status(500).send('Error generating sitemap');
    }
});

router.get('/sitemap', (req, res) => {
    return res.redirect(301, '/sitemap.xml');
});

// 2. Dynamic RSS 2.0 / Atom Feeds for News Aggregators & Google News Crawlers
router.get(['/rss.xml', '/feed.xml', '/feed', '/rss'], async (req, res) => {
    try {
        const xml = await generateRssFeedXml();
        res.header('Content-Type', 'application/rss+xml; charset=utf-8');
        res.header('Cache-Control', 'public, s-maxage=3600, max-age=1800, stale-while-revalidate=86400');
        return res.send(xml);
    } catch (err) {
        console.error('[SEO Route] RSS feed generation failed:', err);
        return res.status(500).send('Error generating RSS feed');
    }
});

// 3. Dynamic robots.txt endpoint
router.get('/robots.txt', (req, res) => {
    const robotsTxt = `# Enterprise robots.txt for Blogify
User-agent: *
Allow: /
Disallow: /admin
Disallow: /user/settings
Disallow: /api/

# Crawl-delay for polite crawling
Crawl-delay: 1

# Sitemaps and Feeds
Sitemap: ${SITE_URL}/sitemap.xml
`;
    res.header('Content-Type', 'text/plain; charset=utf-8');
    res.header('Cache-Control', 'public, s-maxage=86400, max-age=86400');
    return res.send(robotsTxt);
});

module.exports = router;
