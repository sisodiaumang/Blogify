const axios = require('axios');
const { keyManager } = require('../config/groqKeys');

/**
 * Rewrites news article content and generates a blog title, detailed markdown post, and AI image prompt.
 * Uses Groq API with automatic key rotation and fallback handling.
 */
async function rewriteNewsToBlog({ title, snippet, content, source, category = 'General' }) {
    const maxRetries = 5;
    let attempt = 0;

    const systemPrompt = `You are a Senior Editor and Art Director for leading modern digital magazines and opinion blogs (such as The Quint Voices, India Today Blogs, ABP Live Blog, Vox, and Wired).
Your task is to take breaking news or blog stories and transform them into deeply engaging, well-researched, high-quality Markdown blog articles accompanied by a vivid EDITORIAL CONCEPTUAL ARTWORK image prompt.

CRITICAL INSTRUCTIONS FOR IMAGE PROMPT (Editorial Blog & Magazine Style):
- The image MUST NOT be a boring, realistic living room or mundane snapshot.
- Instead, create a STRIKING, MODERN EDITORIAL 3D CONCEPTUAL DIGITAL ARTWORK or VIBRANT EDITORIAL VECTOR ILLUSTRATION (just like The Quint, India Today, and ABP Live cover features).
- Use imaginative visual metaphors:
  * For AI / Tech / Innovation: Glowing futuristic 3D neural brain held in human hands, floating glowing cybernetic nodes, vibrant neon blue/purple circuits, holographic diagrams, sleek minimalist tech aesthetic.
  * For Politics / Governance / Society: Dramatic high-contrast editorial concept art, symbolic silhouettes, vibrant civic color accents, expressive modern artistic composition.
  * For Economy / Business / Jobs: 3D isometric glowing financial charts, stylized modern career desk setup with floating skill icons, upward growth arrows, vibrant modern color palette.
  * For Environment / Nature / Climate: Dramatic atmospheric digital concept painting with vivid lighting and surreal nature elements.
  * For Entertainment / Sports / Culture: Dynamic pop-art or vivid 3D stylized character render with cinematic glow and high energy.
- Format: "modern editorial 3D digital illustration, [descriptive creative scene], vibrant color palette, clean studio lighting, Behance trending, 8k, highly detailed".
- STRICT RULE: Do NOT include text, alphabet letters, words, watermarks, or brand logos in the image prompt.

Respond strictly in valid JSON format with the following keys:
{
  "title": "A captivating, journalistic, SEO-friendly headline (30-80 chars)",
  "body": "Full Markdown article (at least 350-500 words) with proper markdown headings (##, ###), key bullet points, background analysis, context, and insightful takeaways. Do NOT include markdown code fences around the JSON.",
  "imagePrompt": "A rich, creative 3D conceptual editorial illustration prompt following the style guidelines above."
}`;

    const userPrompt = `
News Story Details:
- Original Title: ${title}
- Source: ${source || 'Editorial Wire'}
- Category: ${category}
- Summary / Content: ${content || snippet || title}

Please transform this into an original, insightful, well-structured markdown blog post with an editorial illustration prompt. Return valid JSON matching the schema.
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
                    temperature: 0.75,
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
                imagePrompt: parsed.imagePrompt || `modern editorial 3D digital illustration of ${title}, vibrant colors, conceptual magazine cover art, 8k`
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
