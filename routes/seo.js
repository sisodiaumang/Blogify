const { Router } = require('express');
const { generateSitemapXml, SITE_URL } = require('../services/seoService');

const router = Router();

// Dynamic Google XML Sitemap endpoint
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

// Dynamic robots.txt endpoint
router.get('/robots.txt', (req, res) => {
    const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /user/settings
Disallow: /api/

# Sitemaps
Sitemap: ${SITE_URL}/sitemap.xml
`;
    res.header('Content-Type', 'text/plain; charset=utf-8');
    res.header('Cache-Control', 'public, s-maxage=86400, max-age=86400');
    return res.send(robotsTxt);
});

module.exports = router;
