require('dotenv').config();

class GroqKeyManager {
    constructor() {
        this.currentIndex = 0;
        this.cooldowns = new Map();
    }

    getKeys() {
        const envKeys = process.env.GROQ_API_KEYS
            ? process.env.GROQ_API_KEYS.split(',').map(k => k.trim()).filter(Boolean)
            : [];
        return envKeys;
    }

    getKey() {
        const keys = this.getKeys();
        if (keys.length === 0) {
            throw new Error("No Groq API keys configured in GROQ_API_KEYS environment variable.");
        }

        const now = Date.now();
        const total = keys.length;

        for (let i = 0; i < total; i++) {
            const index = (this.currentIndex + i) % total;
            const key = keys[index];
            const cooldownUntil = this.cooldowns.get(key) || 0;

            if (now >= cooldownUntil) {
                this.currentIndex = (index + 1) % total;
                return key;
            }
        }

        let soonestKey = keys[0];
        let soonestTime = this.cooldowns.get(soonestKey) || 0;
        for (const key of keys) {
            const time = this.cooldowns.get(key) || 0;
            if (time < soonestTime) {
                soonestTime = time;
                soonestKey = key;
            }
        }
        return soonestKey;
    }

    markKeyRateLimited(key, cooldownSeconds = 60) {
        console.warn(`[GroqKeyManager] Key ${key.slice(0, 10)}... hit rate limit. Setting cooldown of ${cooldownSeconds}s.`);
        this.cooldowns.set(key, Date.now() + cooldownSeconds * 1000);
    }
}

const keyManager = new GroqKeyManager();
module.exports = { keyManager };
