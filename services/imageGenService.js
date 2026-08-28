const axios = require('axios');
const { uploadOnCloudinary } = require('./cloudinary');

/**
 * Generates an AI image using Pollinations FLUX / Turbo and uploads it to Cloudinary.
 * @param {string} prompt Descriptive prompt for the image.
 * @returns {Promise<{ coverImageURL: string, coverImagePublicId: string } | null>}
 */
async function generateAndUploadImage(prompt) {
    try {
        console.log(`[imageGen] Generating AI image for prompt: "${prompt.slice(0, 80)}..."`);
        const cleanPrompt = prompt.replace(/[^\w\s,.-]/gi, ' ').trim().slice(0, 300);
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1200&height=630&model=flux&nologo=true&seed=${seed}`;

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 45000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (!response.data || response.status !== 200) {
            throw new Error(`Failed to download generated image. Status: ${response.status}`);
        }

        const buffer = Buffer.from(response.data);
        console.log(`[imageGen] Image generated (${buffer.length} bytes). Uploading to Cloudinary...`);

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
