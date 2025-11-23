// services/cognitoService.js
// WITH LOCAL MOCK FOR TESTING

const AWS = require('aws-sdk');
const crypto = require('crypto');

class CognitoService {
  constructor() {
    // Detect environment
    this.isLocal = !process.env.AWS_EXECUTION_ENV;
    
    if (this.isLocal) {
      console.log('🏠 Running LOCALLY - Using MOCK Cognito');
      this.initMock();
    } else {
      console.log('☁️ Running on AWS - Using REAL Cognito');
      this.cognito = new AWS.CognitoIdentityServiceProvider({
        region: process.env.AWS_REGION || 'ap-south-1'
      });
      this.userPoolId = process.env.USER_POOL_ID;
      this.clientId = process.env.USER_POOL_CLIENT_ID;
    }
    
    console.log('✅ CognitoService initialized');
  }

  // ============================================
  // MOCK INITIALIZATION (Local Testing)
  // ============================================
  
  initMock() {
    const fs = require('fs');
    const path = require('path');
    
    this.mockDir = path.join(__dirname, '..', '.mock-cognito');
    this.usersFile = path.join(this.mockDir, 'users.json');
    this.tokensFile = path.join(this.mockDir, 'tokens.json');
    
    // Create directory if doesn't exist
    if (!fs.existsSync(this.mockDir)) {
      fs.mkdirSync(this.mockDir, { recursive: true });
    }
    
    // Initialize files if they don't exist
    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, JSON.stringify({}));
    }
    if (!fs.existsSync(this.tokensFile)) {
      fs.writeFileSync(this.tokensFile, JSON.stringify({}));
    }
    
    console.log('📁 Mock user storage initialized (file-based)');
  }
  
  // Helper: Load users from file
  loadUsers() {
    const fs = require('fs');
    const data = fs.readFileSync(this.usersFile, 'utf8');
    return JSON.parse(data);
  }
  
  // Helper: Save users to file
  saveUsers(users) {
    const fs = require('fs');
    fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
  }
  
  // Helper: Load tokens from file
  loadTokens() {
    const fs = require('fs');
    const data = fs.readFileSync(this.tokensFile, 'utf8');
    return JSON.parse(data);
  }
  
  // Helper: Save tokens to file
  saveTokens(tokens) {
    const fs = require('fs');
    fs.writeFileSync(this.tokensFile, JSON.stringify(tokens, null, 2));
  }

  // ============================================
  // SIGN UP
  // ============================================
  
  async signUp({ email, password, name, organizationId, role }) {
    if (this.isLocal) {
      return this.mockSignUp({ email, password, name, organizationId, role });
    }

    // Real Cognito sign up (AWS)
    try {
      console.log(`📝 Creating Cognito user: ${email}`);

      const params = {
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name },
          { Name: 'custom:organizationId', Value: organizationId },
          { Name: 'custom:role', Value: role }
        ]
      };

      const result = await this.cognito.signUp(params).promise();

      console.log(`✅ Cognito user created: ${result.UserSub}`);

      return {
        userSub: result.UserSub,
        emailVerified: result.UserConfirmed,
        email: email
      };

    } catch (error) {
      console.error('❌ Cognito signUp error:', error.message);
      
      if (error.code === 'UsernameExistsException') {
        throw new Error('Email already registered');
      } else if (error.code === 'InvalidPasswordException') {
        throw new Error('Password does not meet requirements');
      }
      
      throw error;
    }
  }

  mockSignUp({ email, password, name, organizationId, role }) {
    console.log(`📝 MOCK: Creating user: ${email}`);

    // Load existing users
    const users = this.loadUsers();

    // Check if exists
    if (users[email]) {
      throw new Error('Email already registered');
    }

    // Validate password (basic)
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Create user
    const userId = `mock-user-${Date.now()}`;
    const user = {
      userSub: userId,
      email: email,
      password: this.hashPassword(password), // Simple hash
      name: name,
      organizationId: organizationId,
      role: role,
      emailVerified: false, // Start unverified
      verificationCode: this.generateCode(),
      createdAt: Date.now()
    };

    // Save user
    users[email] = user;
    this.saveUsers(users);

    console.log(`✅ MOCK: User created: ${userId}`);
    console.log(`📧 MOCK: Verification code: ${user.verificationCode}`);

    return {
      userSub: userId,
      emailVerified: false,
      email: email
    };
  }

  // ============================================
  // LOGIN
  // ============================================
  
  async login(email, password) {
    if (this.isLocal) {
      return this.mockLogin(email, password);
    }

    // Real Cognito login (AWS)
    try {
      console.log(`🔐 Authenticating user: ${email}`);

      const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      };

      const result = await this.cognito.initiateAuth(params).promise();

      console.log(`✅ User authenticated: ${email}`);

      return {
        success: true,
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        expiresIn: result.AuthenticationResult.ExpiresIn
      };

    } catch (error) {
      console.error('❌ Cognito login error:', error.message);
      
      if (error.code === 'NotAuthorizedException') {
        return { success: false, error: 'Invalid email or password' };
      } else if (error.code === 'UserNotConfirmedException') {
        return { success: false, error: 'Email not verified' };
      }
      
      return { success: false, error: error.message };
    }
  }

  mockLogin(email, password) {
    console.log(`🔐 MOCK: Authenticating: ${email}`);

    // Load users
    const users = this.loadUsers();
    const user = users[email];

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.password !== this.hashPassword(password)) {
      return { success: false, error: 'Invalid password' };
    }

    if (!user.emailVerified) {
      return { success: false, error: 'Email not verified. Use code: ' + user.verificationCode };
    }

    // Generate mock token
    const token = this.generateMockToken(user);
    
    // Save token
    const tokens = this.loadTokens();
    tokens[token] = user;
    this.saveTokens(tokens);

    console.log(`✅ MOCK: Login successful`);

    return {
      success: true,
      accessToken: token,
      idToken: token, // Same for mock
      refreshToken: `refresh-${token}`,
      expiresIn: 3600
    };
  }

  // ============================================
  // VERIFY EMAIL
  // ============================================
  
  async verifyEmail(email, code) {
    if (this.isLocal) {
      return this.mockVerifyEmail(email, code);
    }

    // Real Cognito verification (AWS)
    try {
      console.log(`✉️ Verifying email: ${email}`);

      const params = {
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code
      };

      await this.cognito.confirmSignUp(params).promise();

      console.log(`✅ Email verified: ${email}`);
      return true;

    } catch (error) {
      console.error('❌ Email verification error:', error.message);
      
      if (error.code === 'CodeMismatchException') {
        throw new Error('Invalid verification code');
      }
      
      throw error;
    }
  }

  mockVerifyEmail(email, code) {
    console.log(`✉️ MOCK: Verifying: ${email}`);

    // Load users
    const users = this.loadUsers();
    const user = users[email];

    if (!user) {
      throw new Error('User not found');
    }

    if (user.verificationCode !== code) {
      throw new Error('Invalid verification code');
    }

    // Update user
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

    // Real token verification (decode JWT)
    return this.decodeToken(token);
  }

  mockVerifyToken(token) {
    // Load tokens
    const tokens = this.loadTokens();
    const user = tokens[token];

    if (!user) {
      throw new Error('Invalid token');
    }

    return {
      sub: user.userSub,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      role: user.role
    };
  }

  // ============================================
  // DECODE TOKEN
  // ============================================
  
  decodeToken(token) {
    if (this.isLocal) {
      return this.mockVerifyToken(token);
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      const decoded = JSON.parse(payload);

      return {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        organizationId: decoded['custom:organizationId'],
        role: decoded['custom:role'],
        exp: decoded.exp,
        iat: decoded.iat
      };

    } catch (error) {
      throw new Error('Invalid token');
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
        Username: email
      };

      await this.cognito.adminGetUser(params).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  // ============================================
  // REFRESH TOKEN (Not needed for local testing)
  // ============================================
  
  async refreshToken(refreshToken) {
    if (this.isLocal) {
      throw new Error('Refresh not implemented in mock');
    }

    try {
      const params = {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      };

      const result = await this.cognito.initiateAuth(params).promise();

      return {
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        expiresIn: result.AuthenticationResult.ExpiresIn
      };

    } catch (error) {
      throw new Error('Failed to refresh token');
    }
  }

  // ============================================
  // HELPERS
  // ============================================
  
  hashPassword(password) {
    // Simple hash for mock (not secure!)
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  generateMockToken(user) {
    return `mock-token-${user.userSub}-${Date.now()}`;
  }
}

module.exports = CognitoService;