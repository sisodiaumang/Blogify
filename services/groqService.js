require('dotenv').config();
const axios = require('axios');
const { keyManager } = require('../config/groqKeys');

/**
 * Rewrites news article content and generates a blog title, detailed markdown post,
 * topic search keywords for non-copyrighted web images, and an AI fallback prompt.
 */
async function rewriteNewsToBlog({ title, snippet, content, source, category = 'General' }) {
    const maxRetries = 5;
    let attempt = 0;

    const systemPrompt = `You are a Senior Chief Editor and Photojournalist Director for premier digital publications (such as The Quint Voices, India Today Blogs, ABP Live, Vox, and Wired).
Your task is to take a news headline, summary, and source, rewrite it into a compelling, insightful Markdown blog article, and extract EXACT REAL-WORLD SEARCH KEYWORDS to find related, non-copyrighted photojournalistic images on the web.

CRITICAL INSTRUCTIONS FOR "searchKeywords":
- Provide 2 to 4 precise, real-world search phrases to search for non-copyrighted Creative Commons / Public Domain photographs online.
- Be very specific to the actual people, organizations, cities, devices, or events:
  * For Indian Politics (TMC / West Bengal / BJP / Elections): ["Trinamool Congress Kolkata", "Mamata Banerjee", "West Bengal legislative assembly", "Indian election voting"]
  * For International Diplomacy: ["India Canada relations", "Justin Trudeau Narendra Modi", "diplomatic bilateral summit"]
  * For Tech / Hardware: ["Samsung Galaxy S25", "Samsung Galaxy smartphone", "flagship smartphone"]
  * For Disasters / Environment: ["Nepal floods Himalaya", "Arctic sea ice polar bear", "monsoon flood rescue"]
  * For Sports / Entertainment: ["Indian cricket team match", "Bollywood film festival"]

CRITICAL INSTRUCTIONS FOR "imagePrompt" (as AI fallback):
- Describe the exact real-world scene in editorial photojournalism style (no sci-fi, no abstract fantasy, no text).

Respond strictly in valid JSON format:
{
  "title": "A captivating, journalistic, SEO-friendly headline (30-80 chars)",
  "body": "Full Markdown article (at least 350-500 words) with proper markdown headings (##, ###), key bullet points, background analysis, context, and insightful takeaways. Do NOT include markdown code fences around the JSON.",
  "searchKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "imagePrompt": "A detailed, topic-specific prompt describing the exact scene, subjects, setting, and mood matching the headline."
}`;

    const userPrompt = `
News Story Details:
- Original Title: ${title}
- Source: ${source || 'Editorial Wire'}
- Category: ${category}
- Summary / Content: ${content || snippet || title}

Please transform this into an original, insightful, well-structured markdown blog post with specific non-copyrighted image search keywords. Return valid JSON matching the schema.
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
                searchKeywords: parsed.searchKeywords || [title],
                imagePrompt: parsed.imagePrompt || `editorial photojournalism of ${title}, vibrant colors, clean composition, 8k`
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
