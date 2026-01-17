// handlers/auth.js - UPDATED
const CognitoService = require("../services/cognitoService");
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
// SIGN UP - ⭐ NOW RETURNS organizationId!
// ============================================

module.exports.signUp = async (event) => {
  try {
    console.log("📝 Sign-Up request received");

    const body = JSON.parse(event.body);
    const { email, password, name, companyName } = body;

    // Validate input
    if (!email || !password || !name || !companyName) {
      return createResponse(400, {
        success: false,
        error: "Email, password, name, and companyName are required",
      });
    }

    // Check if user already exists
    const userExists = await cognitoService.userExists(email);
    if (userExists) {
      return createResponse(409, {
        success: false,
        error: "Email already registered",
      });
    }

    // ⭐ Calls updated cognitoService.signUp() which now:
    //    1. Creates Cognito user
    //    2. Creates organization in DynamoDB
    //    3. Creates user record in DynamoDB
    //    4. Returns all data
    const result = await cognitoService.signUp(
      email,
      password,
      name,
      companyName
    );

    console.log("✅ Organization created and user registered");

    return createResponse(201, {
      success: true,
      message: "Account created! Please check your email to verify.",
      data: {
        userId: result.userSub,
        email: email,
        organizationId: result.organizationId, // ⭐ NEW!
        emailVerified: result.emailVerified,
        organization: result.organization, // ⭐ NEW!
        user: result.user, // ⭐ NEW!
      },
    });
  } catch (error) {
    console.error("❌ Sign-Up error:", error.message);

    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// LOGIN - ⭐ NOW RETURNS organizationId!
// ============================================

module.exports.login = async (event) => {
  try {
    console.log("🔐 Login request received");

    const body = JSON.parse(event?.body);
    // const { email, password } = body;

    // Validate input
    if (!body?.email || !body?.password) {
      return createResponse(400, {
        success: false,
        error: "Email and password are required",
      });
    }

    const result = await cognitoService.login(body?.email, body?.password);
    if (!result.success) {
      return createResponse(401, {
        success: false,
        error: result.error,
      });
    }

    // ⭐ DECODE TOKEN to get organizationId + role
    const userInfo = cognitoService.decodeToken(result.idToken);

    console.log("✅ Login successful");

    return createResponse(200, {
      success: true,
      message: "Login successful",
      data: {
        // Tokens for frontend to store
        accessToken: result.accessToken,
        idToken: result.idToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,

        // User info - ⭐ NOW INCLUDES organizationId!
        user: {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          organizationId: userInfo.organizationId, // ⭐ NEW!
          role: userInfo.role, // ⭐ NEW!
        },
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error.message);

    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// VERIFY EMAIL
// ============================================

module.exports.verifyEmail = async (event) => {
  try {
    console.log("✉️ Email verification request received");

    const body = JSON.parse(event.body);
    const { email, code } = body;

    if (!email || !code) {
      return createResponse(400, {
        success: false,
        error: "Email and verification code are required",
      });
    }

    await cognitoService.verifyEmail(email, code);

    console.log("✅ Email verified");
    return createResponse(200, {
      success: true,
      message: "Email verified successfully! You can now login.",
    });
  } catch (error) {
    console.error("❌ Verification error:", error.message);

    return createResponse(400, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// REFRESH TOKEN
// ============================================

module.exports.refreshToken = async (event) => {
  try {
    console.log("🔄 Token refresh request received");

    const body = JSON.parse(event.body);
    const { refreshToken } = body;

    if (!refreshToken) {
      return createResponse(400, {
        success: false,
        error: "Refresh token is required",
      });
    }

    const result = await cognitoService.refreshToken(refreshToken);
    console.log("✅ Token refreshed");

    return createResponse(200, {
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: result.accessToken,
        idToken: result.idToken,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error) {
    console.error("❌ Token refresh error:", error.message);

    return createResponse(401, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// GET CURRENT USER - ⭐ WITH ORGANIZATION!
// ============================================

module.exports.getCurrentUser = async (event) => {
  try {
    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createResponse(401, {
        success: false,
        error: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    // ⭐ VERIFY TOKEN - returns organizationId + role
    const userInfo = await cognitoService.verifyToken(token);

    console.log("✅ User info retrieved");

    return createResponse(200, {
      success: true,
      data: {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        organizationId: userInfo.organizationId, // ⭐ NOW INCLUDED!
        role: userInfo.role, // ⭐ NOW INCLUDED!
      },
    });
  } catch (error) {
    console.error("❌ Get user error:", error.message);

    return createResponse(401, {
      success: false,
      error: error.message,
    });
  }
};
