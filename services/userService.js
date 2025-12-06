const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require('uuid');

class UserService {
  /**
   * Create user and link to organization
   * Called after Cognito user is created
   */
  async createUser(data) {
    // data = {
    //   cognitoId: 'cognito-abc-123',
    //   email: 'alice@google.com',
    //   name: 'Alice Smith',
    //   organizationId: 'org-google',
    //   role: 'admin' (first user of org)
    // }
    
    const userId = `user-${uuidv4().substring(0, 8)}`;
    
    const user = {
      // Partition Key: User ID
      PK: `USER#${userId}`,
      // Sort Key: Organization they belong to
      SK: organizationId,
      
      // Data
      id: userId,
      email: data.email,
      name: data.name,
      
      // Link to Cognito
      cognitoId: data.cognitoId,
      
      // Organization
      organizationId: data.organizationId,
      role: data.role || 'member',  // admin/member/viewer
      
      // Status
      status: 'active',
      emailVerified: true,
      
      // Timestamps
      createdAt: Math.floor(Date.now() / 1000),
      lastLoginAt: null,
      updatedAt: Math.floor(Date.now() / 1000)
    };
    
    const params = {
      TableName: process.env.DYNAMODB_TABLE || 'DevInsights-Organizations',
      Item: user
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`✅ User created: ${userId} in ${data.organizationId}`);
      return user;
    } catch (error) {
      console.error(`❌ Failed to create user:`, error);
      throw error;
    }
  }
  
  /**
   * Get user by Cognito ID
   */
  async getUserByCognitoId(cognitoId) {
    const params = {
      TableName: process.env.DYNAMODB_TABLE || 'DevInsights-Organizations',
      IndexName: 'CognitoIdIndex',  // We'll create this GSI
      KeyConditionExpression: 'cognitoId = :cid',
      ExpressionAttributeValues: {
        ':cid': cognitoId
      }
    };
    
    try {
      const result = await dynamodb.query(params).promise();
      return result.Items ? result.Items[0] : null;
    } catch (error) {
      console.error(`❌ Failed to get user:`, error);
      throw error;
    }
  }
  
  /**
   * Update last login time
   */
  async updateLastLogin(userId, organizationId) {
    const params = {
      TableName: process.env.DYNAMODB_TABLE || 'DevInsights-Organizations',
      Key: {
        PK: `USER#${userId}`,
        SK: organizationId
      },
      UpdateExpression: 'SET lastLoginAt = :now',
      ExpressionAttributeValues: {
        ':now': Math.floor(Date.now() / 1000)
      }
    };
    
    try {
      await dynamodb.update(params).promise();
      console.log(`✅ Updated last login for user: ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to update login:`, error);
    }
  }
  
  /**
   * Check if user has permission to action
   */
  async checkPermission(userId, organizationId, action) {
    const user = await this.getUser(userId, organizationId);
    
    if (!user) {
      return false;
    }
    
    // Role-based permissions
    const permissions = {
      admin: ['read', 'write', 'delete', 'manage_team', 'billing'],
      member: ['read', 'write'],
      viewer: ['read']
    };
    
    return permissions[user.role]?.includes(action) || false;
  }
  
  /**
   * Get user details
   */
  async getUser(userId, organizationId) {
    const params = {
      TableName: process.env.DYNAMODB_TABLE || 'DevInsights-Organizations',
      Key: {
        PK: `USER#${userId}`,
        SK: organizationId
      }
    };
    
    try {
      const result = await dynamodb.get(params).promise();
      return result.Item || null;
    } catch (error) {
      console.error(`❌ Failed to get user:`, error);
      throw error;
    }
  }
}

module.exports = UserService;
// ```

// **Why Each Method?**
// ```
// ✅ createUser:
//    Create user profile after Cognito signup

// ✅ getUserByCognitoId:
//    After login, convert Cognito ID → User details

// ✅ updateLastLogin:
//    Track when user last accessed app

// ✅ checkPermission:
//    Before action → Verify user has permission
//    Example: Admin can delete, Viewer cannot

// ✅ getUser:
//    Get user details for current request