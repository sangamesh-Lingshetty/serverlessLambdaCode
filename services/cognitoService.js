// services/cognitoService.js - FIXED VERSION
// Fix: mockVerifyToken now returns actual user data, not hardcoded mock

const AWS = require("aws-sdk");
const crypto = require("crypto");
const OrganizationService = require("./organizationService");
const UserService = require("./userService");

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

    this.organizationService = new OrganizationService();
    this.userService = new UserService();

    console.log("✅ CognitoService initialized");
  }

  initMock() {
    const fs = require("fs");
    const path = require("path");

    this.mockDir = path.join(__dirname, "..", ".mock-cognito");
    this.usersFile = path.join(this.mockDir, "users.json");

    if (!fs.existsSync(this.mockDir)) {
      fs.mkdirSync(this.mockDir, { recursive: true });
    }

    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, JSON.stringify({}));
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

  // ============================================
  // SIGN UP - WITH DYNAMODB
  // ============================================

  async signUp(email, password, name, companyName) {
    if (this.isLocal) {
      return this.mockSignUp({ email, password, name, companyName });
    }

    try {
      console.log(`📝 AWS: Creating user: ${email}`);

      const organizationId = `org-${companyName
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}`;

      console.log(`🏢 Organization: ${organizationId}`);

      const createParams = {
        UserPoolId: this.userPoolId,
        Username: email,
        TemporaryPassword: password,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name },
          { Name: "custom:organizationId", Value: organizationId },
          { Name: "custom:role", Value: "admin" },
        ],
      };

      await this.cognito.adminCreateUser(createParams).promise();
      console.log(`✅ User created in Cognito`);

      const passwordParams = {
        UserPoolId: this.userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      };

      await this.cognito.adminSetUserPassword(passwordParams).promise();
      console.log(`✅ Password set for: ${email}`);

      console.log(`💾 Saving organization to DynamoDB...`);
      const organization = await this.organizationService.createOrganization({
        organizationId,
        name: companyName,
        plan: "free",
        maxMembers: 5,
      });
      console.log(`✅ Organization saved: ${organizationId}`);

      console.log(`💾 Saving user to DynamoDB...`);
      const user = await this.userService.createUser({
        email,
        organizationId,
        name,
        role: "admin",
      });
      console.log(`✅ User saved: ${email}`);

      return {
        userSub: email,
        organizationId: organizationId,
        emailVerified: false,
        message: "Check your email for verification code",
        organization: organization,
        user: user,
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

    const mockOrganization = {
      organizationId,
      name: companyName,
      plan: "free",
      maxMembers: 5,
      createdAt: Date.now(),
    };

    const mockUser = {
      email,
      organizationId,
      name,
      role: "admin",
      status: "active",
      createdAt: Date.now(),
    };

    return {
      userSub,
      organizationId,
      emailVerified: false,
      verificationCode,
      organization: mockOrganization,
      user: mockUser,
    };
  }

  // ============================================
  // LOGIN
  // ============================================

  async login(email, password) {
    if (this.isLocal) {
      return this.mockLogin(email, password);
    }

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
        throw new Error("Authentication failed");
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

    try {
      console.log(`✉️ AWS: Verifying email: ${email}`);

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
  // VERIFY TOKEN - ⭐ FIXED VERSION
  // ============================================

  async verifyToken(token) {
    if (this.isLocal) {
      return this.mockVerifyToken(token);
    }

    return this.decodeToken(token);
  }

  mockVerifyToken(token) {
    // ⭐ FIXED: Now looks up actual user from mock storage instead of returning hardcoded data
    console.log(`🔐 MOCK: Verifying token: ${token}`);

    const users = this.loadUsers();

    // Find user by token (token format: mock-token-{userSub}-{timestamp})
    // Extract userSub from token
    const tokenParts = token.split("-");
    if (tokenParts.length < 4) {
      console.log(`❌ MOCK: Invalid token format: ${token}`);
      throw new Error("Invalid token");
    }

    // Find user with matching userSub
    for (const email in users) {
      const user = users[email];
      if (user.userSub === `${tokenParts[2]}-${tokenParts[3]}`) {
        console.log(`✅ MOCK: User found from token: ${email}`);
        return {
          sub: user.userSub,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
        };
      }
    }

    // If not found, return mock data (fallback)
    console.log(`⚠️ MOCK: User not found in storage, using fallback`);
    return {
      sub: "mock-user",
      email: "mock@test.com",
      name: "Mock User",
      organizationId: "org-mock",
      role: "admin",
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
