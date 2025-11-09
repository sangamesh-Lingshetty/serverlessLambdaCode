// services/multiTierCache.js
// INTELLIGENT 2-TIER CACHING: Redis (hot) + DynamoDB (cold)

const SimpleCacheService = require("./simpleCacheService");
const DynamoService = require("./dynamoService");

class MultiTeirCache {
  constructor() {
    this.redis = new SimpleCacheService(); //hot cache (1 hour TTL time to leave)
    this.dynamo = new DynamoService(); //cold storage (30 days TTL)
    console.log("✅ MultiTierCache initialized (Redis + DynamoDB)");
  }

  // SMART GET: Check both tiers

  /**
   * Get analytics with intelligent multi-tier caching
   *
   * Flow:
   * 1. Check Redis (fastest - 0.1ms)
   * 2. If miss, check DynamoDB (medium - 20ms)
   * 3. If DynamoDB hit, promote to Redis
   * 4. If both miss, return null
   *
   * @param {string} username - GitHub username
   * @returns {Promise<object|null>} - Cached data or null
   */

  async getAnalytics(username) {
    try {
      // TIER 1: Check Redis

      console.log(`🔥 Checking TIER 1 (Redis) for ${username}...`);
      const redisData = await this.redis.getAnalytics(username);

      if (redisData) {
        console.log(
          `✅ TIER 1 HIT (Redis) - ${redisData.cache_age_seconds}s old`
        );
        return {
          ...redisData,
          cache_tier: "redis",
          tier_number: 1,
        };
      }

      console.log(`❌ TIER 1 MISS (Redis)`);
      // TIER 2: Check DynamoDB

      console.log(`🧊 Checking TIER 2 (DynamoDB) for ${username}...`);

      const dynamoData = await this.dynamo.getAnalytics(username);

      if (dynamoData) {
        console.log(
          `✅ TIER 2 HIT (DynamoDB) - ${dynamoData.cache_age_seconds}s old`
        );

        // CACHE PROMOTION: Move to Redis for faster future access
        console.log(`⬆️ Promoting to Redis (hot cache)...`);
        await this.redis.saveAnalytics(username, dynamoData);

        return {
          ...dynamoData,
          cache_tier: "dynamodb",
          tier_number: 2,
          promoted_to_redis: true,
        };
      }

      console.log(`❌ TIER 2 MISS (DynamoDB)`);
      console.log(`💥 COMPLETE CACHE MISS - need fresh data`);

      return null;
    } catch (error) {
      console.log(
        "Error while fetching the get analytics redis and dynamodb.",
        error.message
      );
      return null;
    }
  }

  // SMART SAVE: Save to both tiers

  /**
   * Save analytics to both cache tiers
   *
   * Strategy:
   * - Save to Redis (hot cache - 1 hour)
   * - Save to DynamoDB (cold storage - 30 days)
   * - Both saves happen in parallel for speed
   *
   * @param {string} username - GitHub username
   * @param {object} data - Analytics data
   * @returns {Promise<object>} - Save status
   */

  async saveAnalytics(username, data) {
    try {
      console.log(`💾 Saving to BOTH tiers for ${username}...`);
      const [redisResult, dynamoResult] = await Promise.all([
        this.redis.saveAnalytics(username, data),
        this.dynamo.saveAnalytics(username, data),
      ]);
      const success = redisResult && dynamoResult;

      if (success) {
        console.log("Saved to both redis + dynamoDB");
      } else {
        console.warn(
          `⚠️ Partial save: Redis=${redisResult}, DynamoDB=${dynamoResult}`
        );
      }
      return {
        success,
        redis: redisResult,
        dynamodb: dynamoResult,
      };
    } catch (error) {
      console.error("❌ Multi-tier save error:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // CLEAR CACHE: Delete from both tiers

  /**
   * Clear analytics from both cache tiers
   *
   * @param {string} username - GitHub username
   * @returns {Promise<object>} - Clear status
   */

  async clearAnalytics(username) {
    try {
      console.log(`🗑️ Clearing BOTH tiers for ${username}...`);

      const [redisResult, dynamoResult] = await Promise.all([
        this.redis.clearAnalytics(username),
        this.dynamo.deleteAnalytics(username),
      ]);

      return {
        success: redisResult && dynamoResult,
        redis: redisResult,
        dynamodb: dynamoResult,
      };
    } catch (error) {
      console.error("❌ Multi-tier clear error:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // GET STATISTICS: Combined stats from both tiers

  /**
   * Get statistics about cache usage
   *
   * @returns {Promise<object>} - Cache statistics
   */

  async getStats() {
    try {
      const [redisStats, dynamoCacheUsers] = await Promise.all([
        this.redis.getStats(),
        this.dynamo.getAllCachedUsers(),
      ]);

      return {
        redis: redisStats,
        dynamodb: {
          total_cached_users: dynamoCacheUsers.length,
          users: dynamoCacheUsers.slice(0, 10), // Show first 10
        },
        architecture: {
          tier_1: "Redis (Upstash) - Hot cache (1 hour)",
          tier_2: "DynamoDB - Cold storage (30 days)",
          strategy: "Check Redis → DynamoDB → GitHub API",
        },
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
        return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}


module.exports = MultiTeirCache;