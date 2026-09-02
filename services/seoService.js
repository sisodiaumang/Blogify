const Blog = require('../models/blog');
const axios = require('axios');

const SITE_URL = process.env.SITE_URL || 'https://blogify-for-stories.vercel.app';

/**
 * Strips markdown and HTML formatting to generate a clean SEO excerpt.
 * @param {string} text 
 * @param {number} maxLength 
 * @returns {string} Clean plain-text description
 */
function generateSeoExcerpt(text, maxLength = 160) {
    if (!text) return 'Explore insightful articles, editorial stories, and breaking analysis on Blogify.';
    const clean = text
        .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
        .replace(/\[.*?\]\(.*?\)/g, '$1') // replace links with link text
        .replace(/<[^>]*>/g, '') // remove html tags
        .replace(/#+\s+/g, '') // remove markdown headings
        .replace(/(\*\*|__)(.*?)\1/g, '$2') // remove bold
        .replace(/(\*|_)(.*?)\1/g, '$2') // remove italic
        .replace(/`{1,3}.*?`{1,3}/gs, '') // remove code
        .replace(/---/g, '') // remove separators
        .replace(/\s+/g, ' ')
        .trim();

    if (clean.length <= maxLength) return clean;
    return clean.substring(0, maxLength - 3).trim() + '...';
}

/**
 * Generates an XML Sitemap conforming to Google Search & Google News standards.
 * @returns {Promise<string>} Valid XML Sitemap string
 */
async function generateSitemapXml() {
    try {
        const blogs = await Blog.find()
            .select('_id title coverImageURL category createdAt updatedAt')
            .sort({ createdAt: -1 })
            .lean();

        const staticRoutes = [
            { loc: `${SITE_URL}/`, changefreq: 'hourly', priority: '1.0', lastmod: new Date().toISOString() },
            { loc: `${SITE_URL}/user/signin`, changefreq: 'monthly', priority: '0.3', lastmod: new Date().toISOString() },
            { loc: `${SITE_URL}/user/signup`, changefreq: 'monthly', priority: '0.3', lastmod: new Date().toISOString() }
        ];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

        // Add static routes
        for (const route of staticRoutes) {
            xml += `  <url>
    <loc>${route.loc}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>
`;
        }

        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

        // Add all blog posts
        for (const blog of blogs) {
            const blogUrl = `${SITE_URL}/blog/${blog._id}`;
            const lastMod = (blog.updatedAt || blog.createdAt || new Date()).toISOString();
            const isRecentNews = blog.createdAt && new Date(blog.createdAt) >= twoDaysAgo;

            xml += `  <url>
    <loc>${blogUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
`;

            // Google News metadata for articles published within last 48 hours
            if (isRecentNews) {
                const cleanTitle = (blog.title || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');

                xml += `    <news:news>
      <news:publication>
        <news:name>Blogify</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${lastMod}</news:publication_date>
      <news:title>${cleanTitle}</news:title>
    </news:news>
`;
            }

            // Google Image metadata
            if (blog.coverImageURL) {
                const cleanImgUrl = blog.coverImageURL.replace(/&/g, '&amp;');
                const cleanTitle = (blog.title || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

                xml += `    <image:image>
      <image:loc>${cleanImgUrl}</image:loc>
      <image:title>${cleanTitle}</image:title>
    </image:image>
`;
            }

            xml += `  </url>
`;
        }

        xml += `</urlset>`;
        return xml;
    } catch (err) {
        console.error('[seoService] Error generating sitemap:', err);
        throw err;
    }
}

/**
 * Pings Google Search to notify that the sitemap has been updated.
 */
async function pingGoogleSearch() {
    try {
        const sitemapUrl = encodeURIComponent(`${SITE_URL}/sitemap.xml`);
        const pingUrl = `https://www.google.com/ping?sitemap=${sitemapUrl}`;
        const res = await axios.get(pingUrl, { timeout: 8000 });
        console.log(`[seoService] Successfully pinged Google Search indexing: ${res.status}`);
        return true;
    } catch (err) {
        console.warn(`[seoService] Notice: Google sitemap ping responded with: ${err.message}`);
        return false;
    }
}

module.exports = {
    generateSeoExcerpt,
    generateSitemapXml,
    pingGoogleSearch,
    SITE_URL
};
