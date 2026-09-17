const { Router } = require('express');
const { generateSitemapXml, generateRssFeedXml, SITE_URL } = require('../services/seoService');
const Blog = require('../models/blog');
const cacheService = require('../services/cacheService');

const router = Router();

// 0. Visual HTML Archive / Directory for Googlebot deep crawl
router.get(['/archive', '/directory', '/sitemap-html'], async (req, res) => {
    try {
        const blogs = await cacheService.wrap('seo:archive_list', 180, async () => {
            return await Blog.find()
                .select('title slug category createdAt')
                .sort({ createdAt: -1 })
                .lean();
        });
        res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=86400');
        return res.render('archive', { blogs });
    } catch (err) {
        console.error('[SEO Route] Archive generation failed:', err);
        return res.redirect('/');
    }
});

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
