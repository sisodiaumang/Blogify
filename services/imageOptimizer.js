/**
 * Enterprise Image Optimization Service (Amazon/Cloudflare Style)
 * Automatically serves next-gen formats (WebP/AVIF), smart-crops, and downsamples
 * images dynamically based on viewport/device placement.
 */

const PRESETS = {
    // 1. Hero Image (Single Article Page - Top)
    hero: 'f_auto,q_auto:good,w_1200,c_limit',

    // 2. Blog Grid Card Thumbnail (Homepage / Explore Feed) ~30KB
    card: 'f_auto,q_auto:eco,w_480,h_270,c_fill,g_auto',

    // 3. Sidebar / Related Stories Micro-Thumbnail ~8KB
    thumb: 'f_auto,q_auto:eco,w_160,h_120,c_fill,g_auto',

    // 4. Author Avatars ~4KB
    avatar: 'f_auto,q_auto:good,w_120,h_120,c_thumb,g_face'
};

/**
 * Transforms an image URL into a lightweight, high-performance CDN-optimized URL.
 * @param {string} url Original image URL
 * @param {'hero'|'card'|'thumb'|'avatar'} type Preset type
 * @returns {string} Optimized image URL
 */
function getOptimizedImageUrl(url, type = 'card') {
    if (!url || typeof url !== 'string') {
        return 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=480&h=270&q=70';
    }

    const transform = PRESETS[type] || PRESETS.card;

    // 1. Cloudinary Dynamic Transformation Injection
    if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
        // Avoid duplicate transformations
        if (url.includes('/upload/f_auto') || url.includes('/upload/w_') || url.includes('/upload/c_')) {
            return url;
        }
        return url.replace('/upload/', `/upload/${transform}/`);
    }

    // 2. Unsplash Dynamic URL Parameters
    if (url.includes('images.unsplash.com')) {
        let width = 480;
        let height = 270;
        let quality = 70;

        if (type === 'hero') { width = 1200; height = 630; quality = 80; }
        else if (type === 'thumb') { width = 160; height = 120; quality = 65; }
        else if (type === 'avatar') { width = 120; height = 120; quality = 80; }

        const baseUrl = url.split('?')[0];
        return `${baseUrl}?auto=format&fit=crop&w=${width}&h=${height}&q=${quality}`;
    }

    // 3. Fallback for other direct images
    return url;
}

module.exports = {
    getOptimizedImageUrl,
    PRESETS
};
