require('dotenv').config();
const axios = require('axios');
const { uploadOnCloudinary } = require('./cloudinary');

/**
 * Generates an accurate AI cover image using Pollinations FLUX and uploads it to Cloudinary.
 * @param {string} prompt Descriptive prompt for the image.
 * @returns {Promise<{ coverImageURL: string, coverImagePublicId: string } | null>}
 */
async function generateAndUploadImage(prompt) {
    try {
        console.log(`[imageGen] Generating AI image for prompt: "${prompt.slice(0, 95)}..."`);
        
        let cleanPrompt = prompt.replace(/[^\w\s,.-]/gi, ' ').trim();
        
        // Append clean photojournalistic/editorial quality modifiers
        const fullPrompt = `${cleanPrompt}, high quality editorial photojournalism, vivid lighting, sharp focus, clean composition, 8k, photorealistic, no text, no watermark`;

        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt.slice(0, 380))}?width=1200&height=630&model=flux&nologo=true&seed=${seed}`;

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 50000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (!response.data || response.status !== 200) {
            throw new Error(`Failed to download generated image. Status: ${response.status}`);
        }

        const buffer = Buffer.from(response.data);
        console.log(`[imageGen] AI image generated (${buffer.length} bytes). Uploading to Cloudinary...`);

        const uploadResult = await uploadOnCloudinary(buffer);

        if (uploadResult && uploadResult.secure_url) {
            console.log(`[imageGen] Cloudinary upload successful: ${uploadResult.secure_url}`);
            return {
                coverImageURL: uploadResult.secure_url,
                coverImagePublicId: uploadResult.public_id
            };
        } else {
            console.warn('[imageGen] Cloudinary upload returned empty result');
            return null;
        }
    } catch (err) {
        console.error(`[imageGen] Error during image generation/upload: ${err.message}`);
        return null;
    }
}

module.exports = { generateAndUploadImage };
