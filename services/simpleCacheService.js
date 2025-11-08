const { Redis } = require("@upstash/redis");

class SimpleCacheService {
  constructor() {
    // connect to upstash
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // cache settings TTL= time to live
    this.CACHE_TTL = 3600;

    console.log("✅ SimpleCacheService initialized");
  }

  // METHOD 1: Save Data to Cache

  /**
   * Save analytics to Redis
   *
   * @param {string} username - GitHub username
   * @param {object} data - Analytics data to cache
   * @returns {Promise<boolean>} - Success status
   *
   * Example usage:
   * await cache.saveAnalytics('octocat', { repos: 100, commits: 5000 });
   */

  async saveAnalytics(username, data) {
    try {
      const cacheKey = `analytics:${username}`;

      const dataToSave = {
        ...data,
        cached_at: Date.now(),
        username: username,
      };

      console.log(`saving to redis : ${cacheKey}`);
      // SETX = set with expriration
      await this.redis.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(dataToSave)
      );

      console.log(`✅ Cached analytics for ${username} (expires in 1 hour)`);
      return true;
    } catch (error) {
      console.error("❌ Error saving to cache:", error.message);
      // Don't crash - just log and continue
      return false;
    }
  }

  //   Method 2 : get data from cache

  /**
   * Get analytics from Redis cache
   *
   * @param {string} username - GitHub username
   * @returns {Promise<object|null>} - Cached data or null if not found
   *
   * Example usage:
   * const data = await cache.getAnalytics('octocat');
   * if (data) {
   *   console.log('Cache hit!', data);
   * } else {
   *   console.log('Cache miss - need to fetch fresh data');
   * }
   */

  async getAnalytics(username) {
    try {
      const cacheKey = `analytics:${username}`;
      console.log(`Checking redis cache:${cacheKey}`);
      const cachedData = await this.redis.get(cacheKey);

      if (!cachedData) {
        console.log(`cache MISS for ${username}`);
        return null;
      }

      // found it JSON parse sting back to object.
      const parsedData = JSON.parse(cachedData);
      // Calculate how old the cache is

      const ageSeconds = Math.floor((Date.now() - parsedData.cached_at) / 1000);

      console.log(`✅ Cache HIT for ${username} (age: ${ageSeconds}s)`);

      return {
        ...parsedData,
        cache_age_seconds: ageSeconds,
        from_cache: true,
      };
    } catch (error) {
      console.error("❌ Error getting from cache:", error.message);
      // If Redis fails, return null (fail gracefully)
      return null;
    }
  }

  //   METHOD 3: Delete from Cache (Manual Refresh)

  /**
   * Delete analytics from cache (force refresh)
   *
   * @param {string} username - GitHub username
   * @returns {Promise<boolean>} - Success status
   *
   * Example usage:
   * await cache.clearAnalytics('octocat');
   * // Now next request will fetch fresh data
   */

  async clearAnalytics(username) {
    try {
      const cacheKey = `analytics:${username}`;

      console.log(`🗑️ Clearing cache: ${cacheKey}`);

      await this.redis.del(cacheKey);

      console.log(`✅ Cache cleared for ${username}`);
      return true;
    } catch (error) {
      console.error("❌ Error clearing cache:", error.message);
      return false;
    }
  }

  // METHOD 4: Check if Cache Exists

  /**
   * Check if user has cached analytics (without fetching)
   *
   * @param {string} username - GitHub username
   * @returns {Promise<boolean>} - True if exists
   */

  async hasCache(username) {
    try {
      const cacheKey = `analytics:${username}`;

      // EXISTS command returns 1 if key exists, 0 if not
      const exists = await this.redis.exists(cacheKey);

      return exists === 1;
    } catch (error) {
      console.error("❌ Error checking cache:", error.message);
      return false;
    }
  }

  // METHOD 5: Get Cache Stats (For Monitoring)

  /**
   * Get statistics about Redis usage
   *
   * @returns {Promise<object>} - Stats object
   */

  async getStats() {
    try {
      // Count total keys matching pattern
      const keys = await this.redis.keys("analytics:*");

      return {
        total_cached_users: keys.length,
        cache_ttl_seconds: this.CACHE_TTL,
        redis_connected: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: error.message,
        redis_connected: false,
      };
    }
  }
}

module.exports = SimpleCacheService;
