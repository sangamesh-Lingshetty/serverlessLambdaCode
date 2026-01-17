// services/invitationService.js
const crypto = require("crypto");
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

class InvitationService {
  constructor() {
    this.TABLE_NAME = `DevInsights-Invitations-${
      process.env.AWS_STAGE || "dev"
    }`;
    this.isLocal = !process.env.AWS_EXECUTION_ENV;
  }

  generateToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Create team invitation
   */
  async createInvitation(
    organizationId,
    invitedEmail,
    invitedBy,
    role = "member"
  ) {
    try {
      console.log(`📧 Creating invitation for: ${invitedEmail}`);

      const invitationId = `inv-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const token = this.generateToken();
      const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days

      const invitation = {
        // Primary Keys
        organizationId,
        invitationId,

        // Data
        invitedEmail,
        invitedBy,
        role,
        token,
        status: "pending",

        // Metadata
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt,
        updatedAt: Math.floor(Date.now() / 1000),
      };

      if (this.isLocal) {
        console.log(`✅ MOCK: Invitation created: ${token}`);
        return invitation;
      }

      const params = {
        TableName: this.TABLE_NAME,
        Item: invitation,
      };

      await dynamodb.put(params).promise();
      console.log(`✅ Invitation created: ${token}`);

      return invitation;
    } catch (error) {
      console.error(`❌ Error creating invitation:`, error);
      throw error;
    }
  }

  /**
   * Get invitation by token
   */
  async getInvitation(token) {
    try {
      if (this.isLocal) {
        return null;
      }

      const params = {
        TableName: this.TABLE_NAME,
        IndexName: "TokenIndex",
        KeyConditionExpression: "#token = :token",
        ExpressionAttributeNames: {
          "#token": "token",
        },
        ExpressionAttributeValues: {
          ":token": token,
        },
      };

      const result = await dynamodb.query(params).promise();

      if (result.Items && result.Items.length > 0) {
        const invitation = result.Items[0];

        // Check if expired
        const now = Math.floor(Date.now() / 1000);
        if (invitation.expiresAt < now) {
          console.log(`⏰ Invitation expired: ${token}`);
          return null;
        }

        console.log(`✅ Invitation found: ${token}`);
        return invitation;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error getting invitation:`, error);
      return null;
    }
  }

  /**
   * Get organization invitations
   */
  async getOrganizationInvitations(organizationId) {
    try {
      if (this.isLocal) {
        return [];
      }

      const params = {
        TableName: this.TABLE_NAME,
        KeyConditionExpression: "organizationId = :oid",
        ExpressionAttributeValues: {
          ":oid": organizationId,
        },
      };

      const result = await dynamodb.query(params).promise();
      return result.Items || [];
    } catch (error) {
      console.error(`❌ Error getting invitations:`, error);
      return [];
    }
  }

  /**
   * Update invitation status
   */
  async updateInvitationStatus(organizationId, invitationId, status) {
    try {
      if (this.isLocal) {
        return true;
      }

      const params = {
        TableName: this.TABLE_NAME,
        Key: { organizationId, invitationId },
        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": status,
          ":updatedAt": Math.floor(Date.now() / 1000),
        },
      };

      await dynamodb.update(params).promise();
      console.log(`✅ Invitation status updated: ${status}`);

      return true;
    } catch (error) {
      console.error(`❌ Error updating invitation:`, error);
      throw error;
    }
  }
}

module.exports = InvitationService;
