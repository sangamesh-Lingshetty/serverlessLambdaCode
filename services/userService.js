// services/userService.js
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

class UserService {
  constructor() {
    this.TABLE_NAME = `DevInsights-Users-${process.env.AWS_STAGE || "dev"}`;
    this.isLocal = !process.env.AWS_EXECUTION_ENV;
  }

  /**
   * Create user and link to organization
   */
  async createUser(data) {
    try {
      console.log(`👤 Creating user: ${data.email}`);

      const user = {
        // Primary Keys
        email: data.email,
        organizationId: data.organizationId,
        
        // Data
        name: data.name || data.email.split("@")[0],
        role: data.role || "member", // admin, member, viewer
        status: "active",
        
        // Metadata
        createdAt: Math.floor(Date.now() / 1000),
        lastLoginAt: null,
        updatedAt: Math.floor(Date.now() / 1000),
      };

      if (this.isLocal) {
        console.log(`✅ MOCK: User created: ${data.email}`);
        return user;
      }

      const params = {
        TableName: this.TABLE_NAME,
        Item: user,
      };

      await dynamodb.put(params).promise();
      console.log(`✅ User saved to DynamoDB: ${data.email}`);
      
      return user;
    } catch (error) {
      console.error(`❌ Error creating user:`, error);
      throw error;
    }
  }

  /**
   * Get user by email and organization
   */
  async getUser(email, organizationId) {
    try {
      if (this.isLocal) {
        return { email, organizationId, role: "admin" };
      }

      const params = {
        TableName: this.TABLE_NAME,
        Key: { email, organizationId },
      };

      const result = await dynamodb.get(params).promise();
      return result.Item || null;
    } catch (error) {
      console.error(`❌ Error getting user:`, error);
      throw error;
    }
  }

  /**
   * Get all users in organization
   */
  async getUsersByOrganization(organizationId) {
    try {
      if (this.isLocal) {
        return [];
      }

      const params = {
        TableName: this.TABLE_NAME,
        IndexName: "OrganizationIndex",
        KeyConditionExpression: "organizationId = :oid",
        ExpressionAttributeValues: {
          ":oid": organizationId,
        },
      };

      const result = await dynamodb.query(params).promise();
      return result.Items || [];
    } catch (error) {
      console.error(`❌ Error getting organization users:`, error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(email, organizationId, updates) {
    try {
      if (this.isLocal) {
        return { email, organizationId, ...updates };
      }

      const updateExpression =
        "SET " +
        Object.keys(updates)
          .map((key) => `${key} = :${key}`)
          .join(", ") +
        ", updatedAt = :updatedAt";

      const expressionAttributeValues = {
        ":updatedAt": Math.floor(Date.now() / 1000),
      };

      Object.keys(updates).forEach((key) => {
        expressionAttributeValues[`:${key}`] = updates[key];
      });

      const params = {
        TableName: this.TABLE_NAME,
        Key: { email, organizationId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamodb.update(params).promise();
      console.log(`✅ User updated: ${email}`);
      
      return result.Attributes;
    } catch (error) {
      console.error(`❌ Error updating user:`, error);
      throw error;
    }
  }

  /**
   * Delete user from organization
   */
  async deleteUser(email, organizationId) {
    try {
      if (this.isLocal) {
        return true;
      }

      const params = {
        TableName: this.TABLE_NAME,
        Key: { email, organizationId },
      };

      await dynamodb.delete(params).promise();
      console.log(`✅ User deleted: ${email}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Error deleting user:`, error);
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async hasPermission(email, organizationId, permission) {
    try {
      const user = await this.getUser(email, organizationId);

      if (!user) {
        return false;
      }

      const permissions = {
        admin: ["read", "write", "delete", "invite", "manage_team"],
        member: ["read", "write"],
        viewer: ["read"],
      };

      const userPermissions = permissions[user.role] || [];
      return userPermissions.includes(permission);
    } catch (error) {
      console.error(`❌ Error checking permission:`, error);
      return false;
    }
  }
}

module.exports = UserService;