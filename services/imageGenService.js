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
        
        // AI Verification Step 1: Pre-generation Prompt Enhancement for perfect anatomy
        const fullPrompt = `${cleanPrompt}, award-winning photojournalism, ultra-realistic, perfect human anatomy, exactly 5 fingers per hand, normal proportions, 8k resolution, no text`;

        // AI Verification Step 2: Strict Negative Constraints
        const negativePrompt = "mutated, deformed, three arms, extra limbs, bad anatomy, missing fingers, floating limbs, watermark, text, signature, logo, ugly, poorly drawn";

        const seed = Math.floor(Math.random() * 1000000);
        // Using 'realism' model for better humans, and adding negative_prompt
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt.slice(0, 380))}?width=1200&height=630&model=realism&nologo=true&negative_prompt=${encodeURIComponent(negativePrompt)}&seed=${seed}`;

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
