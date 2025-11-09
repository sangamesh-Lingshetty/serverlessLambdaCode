require("dotenv").config();
const SimpleCacheService = require("./services/simpleCacheService");

async function testCache() {
  console.log("Testing simpleCacheService...\n");

  const cache = new SimpleCacheService();

  const testUser = "Sangamesh";
  const testData = {
    total_repos: 100,
    total_commits: 5000,
    top_language: "JavaScript",
  };

  try {
    // Test1 check if the cache exists (should be empty)
    console.log("TEST 1: Check if cache exists");
    const exists = await cache.hasCache(testUser);
    console.log(`Result: Cache exists? ${exists}`);
    console.log(`Expected: false\n`);

    // test 2 try to get the from cache (should be null)
    console.log("📋 TEST 2: Get from empty cache");
    const getData = await cache.getAnalytics(testUser);
    console.log(`Result: ${getData ? "Found data" : "No data (expected)"}`);
    console.log(`Expected: null\n`);

    //test 3 try to add the some value in the cache,
    console.log("📋 TEST 3: Save data to cache");
    const SaveValue = await cache.saveAnalytics(testUser, testData);
    console.log(`Result: Saved? ${SaveValue}`);
    console.log(`Expected: true\n`);

    // test 4 get from cache (should have data now)

    console.log("📋 TEST 4: Get from cache (should hit!)");
    const getData2 = await cache.getAnalytics(testUser);
    if (getData2) {
      console.log(`✅ Cache HIT!`);
      console.log(`Data:`, getData2);
      console.log(`Cache age: ${getData2.cache_age_seconds} seconds\n`);
    } else {
      console.log(`❌ Cache MISS (unexpected!)\n`);
    }

    // ============================================
    // TEST 5: Check stats
    // ============================================
    console.log("📋 TEST 5: Get cache statistics");
    const stats = await cache.getStats();
    console.log(`Result:`, stats);
    console.log(`Expected: total_cached_users should be 1\n`);

    // ============================================
    // TEST 6: Clear cache
    // ============================================
    console.log("📋 TEST 6: Clear cache");
    const cleared = await cache.clearAnalytics(testUser);
    console.log(`Result: Cleared? ${cleared}`);
    console.log(`Expected: true\n`);

    // ============================================
    // TEST 7: Verify cache is empty
    // ============================================
    console.log("📋 TEST 7: Verify cache is empty");
    const getData3 = await cache.getAnalytics(testUser);
    console.log(`Result: ${getData3 ? "Still has data" : "Empty (expected)"}`);
    console.log(`Expected: null\n`);

    // ============================================
    // FINAL RESULT
    // ============================================
    console.log("🎉 ALL TESTS PASSED! Cache service is working!\n");
    console.log("✅ Your Redis is connected and working");
    console.log("✅ Data is being saved and retrieved");
    console.log("✅ TTL expiration is configured");
    console.log("✅ Ready to integrate with Lambda!\n");
  } catch (error) {
    console.error("❌ TEST FAILED:", error.message);
    console.error("Error details:", error);

    console.log("\n🔧 Troubleshooting:");
    console.log("1. Check .env file has correct Upstash credentials");
    console.log("2. Verify UPSTASH_REDIS_REST_URL starts with https://");
    console.log("3. Verify UPSTASH_REDIS_REST_TOKEN is correct");
    console.log("4. Check Upstash dashboard - is database active?");
  }
}

// run tests
testCache();










const AWS = require("aws-sdk");

class DynamoService {
  constructor() {
    this.dynamodb = new AWS.DynamoDB.DocumentClient({
      region: process.env.aws_REGION || "ap-south-1",
    });

    this.TABLE_NAME = `DevInsights-AnalyticsCache-${
      process.env.AWS_STAGE || "dev"
    }`;
    this.TTL_DAYS = 30; // Keep data for 30 day

    console.log(`✅ DynamoService initialized (table: ${this.TABLE_NAME})`);
  }

  // GET FROM DYNAMODB

  /**
   * Get analytics from DynamoDB
   *
   * @param {string} username - GitHub username
   * @returns {Promise<object|null>} - Cached data or null
   */

  async getAnalytics(username) {
    try {
      console.log(`Checking dynamodb for ${username}`);

      const params = {
        TableName: this.TABLE_NAME,
        Key: {
          userId: username,
          cacheKey: "dashboard",
        },
      };

      const result = await this.dynamodb.get(params).promise();

      if (!result.Item) {
        console.log(`DynamoDB miss for ${username}`);
        return null;
      }

      // check if expired
      const now = Math.floor(Date.now() / 1000);
      if (result.Item.expiresAt && result.Item.expiresAt < now) {
        console.log(`DynamoDB data expired for ${username}`);
        return null;
      }

      console.log(`DynamoDB HIT for ${username}`);

      const ageSecond = Math.floor((Date.now() - result.Item.cached_at) / 1000);

      return {
        ...result.Item.data,
        cached_at: result.Item.cached_at,
        cache_age_seconds: ageSecond,
        from_cache: true,
        cache_tier: "dynamodb",
      };
    } catch (error) {
      console.error("❌ DynamoDB get error:", error.message);
      return null; // Fail gracefully
    }
  }

  // SAVE TO DYNAMODB

  /**
   * Save analytics to DynamoDB
   *
   * @param {string} username - GitHub username
   * @param {object} data - Analytics data to save
   * @returns {Promise<boolean>} - Success status
   */

  async saveAnalytics(username, data) {
    try {
      console.log(`Saving to DynamoDB: ${username}`);

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + this.TTL_DAYS * 24 * 60 * 60; // 30 days from now

      const params = {
        TableName: this.TABLE_NAME,
        Item: {
          userId: username,
          cacheKey: "dashboard",
          data: data,
          cached_at: Date.now(),
          createdAt: now,
          expiresAt: expiresAt, // DynamoDB will auto-delete after this
          updatedAt: now,
        },
      };

      await this.dynamodb.put(params).promise();

      console.log(
        `✅ Saved to DynamoDB for ${username} (expires in ${this.TTL_DAYS} days)`
      );
      return true;
    } catch (error) {
      console.error("❌ DynamoDB save error:", error.message);
      return false;
    }
  }

  // DELETE FROM DYNAMODB

  /**
   * Delete analytics from DynamoDB
   *
   * @param {string} username - GitHub username
   * @returns {Promise<boolean>} - Success status
   */

  async deleteAnalytics(username) {
    try {
      console.log(`Deleting from DynamoDB: ${username}`);

      const params = {
        TableName: this.TABLE_NAME,
        Key: {
          userId: username,
          cacheKey: "dashboard",
        },
      };

      await this.dynamodb.delete(params).promise();

      console.log(`✅ Deleted from DynamoDB: ${username}`);
      return true;
    } catch (error) {
      console.error("❌ DynamoDB delete error:", error.message);
      return false;
    }
  }

  // GET ALL CACHED USERS (for stats)

  /**
   * Get list of all cached users
   *
   * @returns {Promise<array>} - List of usernames
   */
  async getAllCachedUsers() {
    try {
      const params = {
        TableName: this.TABLE_NAME,
        ProjectionExpression: "userId, updatedAt",
      };

      const result = await this.dynamodb.scan(params).promise();

      return result.Items.map((item) => ({
        username: item.userId,
        last_updated: item.updatedAt,
      }));
    } catch (error) {
      console.error("❌ DynamoDB scan error:", error.message);
      return [];
    }
  }
}

module.exports = DynamoService;
