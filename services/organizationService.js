const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

class OrganizationService {
  constructor() {
    this.dynamodb = new AWS.DynamoDB.DocumentClient({
      region: process.env.AWS_REGION || "ap-south-1",
    });

    this.tableName = `DevInsights-Organizations-${
      process.env.AWS_STAGE || "dev"
    }`;
    console.log("✅ OrganizationService initialized");
  }

  // create organization
  /**
   * Create a new organization
   *
   * @param {Object} orgData - Organization data
   * @param {string} orgData.name - Organization name
   * @param {string} orgData.plan - Subscription plan
   * @returns {Promise<Object>} - Created organization
   */

  async create({ name, plan = "free" }) {
    try {
      console.log(`📝 Creating organization: ${name}`);
      //   generate uniue ID
      const id = `org-${uuidv4().substring(0, 8)}`;
      // set the plan limit
      const planLimits = this.getPlanLimits(plan);

      const organization = {
        id: id,
        name: name,
        plan: plan,

        maxMemmbers: planLimits.maxMemmbers,
        maxRepos: planLimits.maxRepos,
        features: planLimits.features,

        // Billing
        billing: {
          status: "active",
          trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days trial
          nextBillDate: null,
        },

        // Settings
        settings: {
          timezone: "UTC",
          githubInstalled: false,
          aiEnabled: plan !== "free",
        },
        // Metadata
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      //   save to dynamodb
      await this.dynamodb
        .put({
          TableName: this.tableName,
          Item: organization,
        })
        .promise();

      console.log(`✅ Organization created: ${id}`);

      return organization;
    } catch (error) {
      console.error("❌ Create organization error:", error.message);
      throw error;
    }
  }

  //   get organization
  /**
   * Get organization by ID
   *
   * @param {string} id - Organization ID
   * @returns {Promise<Object|null>} - Organization or null
   */

  async getById(id) {
    try {
      const result = await this.dynamodb
        .get({
          TableName: this.tableName,
          Key: { id },
        })
        .promise();

      return result.Item || null;
    } catch (error) {
      console.error("❌ Get organization error:", error.message);
      throw error;
    }
  }

  //   update organization
  /**
   * Update organization details
   *
   * @param {string} id - Organization ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} - Updated organization
   */
  async update(id, updates) {
    try {
      console.log(`📝 Updating organization: ${id}`);

      let updateExpression = "SET updatedAt = :updatedAt";
      const expressionAttributeValue = {
        ":updatedAt": Date.now(),
      };

      //Add each update field
      Object.keys(updates).forEach((key) => {
        updateExpression += `, #${key} = :${key}`;
        expressionAttributeValue[`:${key}`] = updates[key];
      });

      const expressionAttributeNames = {};
      Object.keys(updates).forEach((key) => {
        expressionAttributeNames[`#${key}`] = key;
      });

      const result = await this.dynamodb.update({
        TableName: this.tableName,
        key: { id },
        UpateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValue,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: "ALL_NEW",
      }).promise();

      console.log(`✅ Organization updated: ${id}`);

      return result.Attributes;
    } catch (error) {}
  }
}
