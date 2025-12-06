const CognitoService = require("../services/congnitoService");
const cognitoService = new CognitoService();

// helper:create response
const createResponse = (statusCode,body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
  },
  body: JSON.stringify(body),
});

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

    // ✅ NEW: Create organization + user
    const result = await cognitoService.signUp(
      email,
      password,
      name,
      companyName  // ← Pass company name!
    );

    console.log("✅ Organization created and user registered");

    return createResponse(201, {
      success: true,
      message: "Account created! Please check your email to verify.",
      data: {
        userId: result.userSub,
        email: email,
        organizationId: result.organizationId,  // ← Return org ID
        emailVerified: result.emailVerified,
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


module.exports.login = async (event) => {
  try {
    console.log("🔐 Login request received");

    // Parse request body
    const body = JSON.parse(event.body);
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return createResponse(400, {
        success: false,
        error: "Email and password are required",
      });
    }

    const result = await cognitoService.login(email, password);
    if (!result.success) {
      return createResponse(401, {
        success: false,
        error: result.error,
      });
    }

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

        // User info
        user: {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          organizationId: userInfo.organizationId,
          role: userInfo.role,
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
//   verify email
module.exports.verifyEmail = async (event) => {
  try {
    console.log("✉️ Email verification request received");
    // Parse request body
    const body = JSON.parse(event.body);
    const { email, code } = body;

    // Validate input
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

// 4. REFRESH TOKEN (Get new access token)
module.exports.refreshToken = async (event) => {
  try {
    console.log("🔄 Token refresh request received");
    // Parse request body
    const body = JSON.parse(event.body);
    const { refreshToken } = body;

    if (!refreshToken) {
      return createResponse(400, {
        sucess: false,
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

    const userInfo = await cognitoService.verifyToken(token);

    console.log("user info retrieved");

    return createResponse(200, {
      success: true,
      data: {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        organizationId: userInfo.organizationId,
        role: userInfo.role,
      },
    });
  } catch (error) {
    console.error("❌ Get user error:", error.message);

    return createResponse(500, {
      sucess: false,
      error: error.message,
    });
  }
};
