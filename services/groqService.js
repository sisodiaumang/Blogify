const axios = require('axios');
const { keyManager } = require('../config/groqKeys');

/**
 * Rewrites news article content and generates a blog title, detailed markdown post, and AI image prompt.
 * Uses Groq API with automatic key rotation and fallback handling.
 */
async function rewriteNewsToBlog({ title, snippet, content, source, category = 'General' }) {
    const maxRetries = 5;
    let attempt = 0;

    const systemPrompt = `You are a professional investigative journalist and chief editor for a modern high-traffic digital tech and news magazine.
Your task is to take a news headline and snippet, and craft a comprehensive, engaging, well-researched, and formatted Markdown blog post based on it.

Respond strictly in valid JSON format with the following keys:
{
  "title": "A captivating, journalistic, SEO-friendly title",
  "body": "Full Markdown article (at least 350-500 words) with proper markdown headings (##, ###), bullet points, background analysis, key highlights, and conclusion. Do NOT include markdown code blocks around the JSON.",
  "imagePrompt": "A highly descriptive, photorealistic, cinematic prompt for an AI image generator (FLUX/SDXL) representing this news event visually. Avoid text, words, watermarks, or logos in the image prompt."
}`;

    const userPrompt = `
News Details:
- Original Title: ${title}
- Source: ${source || 'News Wire'}
- Category: ${category}
- Summary / Content: ${content || snippet || title}

Please transform this into an original, insightful, well-structured markdown blog post. Provide the response as raw JSON matching the required schema.
`;

    while (attempt < maxRetries) {
        const apiKey = keyManager.getKey();
        attempt++;

        try {
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: 'openai/gpt-oss-120b',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7,
                    max_tokens: 2048,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            let contentStr = response.data?.choices?.[0]?.message?.content;
            if (!contentStr) {
                throw new Error("Empty response from Groq API");
            }

            contentStr = contentStr.trim();
            if (contentStr.startsWith('```json')) {
                contentStr = contentStr.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (contentStr.startsWith('```')) {
                contentStr = contentStr.replace(/^```/, '').replace(/```$/, '').trim();
            }

            const parsed = JSON.parse(contentStr);
            if (!parsed.title || !parsed.body) {
                throw new Error("Incomplete JSON received from Groq");
            }

            return {
                title: parsed.title,
                body: parsed.body,
                imagePrompt: parsed.imagePrompt || `${title}, cinematic digital photography, high resolution, 8k`
            };

        } catch (err) {
            const status = err.response?.status;
            console.error(`[groqService] Attempt ${attempt} failed with key ${apiKey.slice(0, 10)}... Status: ${status || err.message}`);

            if (status === 429) {
                keyManager.markKeyRateLimited(apiKey, 90);
            } else if (status === 401) {
                keyManager.markKeyRateLimited(apiKey, 3600); // Invalid key, put on 1h cooldown
            }

            if (attempt >= maxRetries) {
                throw new Error(`Failed to generate blog after ${maxRetries} attempts with Groq. Last error: ${err.message}`);
            }

            // Small delay before retry
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

module.exports = { rewriteNewsToBlog };
