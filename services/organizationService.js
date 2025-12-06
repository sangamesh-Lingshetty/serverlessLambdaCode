// DevInsights-Organizations


const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require('uuid');

class OrganizationService {
  /**
   * Create a new organization
   * Called when user signs up
   */
  async createOrganization(data) {
    const organizationId = `org-${data.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    
    const organization = {
      // Partition Key
      PK: `ORG#${organizationId}`,
      // Sort Key
      SK: 'METADATA',
      
      // Data
      id: organizationId,
      name: data.name,
      plan: 'free',                    // Default: free plan
      maxMembers: 5,                   // Free plan: max 5 members
      
      billing: {
        status: 'active',
        createdAt: new Date().toISOString(),
        nextBillDate: null
      },
      
      settings: {
        timezone: 'UTC',
        language: 'en',
        notifications: true
      },
      
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000)
    };
    
    // Save to DynamoDB
    const params = {
      TableName: process.env.DYNAMODB_TABLE || 'DevInsights-Organizations',
      Item: organization
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`✅ Organization created: ${organizationId}`);
      return organization;
    } catch (error) {
      console.error(`❌ Failed to create organization:`, error);
      throw error;
    }
  }
  
  /**
   * Get organization by ID
   */
  async getOrganization(organizationId) {
    const params = {
      TableName: process.env.DYNAMODB_TABLE || 'DevInsights-Organizations',
      Key: {
        PK: `ORG#${organizationId}`,
        SK: 'METADATA'
      }
    };
    
    try {
      const result = await dynamodb.get(params).promise();
      return result.Item || null;
    } catch (error) {
      console.error(`❌ Failed to get organization:`, error);
      throw error;
    }
  }
  
  /**
   * Get all members in organization
   */
  async getOrganizationMembers(organizationId) {
    const params = {
      TableName: process.env.DYNAMODB_TABLE || 'DevInsights-Organizations',
      IndexName: 'OrganizationIndex',  // We'll create this GSI
      KeyConditionExpression: 'organizationId = :oid',
      ExpressionAttributeValues: {
        ':oid': organizationId
      }
    };
    
    try {
      const result = await dynamodb.query(params).promise();
      return result.Items || [];
    } catch (error) {
      console.error(`❌ Failed to get members:`, error);
      throw error;
    }
  }
  
  /**
   * Update organization plan
   */
  async upgradePlan(organizationId, newPlan) {
    const plans = {
      free: { name: 'free', maxMembers: 5, price: 0 },
      pro: { name: 'pro', maxMembers: 25, price: 99 },
      enterprise: { name: 'enterprise', maxMembers: 1000, price: 'custom' }
    };
    
    const params = {
      TableName: process.env.DYNAMODB_TABLE || 'DevInsights-Organizations',
      Key: {
        PK: `ORG#${organizationId}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET #plan = :plan, maxMembers = :members, updatedAt = :now',
      ExpressionAttributeNames: {
        '#plan': 'plan'
      },
      ExpressionAttributeValues: {
        ':plan': newPlan,
        ':members': plans[newPlan].maxMembers,
        ':now': Math.floor(Date.now() / 1000)
      },
      ReturnValues: 'ALL_NEW'
    };
    
    try {
      const result = await dynamodb.update(params).promise();
      console.log(`✅ Plan upgraded to: ${newPlan}`);
      return result.Attributes;
    } catch (error) {
      console.error(`❌ Failed to upgrade plan:`, error);
      throw error;
    }
  }
}

module.exports = OrganizationService;
// ```

// **Why Each Method?**
// ```
// ✅ createOrganization:
//    When user signs up → Creates their company account

// ✅ getOrganization:
//    Need to fetch org details → Check plan, billing, etc.

// ✅ getOrganizationMembers:
//    Admin wants to see team → List all members

// ✅ upgradePlan:
//    User upgrades → free → pro → More features unlocked
