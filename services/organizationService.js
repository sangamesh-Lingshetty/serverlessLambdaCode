// services/organizationService.js
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

class OrganizationService {
  constructor() {
    this.TABLE_NAME = `DevInsights-Organizations-${process.env.AWS_STAGE || "dev"}`;
    this.isLocal = !process.env.AWS_EXECUTION_ENV;
  }

  /**
   * Create a new organization
   * Called when user signs up
   */
  async createOrganization(data) {
    try {
      console.log(`🏢 Creating organization: ${data.organizationId}`);

      const organization = {
        // Primary Key
        organizationId: data.organizationId,
        
        // Data
        name: data.name || "My Organization",
        plan: data.plan || "free",
        maxMembers: data.maxMembers || 5,
        currentMembers: 1,
        
        // Metadata
        status: "active",
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      };

      if (this.isLocal) {
        console.log(`✅ MOCK: Organization created: ${data.organizationId}`);
        return organization;
      }

      // Save to DynamoDB
      const params = {
        TableName: this.TABLE_NAME,
        Item: organization,
      };

      await dynamodb.put(params).promise();
      console.log(`✅ Organization saved to DynamoDB: ${data.organizationId}`);
      
      return organization;
    } catch (error) {
      console.error(`❌ Error creating organization:`, error);
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(organizationId) {
    try {
      if (this.isLocal) {
        return { organizationId, name: "Test Org" };
      }

      const params = {
        TableName: this.TABLE_NAME,
        Key: { organizationId },
      };

      const result = await dynamodb.get(params).promise();
      return result.Item || null;
    } catch (error) {
      console.error(`❌ Error getting organization:`, error);
      throw error;
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(organizationId, updates) {
    try {
      if (this.isLocal) {
        return { organizationId, ...updates };
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
        Key: { organizationId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamodb.update(params).promise();
      console.log(`✅ Organization updated: ${organizationId}`);
      
      return result.Attributes;
    } catch (error) {
      console.error(`❌ Error updating organization:`, error);
      throw error;
    }
  }
}

module.exports = OrganizationService;