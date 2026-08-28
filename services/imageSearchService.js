require('dotenv').config();
const axios = require('axios');
const { uploadOnCloudinary } = require('./cloudinary');

/**
 * Searches Wikimedia Commons for non-copyrighted, high-resolution Creative Commons & Public Domain images.
 */
async function searchWikimedia(keyword) {
    try {
        const res = await axios.get('https://commons.wikimedia.org/w/api.php', {
            params: {
                action: 'query',
                generator: 'search',
                gsrsearch: keyword,
                gsrnamespace: 6,
                gsrlimit: 6,
                prop: 'imageinfo',
                iiprop: 'url|mime|size',
                format: 'json'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 12000
        });

        const pages = res.data?.query?.pages || {};
        const images = [];

        for (const id in pages) {
            const info = pages[id].imageinfo?.[0];
            if (info && info.url) {
                const mime = (info.mime || '').toLowerCase();
                const url = info.url;
                if (mime.includes('jpeg') || mime.includes('jpg') || mime.includes('png') || mime.includes('webp')) {
                    images.push(url);
                }
            }
        }
        return images;
    } catch (err) {
        console.warn(`[imageSearch] Wikimedia search notice for "${keyword}":`, err.message);
        return [];
    }
}

/**
 * Searches Openverse for verified Creative Commons / Public Domain photos.
 */
async function searchOpenverse(keyword) {
    try {
        const res = await axios.get('https://api.openverse.org/v1/images/', {
            params: {
                q: keyword,
                license_type: 'commercial,modification',
                page_size: 5
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const results = res.data?.results || [];
        return results.map(r => r.url).filter(url => url && (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.jpeg')));
    } catch (err) {
        return [];
    }
}

/**
 * Searches for a relevant, non-copyrighted image on Google / Wikimedia / Openverse,
 * downloads the image buffer, and uploads it to Cloudinary.
 * 
 * @param {Array<string>|string} searchKeywords Keyword(s) to search for
 * @returns {Promise<{ coverImageURL: string, coverImagePublicId: string } | null>}
 */
async function fetchAndUploadNonCopyrightedImage(searchKeywords) {
    const keywordsList = Array.isArray(searchKeywords)
        ? searchKeywords
        : [searchKeywords];

    console.log(`[imageSearch] Searching non-copyrighted web images for: ${JSON.stringify(keywordsList)}`);

    for (const keyword of keywordsList) {
        if (!keyword || keyword.trim().length < 3) continue;

        // 1. Search Wikimedia Commons
        let candidateUrls = await searchWikimedia(keyword.trim());

        // 2. Fallback to Openverse CC
        if (candidateUrls.length === 0) {
            candidateUrls = await searchOpenverse(keyword.trim());
        }

        // Try downloading and uploading candidate images
        for (const candidateUrl of candidateUrls.slice(0, 4)) {
            try {
                console.log(`[imageSearch] Attempting download of candidate CC image: ${candidateUrl}`);
                const imgRes = await axios.get(candidateUrl, {
                    responseType: 'arraybuffer',
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://commons.wikimedia.org/'
                    }
                });

                if (imgRes.status === 200 && imgRes.data && imgRes.data.length > 10000) {
                    const buffer = Buffer.from(imgRes.data);
                    console.log(`[imageSearch] Downloaded CC image (${buffer.length} bytes). Uploading to Cloudinary...`);

                    const uploadResult = await uploadOnCloudinary(buffer);
                    if (uploadResult && uploadResult.secure_url) {
                        console.log(`[imageSearch] Cloudinary upload successful: ${uploadResult.secure_url}`);
                        return {
                            coverImageURL: uploadResult.secure_url,
                            coverImagePublicId: uploadResult.public_id
                        };
                    }
                }
            } catch (dlErr) {
                console.warn(`[imageSearch] Candidate download skipped (${candidateUrl.slice(0, 60)}...):`, dlErr.message);
            }
        }
    }

    console.log('[imageSearch] No non-copyrighted web image found, falling back to topic-specific AI photojournalism generator...');
    return null;
}

module.exports = { fetchAndUploadNonCopyrightedImage, searchWikimedia, searchOpenverse };
