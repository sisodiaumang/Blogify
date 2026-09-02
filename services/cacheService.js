const NodeCache = require('node-cache');

// In-memory High Performance LRU/TTL Cache
// stdTTL: 120 seconds default, checkperiod: 60 seconds
const memoryCache = new NodeCache({
    stdTTL: 120,
    checkperiod: 60,
    useClones: false,
    maxKeys: 1000
});

const cacheService = {
    get: (key) => memoryCache.get(key),
    set: (key, val, ttl = 120) => memoryCache.set(key, val, ttl),
    del: (key) => memoryCache.del(key),
    flush: () => memoryCache.flushAll(),

    /**
     * Cache-aside helper: Returns cached data or computes, caches, and returns fresh data.
     * @param {string} key 
     * @param {number} ttl 
     * @param {Function} fetchFn 
     */
    async wrap(key, ttl, fetchFn) {
        const cached = memoryCache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const fresh = await fetchFn();
        if (fresh !== undefined && fresh !== null) {
            memoryCache.set(key, fresh, ttl);
        }
        return fresh;
    },

    /**
     * Invalidates all blog-related list and recommendation caches
     */
    invalidateBlogCaches: () => {
        const keys = memoryCache.keys();
        const blogKeys = keys.filter(k => k.startsWith('home:') || k.startsWith('blog:') || k.startsWith('seo:'));
        if (blogKeys.length > 0) {
            memoryCache.del(blogKeys);
        }
    }
};

module.exports = cacheService;
