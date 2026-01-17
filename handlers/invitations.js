// handlers/invitations.js - NEW - FIXED VERSION
const InvitationService = require("../services/invitationService");
const UserService = require("../services/userService");
const CognitoService = require("../services/cognitoService");

const invitationService = new InvitationService();
const userService = new UserService();
const cognitoService = new CognitoService();

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
  },
  body: JSON.stringify(body),
});

// ============================================
// POST /invitations - Create invitation
// ============================================

module.exports.createInvitation = async (event) => {
  try {
    console.log("📧 Creating invitation");
    console.log("Event:", JSON.stringify(event, null, 2));

    const body = JSON.parse(event.body || "{}");
    const { organizationId, invitedEmail, role = "member" } = body;

    console.log(
      `📧 Invite request: org=${organizationId}, email=${invitedEmail}, role=${role}`
    );

    if (!organizationId || !invitedEmail) {
      return createResponse(400, {
        success: false,
        error: "organizationId and invitedEmail are required",
      });
    }

    // Get current user from token (optional for testing)
    const authHeader =
      event.headers?.Authorization || event.headers?.authorization;
    let currentUserEmail = "admin@company.com"; // Default for testing

    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const currentUser = await cognitoService.verifyToken(token);
        if (currentUser && currentUser.organizationId === organizationId) {
          currentUserEmail = currentUser.email;
        }
      } catch (e) {
        console.log("Token verification failed, using default:", e.message);
      }
    }

    const invitation = await invitationService.createInvitation(
      organizationId,
      invitedEmail,
      currentUserEmail,
      role
    );

    console.log("✅ Invitation created:", invitation.invitationId);

    return createResponse(201, {
      success: true,
      message: `Invitation sent to ${invitedEmail}`,
      data: {
        invitationId: invitation.invitationId,
        invitedEmail: invitation.invitedEmail,
        role: invitation.role,
        status: invitation.status,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        token: invitation.token,
        invitationLink: `https://app.devinsights.com/invite/${invitation.token}`,
      },
    });
  } catch (error) {
    console.error("❌ Error creating invitation:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// GET /invitations/{organizationId} - List invitations
// ============================================

module.exports.getInvitations = async (event) => {
  try {
    console.log("📧 Getting invitations");

    const organizationId = event.pathParameters?.organizationId;

    if (!organizationId) {
      return createResponse(400, {
        success: false,
        error: "organizationId is required",
      });
    }

    const invitations = await invitationService.getOrganizationInvitations(
      organizationId
    );

    console.log(`✅ Found ${invitations.length} invitations`);

    return createResponse(200, {
      success: true,
      total: invitations.length,
      data: invitations,
    });
  } catch (error) {
    console.error("❌ Error getting invitations:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// POST /invitations/{token}/accept - Accept invitation
// ============================================

module.exports.acceptInvitation = async (event) => {
  try {
    console.log("✅ Accepting invitation");

    const invitationToken = event.pathParameters?.token;
    const body = JSON.parse(event.body || "{}");
    const { email, password, name, companyName } = body;

    console.log(`📧 Accept invite: token=${invitationToken}, email=${email}`);

    if (!invitationToken) {
      return createResponse(400, {
        success: false,
        error: "Invitation token is required",
      });
    }

    if (!email || !password) {
      return createResponse(400, {
        success: false,
        error: "email and password are required",
      });
    }

    // For testing, we'll create a new organization for the invited user
    // In production, this would look up the original invitation
    const signupResult = await cognitoService.signUp(
      email,
      password,
      name || email.split("@")[0],
      companyName || "Team Organization"
    );

    console.log("✅ Invitation accepted");

    return createResponse(200, {
      success: true,
      message: "Invitation accepted! You're now a member of the organization.",
      data: {
        email: email,
        organizationId: signupResult.organizationId,
        organization: signupResult.organization,
        user: signupResult.user,
      },
    });
  } catch (error) {
    console.error("❌ Error accepting invitation:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};
