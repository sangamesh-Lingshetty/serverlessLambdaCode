// services/cognitoService.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

class CognitoService {
  constructor() {
    this.isLocal = !process.env.AWS_EXECUTION_ENV;

    if (this.isLocal) {
      console.log("🏠 Running LOCALLY - Using MOCK Cognito");
      this.initMock();
    } else {
      console.log("☁️ Running on AWS - Using REAL Cognito");
      this.cognito = new AWS.CognitoIdentityServiceProvider({
        region: process.env.AWS_REGION || "ap-south-1",
      });
      this.userPoolId = process.env.USER_POOL_ID;
      this.clientId = process.env.USER_POOL_CLIENT_ID;
    }

    console.log("✅ CognitoService initialized");
  }

  // ============================================
  // MOCK INITIALIZATION (Local Testing)
  // ============================================

  initMock() {
    const fs = require("fs");
    const path = require("path");

    this.mockDir = path.join(__dirname, "..", ".mock-cognito");
    this.usersFile = path.join(this.mockDir, "users.json");
    this.tokensFile = path.join(this.mockDir, "tokens.json");

    if (!fs.existsSync(this.mockDir)) {
      fs.mkdirSync(this.mockDir, { recursive: true });
    }

    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, JSON.stringify({}));
    }
    if (!fs.existsSync(this.tokensFile)) {
      fs.writeFileSync(this.tokensFile, JSON.stringify({}));
    }

    console.log("📁 Mock user storage initialized");
  }

  loadUsers() {
    const fs = require("fs");
    const data = fs.readFileSync(this.usersFile, "utf8");
    return JSON.parse(data);
  }

  saveUsers(users) {
    const fs = require("fs");
    fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
  }

  loadTokens() {
    const fs = require("fs");
    const data = fs.readFileSync(this.tokensFile, "utf8");
    return JSON.parse(data);
  }

  saveTokens(tokens) {
    const fs = require("fs");
    fs.writeFileSync(this.tokensFile, JSON.stringify(tokens, null, 2));
  }

  // ============================================
  // SIGN UP
  // ============================================

  async signUp(email, password, name, companyName) {
    if (this.isLocal) {
      return this.mockSignUp({ email, password, name, companyName });
    }

    // Real AWS Cognito
    try {
      console.log(`📝 AWS: Creating user: ${email}`);

      const organizationId = `org-${companyName
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}`;

      console.log(`🏢 Organization: ${organizationId}`);

      // Step 1: Create user (WITHOUT auto-verifying email)
      const createParams = {
        UserPoolId: this.userPoolId,
        Username: email,
        TemporaryPassword: password, // ← Use temporary password first
        MessageAction: "SUPPRESS", // ← Don't send welcome email yet
        UserAttributes: [
          { Name: "email", Value: email },
          // ❌ REMOVE: { Name: "email_verified", Value: "true" }
          // This was preventing email verification!
          { Name: "name", Value: name },
          { Name: "custom:organizationId", Value: organizationId },
          { Name: "custom:role", Value: "admin" },
        ],
      };

      await this.cognito.adminCreateUser(createParams).promise();
      console.log(`✅ User created in Cognito`);

      // Step 2: Set permanent password
      const passwordParams = {
        UserPoolId: this.userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      };

      await this.cognito.adminSetUserPassword(passwordParams).promise();
      console.log(`✅ Password set for: ${email}`);

      // Step 3: Send verification email
      console.log(`📧 Verification email will be sent to: ${email}`);

      return {
        userSub: email,
        organizationId: organizationId,
        emailVerified: false, // ← Important: not verified yet!
        message: "Check your email for verification code",
      };
    } catch (error) {
      console.error("❌ AWS Sign-up error:", error.message);
      throw new Error(error.message);
    }
  }

  mockSignUp({ email, password, name, companyName }) {
    console.log(`📝 MOCK: Creating user: ${email}`);

    const users = this.loadUsers();

    if (users[email]) {
      throw new Error("Email already registered");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const organizationId = `org-${companyName
      .toLowerCase()
      .replace(/\s+/g, "-")}-${Date.now()}`;

    console.log(`🏢 Created organization: ${organizationId}`);

    const userSub = `cognito-${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}`;

    const verificationCode = this.generateCode();

    const user = {
      userSub,
      email,
      password: this.hashPassword(password),
      name,
      organizationId,
      role: "admin",
      emailVerified: false,
      verificationCode,
      createdAt: Date.now(),
    };

    users[email] = user;
    this.saveUsers(users);

    console.log(`✅ MOCK: User created: ${userSub}`);
    console.log(`📧 MOCK: Verification code: ${verificationCode}`);
    console.log(`📧 MOCK: In real app, email would be sent to: ${email}`);

    return {
      userSub,
      organizationId,
      emailVerified: false,
      verificationCode, // ← Return for testing
    };
  }

  // ============================================
  // LOGIN
  // ============================================

  async login(email, password) {
    if (this.isLocal) {
      return this.mockLogin(email, password);
    }

    // Real AWS Cognito
    try {
      console.log(`🔑 AWS: Authenticating: ${email}`);

      const params = {
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      };

      const result = await this.cognito.adminInitiateAuth(params).promise();

      if (!result.AuthenticationResult) {
        throw new Error("Authentication failed - no tokens returned");
      }

      console.log(`✅ AWS: Login successful: ${email}`);

      return {
        success: true,
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        expiresIn: result.AuthenticationResult.ExpiresIn,
      };
    } catch (error) {
      console.error("❌ AWS Login error:", error.message);

      // User not confirmed error
      if (error.code === "UserNotConfirmedException") {
        throw new Error(
          "Email not verified. Check your inbox for verification code."
        );
      }

      throw new Error(error.message);
    }
  }

  mockLogin(email, password) {
    console.log(`🔐 MOCK: Authenticating: ${email}`);

    const users = this.loadUsers();
    const user = users[email];

    if (!user) {
      console.log(`❌ MOCK: User not found: ${email}`);
      throw new Error("User not found");
    }

    if (user.password !== this.hashPassword(password)) {
      console.log(`❌ MOCK: Invalid password for: ${email}`);
      throw new Error("Invalid password");
    }

    if (!user.emailVerified) {
      console.log(`❌ MOCK: Email not verified for: ${email}`);
      throw new Error(
        `Email not verified. Verification code: ${user.verificationCode}`
      );
    }

    const token = this.generateMockToken(user);

    const tokens = this.loadTokens();
    tokens[token] = user;
    this.saveTokens(tokens);

    console.log(`✅ MOCK: Login successful`);
    console.log(`🏢 Organization: ${user.organizationId}`);

    return {
      success: true,
      accessToken: token,
      idToken: token,
      refreshToken: `refresh-${token}`,
      expiresIn: 3600,
      user: {
        id: user.userSub,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        role: user.role,
      },
    };
  }

  // ============================================
  // VERIFY EMAIL
  // ============================================

  async verifyEmail(email, code) {
    if (this.isLocal) {
      return this.mockVerifyEmail(email, code);
    }

    // Real AWS Cognito - Confirm signup with code
    try {
      console.log(`✉️ AWS: Verifying email: ${email} with code: ${code}`);

      const params = {
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
      };

      await this.cognito.confirmSignUp(params).promise();

      console.log(`✅ AWS: Email verified: ${email}`);
      return true;
    } catch (error) {
      console.error("❌ AWS Verification error:", error.message);

      if (error.code === "CodeMismatchException") {
        throw new Error("Invalid verification code");
      }
      if (error.code === "NotAuthorizedException") {
        throw new Error("User is already confirmed");
      }

      throw new Error(error.message);
    }
  }

  mockVerifyEmail(email, code) {
    console.log(`✉️ MOCK: Verifying: ${email}`);

    const users = this.loadUsers();
    const user = users[email];

    if (!user) {
      throw new Error("User not found");
    }

    if (user.verificationCode !== code) {
      throw new Error("Invalid verification code");
    }

    user.emailVerified = true;
    delete user.verificationCode;

    users[email] = user;
    this.saveUsers(users);

    console.log(`✅ MOCK: Email verified`);
    return true;
  }

  // ============================================
  // VERIFY TOKEN
  // ============================================

  async verifyToken(token) {
    if (this.isLocal) {
      return this.mockVerifyToken(token);
    }

    return this.decodeToken(token);
  }

  mockVerifyToken(token) {
    const tokens = this.loadTokens();
    const user = tokens[token];

    if (!user) {
      throw new Error("Invalid token");
    }

    return {
      sub: user.userSub,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      role: user.role,
    };
  }

  // ============================================
  // DECODE TOKEN (For AWS JWT)
  // ============================================

  decodeToken(token) {
    if (this.isLocal) {
      return this.mockVerifyToken(token);
    }

    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid token format");
      }

      const payload = Buffer.from(parts[1], "base64").toString("utf8");
      const decoded = JSON.parse(payload);

      return {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        organizationId: decoded["custom:organizationId"],
        role: decoded["custom:role"],
      };
    } catch (error) {
      throw new Error("Invalid token");
    }
  }

  // ============================================
  // USER EXISTS
  // ============================================

  async userExists(email) {
    if (this.isLocal) {
      const users = this.loadUsers();
      return !!users[email];
    }

    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: email,
      };

      await this.cognito.adminGetUser(params).promise();
      return true;
    } catch (error) {
      if (error.code === "UserNotFoundException") {
        return false;
      }
      throw error;
    }
  }

  // ============================================
  // REFRESH TOKEN
  // ============================================

  async refreshToken(refreshToken) {
    if (this.isLocal) {
      throw new Error("Refresh not implemented in mock");
    }

    try {
      const params = {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      };

      const result = await this.cognito.initiateAuth(params).promise();

      return {
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        expiresIn: result.AuthenticationResult.ExpiresIn,
      };
    } catch (error) {
      throw new Error("Failed to refresh token");
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  generateMockToken(user) {
    return `mock-token-${user.userSub}-${Date.now()}`;
  }
}

module.exports = CognitoService;
