// handlers/teams.js - CORRECTED
// Fixed: Use lowercase 'authorization' consistently everywhere
const UserService = require("../services/userService");
const CognitoService = require("../services/cognitoService");

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
// GET /teams/{organizationId}/members - List team
// ============================================

module.exports.getTeamMembers = async (event) => {
  try {
    console.log("👥 Getting team members");
    console.log("📦 Event headers:", JSON.stringify(event.headers, null, 2));

    const organizationId = event.pathParameters?.organizationId;
    // ⭐ FIX: Use lowercase 'authorization'
    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    const token = authHeader?.replace("Bearer ", "");

    console.log(`🔐 organizationId: ${organizationId}`);
    console.log(`🔐 token: ${token}`);

    if (!organizationId || !token) {
      return createResponse(400, {
        success: false,
        error: "organizationId and authorization token required",
      });
    }

    // Verify user
    const user = await cognitoService.verifyToken(token);
    console.log(`✅ User verified:`, user);

    if (!user || user.organizationId !== organizationId) {
      return createResponse(403, {
        success: false,
        error: "You don't have permission to view team members",
      });
    }

    const members = await userService.getUsersByOrganization(organizationId);
    console.log(`👥 Found ${members.length} members`);

    // Remove sensitive data
    const cleanMembers = members.map((m) => ({
      email: m.email,
      name: m.name,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
    }));

    return createResponse(200, {
      success: true,
      data: {
        organizationId,
        members: cleanMembers,
        total: cleanMembers.length,
      },
    });
  } catch (error) {
    console.error("❌ Error getting team members:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// PUT /teams/{organizationId}/members/{email}/role - Change role
// ============================================

module.exports.updateMemberRole = async (event) => {
  try {
    console.log("🔄 Updating member role");

    const organizationId = event.pathParameters?.organizationId;
    const memberEmail = event.pathParameters?.email;
    const body = JSON.parse(event.body || "{}");
    const { role } = body;

    // ⭐ FIX: Use lowercase 'authorization' consistently
    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    const token = authHeader?.replace("Bearer ", "");

    console.log(`🔐 organizationId: ${organizationId}`);
    console.log(`🔐 memberEmail: ${memberEmail}`);
    console.log(`🔐 token: ${token}`);
    console.log(`🔐 role: ${role}`);

    if (!organizationId || !memberEmail || !role || !token) {
      return createResponse(400, {
        success: false,
        error: "Missing required fields",
      });
    }

    // Verify user is admin
    const user = await cognitoService.verifyToken(token);
    console.log(`✅ User verified:`, user);

    if (
      !user ||
      user.organizationId !== organizationId ||
      user.role !== "admin"
    ) {
      return createResponse(403, {
        success: false,
        error: "Only admins can change member roles",
      });
    }

    // Can't change own role
    if (user.email === memberEmail) {
      return createResponse(400, {
        success: false,
        error: "You cannot change your own role",
      });
    }

    // Valid roles
    if (!["admin", "member", "viewer"].includes(role)) {
      return createResponse(400, {
        success: false,
        error: "Invalid role. Must be admin, member, or viewer",
      });
    }

    const updatedUser = await userService.updateUser(
      memberEmail,
      organizationId,
      { role }
    );

    console.log(`✅ Role updated to: ${role}`);

    return createResponse(200, {
      success: true,
      message: `Role updated to ${role}`,
      data: {
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("❌ Error updating member role:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// DELETE /teams/{organizationId}/members/{email} - Remove member
// ============================================

module.exports.removeMember = async (event) => {
  try {
    console.log("❌ Removing team member");

    const organizationId = event.pathParameters?.organizationId;
    const memberEmail = event.pathParameters?.email;

    // ⭐ FIX: Use lowercase 'authorization' consistently
    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    const token = authHeader?.replace("Bearer ", "");

    console.log(`🔐 organizationId: ${organizationId}`);
    console.log(`🔐 memberEmail: ${memberEmail}`);
    console.log(`🔐 token: ${token}`);

    if (!organizationId || !memberEmail || !token) {
      return createResponse(400, {
        success: false,
        error: "Missing required fields",
      });
    }

    // Verify user is admin
    const user = await cognitoService.verifyToken(token);
    console.log(`✅ User verified:`, user);

    if (
      !user ||
      user.organizationId !== organizationId ||
      user.role !== "admin"
    ) {
      return createResponse(403, {
        success: false,
        error: "Only admins can remove members",
      });
    }

    // Can't remove self
    if (user.email === memberEmail) {
      return createResponse(400, {
        success: false,
        error: "You cannot remove yourself from the organization",
      });
    }

    await userService.deleteUser(memberEmail, organizationId);

    console.log(`✅ Member removed: ${memberEmail}`);

    return createResponse(200, {
      success: true,
      message: `Member ${memberEmail} removed from organization`,
    });
  } catch (error) {
    console.error("❌ Error removing member:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};
