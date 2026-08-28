require('dotenv').config();
const axios = require('axios');
const { keyManager } = require('../config/groqKeys');

/**
 * Rewrites news article content and generates a blog title, detailed markdown post, and an accurate, topic-specific AI image prompt.
 * Uses Groq API with automatic key rotation and fallback handling.
 */
async function rewriteNewsToBlog({ title, snippet, content, source, category = 'General' }) {
    const maxRetries = 5;
    let attempt = 0;

    const systemPrompt = `You are a Senior Chief Editor and Photojournalist Director for premier digital publications (such as The Quint Voices, India Today Blogs, ABP Live, Vox, and Wired).
Your task is to take a news headline, summary, and source, rewrite it into a compelling, insightful Markdown blog article, and create an ACCURATE, HIGHLY RELEVANT, CONTEXT-SPECIFIC AI IMAGE PROMPT.

=======================================================
CRITICAL RULES FOR "imagePrompt" (ACCURACY & RELEVANCE):
=======================================================
1. The image MUST DIRECTLY and UNMISTAKABLY depict the actual real-world subject, country, institution, or event in the headline:
   - For Indian Politics / Regional Governance (e.g. West Bengal, TMC, BJP, Elections, Rallies):
     * Depict: A vibrant Indian political rally with enthusiastic supporters waving party flags, or an Indian voting booth with an Electronic Voting Machine (EVM), inked voter finger, or iconic backdrop of Kolkata's Howrah Bridge with Indian political campaign banners.
   - For International Relations / Geopolitics (e.g. India-Canada, Taiwan, US-China):
     * Depict: A formal bilateral diplomatic summit hall with national flags of the involved nations clearly visible beside formal delegates, or a stylized geopolitical map with glowing borders.
   - For Gadgets / Tech / Phones (e.g. Samsung Galaxy, Google Pixel, Apple):
     * Depict: A sleek, realistic close-up of the modern flagship smartphone on a clean minimalist desk with ambient studio lighting, highlighting its camera lenses and premium finish.
   - For Natural Disasters / Climate / Wildlife (e.g. Nepal Floods, Arctic Ice, Himalayan rivers):
     * Depict: A powerful photojournalistic scene of the specific event (e.g. Himalayan mountain river flood with emergency rescue boats, or polar bear on melting Arctic ice floe under dramatic skies).
   - For Business / Economy / Jobs / Careers:
     * Depict: Dynamic Indian financial market trading floor with Rupee symbol and green growth charts, or a modern collaborative workspace with young professionals at laptops.
   - For Culture / Lifestyle / Food / Health:
     * Depict: Rich, atmospheric cultural scene, traditional Indian festival atmosphere, or gourmet culinary preparation.

2. STRICT NEGATIVE RULES:
   - NEVER generate generic blue sci-fi skyscrapers, cyberpunk cities, or abstract fantasy buildings unless the story is literally about futuristic architecture.
   - Ground Indian news in authentic Indian visual aesthetics, architecture, flags, and people.
   - NO text, letters, slogans, watermarks, or logos in the image prompt.

3. ARTISTIC STYLE:
   - Style keywords to use: "editorial photojournalism, vibrant colors, cinematic lighting, national geographic documentary quality, clean composition, 8k resolution, photorealistic or modern editorial digital art".

=======================================================
RESPONSE FORMAT (JSON ONLY):
=======================================================
Respond strictly in valid JSON format:
{
  "title": "A captivating, journalistic, SEO-friendly headline (30-80 chars)",
  "body": "Full Markdown article (at least 350-500 words) with proper markdown headings (##, ###), key bullet points, background analysis, context, and insightful takeaways. Do NOT include markdown code fences around the JSON.",
  "imagePrompt": "A detailed, topic-specific prompt describing the exact scene, subjects, setting, lighting, and mood matching the headline."
}`;

    const userPrompt = `
News Story Details:
- Original Title: ${title}
- Source: ${source || 'Editorial Wire'}
- Category: ${category}
- Summary / Content: ${content || snippet || title}

Please transform this into an original, insightful, well-structured markdown blog post with a direct, topic-specific image prompt. Return valid JSON matching the schema.
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
