require('dotenv').config();
const axios = require('axios');
const { keyManager } = require('../config/groqKeys');

/**
 * Rewrites news article content and generates a blog title, detailed multi-image markdown post,
 * topic search keywords for non-copyrighted web images, and AI fallback prompts.
 */
async function rewriteNewsToBlog({ title, snippet, content, source, category = 'General' }) {
    const maxRetries = 5;
    let attempt = 0;

    const systemPrompt = `You are a Senior Chief Editor and Photojournalist Director for premier digital publications (such as The Quint Voices, India Today Blogs, ABP Live, Vox, and Wired).
Your task is to take a trending topic or news headline, summary, and verified news coverage, rewrite it into a compelling, insightful Markdown blog article optimized for Google Search & Google Discover with MULTIPLE high-quality editorial images embedded into the text.

EDITORIAL & MULTI-IMAGE STRUCTURE GUIDELINES:
- Write at least 450-700 words with rich Markdown formatting (## Main Headings, ### Subsections, bullet points, blockquotes for key quotes, and bold text).
- Explain clearly what happened, why it is surging on Google Trends / news wires, provide comprehensive background analysis, and outline the future impact.
- Insert the exact placeholder token "{{INLINE_IMAGE_1}}" between two major sections in the body where a secondary contextual image or scene photo should be displayed.
- Provide 2 distinct sets of image search keywords:
  1. "searchKeywords": 2-3 search phrases for the primary Hero Cover image.
  2. "inlineSearchKeywords": 2-3 search phrases for the secondary inline context/location image.

CRITICAL INSTRUCTIONS FOR IMAGE SEARCH KEYWORDS:
- Use real-world, specific entity queries suitable for finding Creative Commons photographs:
  * e.g., ["Gurugram cyber hub skyline", "Delhi police press conference", "Haryana government secretariat"]
  * e.g., ["Stanford medical school laboratory", "neural cortex brain imaging", "research microscope"]

CRITICAL INSTRUCTIONS FOR "imagePrompt" & "inlineImagePrompt":
- Describe realistic editorial photojournalism scenes for AI generation fallback.

Respond strictly in valid JSON format:
{
  "title": "A captivating, journalistic, SEO-friendly headline (30-80 chars)",
  "body": "Full Markdown article (450-700 words) with ## headings, key takeaways, and the token {{INLINE_IMAGE_1}} placed between sections. Do NOT include markdown code fences around the JSON.",
  "searchKeywords": ["hero keyword 1", "hero keyword 2", "hero keyword 3"],
  "inlineSearchKeywords": ["inline keyword 1", "inline keyword 2"],
  "imagePrompt": "Detailed photojournalistic prompt for main hero cover image.",
  "inlineImagePrompt": "Detailed photojournalistic prompt for secondary inline context image."
}`;

    const userPrompt = `
Story / Trend Details:
- Title / Trend: ${title}
- Source: ${source || 'Google Trends'}
- Category: ${category}
- Context & News Coverage: ${content || snippet || title}

Please transform this into an original, multi-image editorial markdown blog post with specific image keywords and the {{INLINE_IMAGE_1}} placeholder. Return valid JSON matching the schema.
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
                    max_tokens: 2500,
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
                searchKeywords: parsed.searchKeywords || [title],
                inlineSearchKeywords: parsed.inlineSearchKeywords || [title],
                imagePrompt: parsed.imagePrompt || `editorial photojournalism of ${title}, vibrant colors, clean composition, 8k`,
                inlineImagePrompt: parsed.inlineImagePrompt || `editorial context photography of ${title}, journalistic style, 8k`
            };

        } catch (err) {
            const status = err.response?.status;
            console.error(`[groqService] Attempt ${attempt} failed with key ${apiKey ? apiKey.slice(0, 10) : 'none'}... Status: ${status || err.message}`);

            if (status === 429) {
                keyManager.markKeyRateLimited(apiKey, 90);
            } else if (status === 401) {
                keyManager.markKeyRateLimited(apiKey, 3600);
            }

            if (attempt >= maxRetries) {
                throw new Error(`Failed to generate blog after ${maxRetries} attempts with Groq. Last error: ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

module.exports = { rewriteNewsToBlog };
