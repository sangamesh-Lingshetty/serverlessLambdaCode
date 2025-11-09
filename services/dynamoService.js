// services/dynamoService.js - WITH LOCAL MOCK FOR TESTING

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

class DynamoService {
  constructor() {
    // Detect if running locally
    this.isLocal = !process.env.AWS_EXECUTION_ENV;
    
    if (this.isLocal) {
      console.log('🏠 Running LOCALLY - Using mock DynamoDB (file storage)');
      this.mockDataDir = path.join(__dirname, '..', '.mock-dynamodb');
      this.initMockStorage();
    } else {
      console.log('☁️  Running on AWS - Using real DynamoDB');
      this.dynamodb = new AWS.DynamoDB.DocumentClient({
        region: process.env.AWS_REGION || 'ap-south-1'
      });
    }
    
    this.TABLE_NAME = `DevInsights-AnalyticsCache-${process.env.AWS_STAGE || 'dev'}`;
    this.TTL_DAYS = 30;
    
    console.log(`✅ DynamoService initialized (table: ${this.TABLE_NAME})`);
  }

  // ============================================
  // MOCK STORAGE SETUP (For Local Testing)
  // ============================================
  
  initMockStorage() {
    // Create directory for mock data if it doesn't exist
    if (!fs.existsSync(this.mockDataDir)) {
      fs.mkdirSync(this.mockDataDir, { recursive: true });
      console.log(`📁 Created mock DynamoDB directory: ${this.mockDataDir}`);
    }
  }

  getMockFilePath(username) {
    return path.join(this.mockDataDir, `${username}.json`);
  }

  // ============================================
  // GET FROM DYNAMODB (with local mock)
  // ============================================
  
  async getAnalytics(username) {
    try {
      console.log(`🔍 Checking ${this.isLocal ? 'MOCK' : 'REAL'} DynamoDB for ${username}...`);

      // LOCAL: Read from file
      if (this.isLocal) {
        const filePath = this.getMockFilePath(username);
        
        if (!fs.existsSync(filePath)) {
          console.log(`❌ DynamoDB MISS for ${username} (file not found)`);
          return null;
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const item = JSON.parse(fileContent);

        // Check if expired
        const now = Math.floor(Date.now() / 1000);
        if (item.expiresAt && item.expiresAt < now) {
          console.log(`⏰ DynamoDB data expired for ${username}`);
          fs.unlinkSync(filePath); // Delete expired file
          return null;
        }

        console.log(`✅ DynamoDB HIT for ${username} (from mock file)`);
        
        const ageSeconds = Math.floor((Date.now() - item.cached_at) / 1000);

        return {
          ...item.data,
          cached_at: item.cached_at,
          cache_age_seconds: ageSeconds,
          from_cache: true,
          cache_tier: 'dynamodb'
        };
      }

      // AWS: Use real DynamoDB
      const params = {
        TableName: this.TABLE_NAME,
        Key: {
          userId: username,
          cacheKey: 'dashboard'
        }
      };

      const result = await this.dynamodb.get(params).promise();

      if (!result.Item) {
        console.log(`❌ DynamoDB MISS for ${username}`);
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      if (result.Item.expiresAt && result.Item.expiresAt < now) {
        console.log(`⏰ DynamoDB data expired for ${username}`);
        return null;
      }

      console.log(`✅ DynamoDB HIT for ${username}`);
      
      const ageSeconds = Math.floor((Date.now() - result.Item.cached_at) / 1000);

      return {
        ...result.Item.data,
        cached_at: result.Item.cached_at,
        cache_age_seconds: ageSeconds,
        from_cache: true,
        cache_tier: 'dynamodb'
      };

    } catch (error) {
      console.error('❌ DynamoDB get error:', error.message);
      return null;
    }
  }

  // ============================================
  // SAVE TO DYNAMODB (with local mock)
  // ============================================
  
  async saveAnalytics(username, data) {
    try {
      console.log(`💾 Saving to ${this.isLocal ? 'MOCK' : 'REAL'} DynamoDB: ${username}`);

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + (this.TTL_DAYS * 24 * 60 * 60);

      const item = {
        userId: username,
        cacheKey: 'dashboard',
        data: data,
        cached_at: Date.now(),
        createdAt: now,
        expiresAt: expiresAt,
        updatedAt: now
      };

      // LOCAL: Save to file
      if (this.isLocal) {
        const filePath = this.getMockFilePath(username);
        fs.writeFileSync(filePath, JSON.stringify(item, null, 2));
        console.log(`✅ Saved to MOCK DynamoDB for ${username} (file: ${path.basename(filePath)})`);
        return true;
      }

      // AWS: Use real DynamoDB
      const params = {
        TableName: this.TABLE_NAME,
        Item: item
      };

      await this.dynamodb.put(params).promise();
      
      console.log(`✅ Saved to REAL DynamoDB for ${username} (expires in ${this.TTL_DAYS} days)`);
      return true;

    } catch (error) {
      console.error('❌ DynamoDB save error:', error.message);
      return false;
    }
  }

  // ============================================
  // DELETE FROM DYNAMODB (with local mock)
  // ============================================
  
  async deleteAnalytics(username) {
    try {
      console.log(`🗑️ Deleting from ${this.isLocal ? 'MOCK' : 'REAL'} DynamoDB: ${username}`);

      // LOCAL: Delete file
      if (this.isLocal) {
        const filePath = this.getMockFilePath(username);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`✅ Deleted from MOCK DynamoDB: ${username}`);
        } else {
          console.log(`⚠️ File not found for ${username}`);
        }
        
        return true;
      }

      // AWS: Use real DynamoDB
      const params = {
        TableName: this.TABLE_NAME,
        Key: {
          userId: username,
          cacheKey: 'dashboard'
        }
      };

      await this.dynamodb.delete(params).promise();
      
      console.log(`✅ Deleted from REAL DynamoDB: ${username}`);
      return true;

    } catch (error) {
      console.error('❌ DynamoDB delete error:', error.message);
      return false;
    }
  }

  // ============================================
  // GET ALL CACHED USERS (with local mock)
  // ============================================
  
  async getAllCachedUsers() {
    try {
      // LOCAL: List files
      if (this.isLocal) {
        if (!fs.existsSync(this.mockDataDir)) {
          return [];
        }

        const files = fs.readdirSync(this.mockDataDir)
          .filter(f => f.endsWith('.json'));

        return files.map(file => ({
          username: file.replace('.json', ''),
          last_updated: fs.statSync(path.join(this.mockDataDir, file)).mtime.getTime()
        }));
      }

      // AWS: Use real DynamoDB
      const params = {
        TableName: this.TABLE_NAME,
        ProjectionExpression: 'userId, updatedAt'
      };

      const result = await this.dynamodb.scan(params).promise();
      
      return result.Items.map(item => ({
        username: item.userId,
        last_updated: item.updatedAt
      }));

    } catch (error) {
      console.error('❌ DynamoDB scan error:', error.message);
      return [];
    }
  }

  // ============================================
  // CLEANUP (for testing)
  // ============================================
  
  clearAllMockData() {
    if (this.isLocal && fs.existsSync(this.mockDataDir)) {
      const files = fs.readdirSync(this.mockDataDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(this.mockDataDir, file));
      });
      console.log('🧹 Cleared all mock DynamoDB data');
    }
  }
}

module.exports = DynamoService;