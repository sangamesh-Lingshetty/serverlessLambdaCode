# Single User Journey - DevInsights AI

## 🎯 Who This Is For
Individual developers who want to analyze their own GitHub activity.

---

## 📖 The Complete Story

### Chapter 1: Discovery (Day 1, 9:00 AM)

**Alice is a developer at a small startup.**
```
Alice's Problem:
- Works late nights frequently
- Feels burned out but can't prove it
- Wants data-driven insights about her work patterns
- Needs to show her manager she needs help

Alice discovers DevInsights AI through GitHub
```

---

### Chapter 2: Sign Up (9:05 AM)

**Alice visits:** `https://devinsights.com`

**Step 1: Create Account**
```bash
POST /auth/signup

Request:
{
  "email": "alice@startup.com",
  "password": "SecurePass123",
  "name": "Alice Developer",
  "githubUsername": "alice-dev"
}

Response:
{
  "success": true,
  "message": "Account created! Check email to verify.",
  "userId": "user-123"
}
```

**What Happens Behind the Scenes:**
```
1. API Gateway receives request
   ↓
2. Lambda: signUp handler
   ├─ Validate email format
   ├─ Check if email already exists
   └─ Hash password securely
   ↓
3. AWS Cognito
   ├─ Create user account
   ├─ Store encrypted password
   └─ Send verification email
   ↓
4. DynamoDB
   ├─ Store user profile
   ├─ Create organization: "alice@startup.com"
   └─ Set role: "admin" (first user = admin)
   ↓
5. Email Sent ✅
   Subject: "Verify your DevInsights account"
   Body: "Click here: https://devinsights.com/verify?code=ABC123"
```

---

### Chapter 3: Email Verification (9:06 AM)

**Alice checks her email:**
```
📧 Email from DevInsights:

"Welcome to DevInsights! 

Click to verify: [Verify Account]

Or enter this code: ABC123"
```

**Alice clicks the verification link**
```bash
GET /auth/verify?code=ABC123

What Happens:
1. API Gateway → Lambda
2. Cognito validates code
3. Sets emailVerified = true
4. User can now login ✅
```

---

### Chapter 4: First Login (9:07 AM)

**Alice logs in:**
```bash
POST /auth/login

Request:
{
  "email": "alice@startup.com",
  "password": "SecurePass123"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "user-123",
      "email": "alice@startup.com",
      "name": "Alice Developer",
      "organizationId": "org-alice-123",
      "role": "admin"
    }
  }
}
```

**What the Token Contains:**
```javascript
// JWT Token decoded:
{
  "sub": "user-123",                    // User ID
  "email": "alice@startup.com",
  "organizationId": "org-alice-123",    // Her organization
  "role": "admin",
  "iat": 1705959600,                    // Issued at
  "exp": 1705963200                     // Expires in 1 hour
}

// This token is the KEY to everything!
// Every request includes: Authorization: Bearer <token>
```

---

### Chapter 5: Connect GitHub (9:08 AM)

**Alice wants to analyze her GitHub:**
```bash
# Alice stores her GitHub username in profile
PUT /profile/github

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Request Body:
{
  "githubUsername": "alice-dev"
}

Response:
{
  "success": true,
  "message": "GitHub username saved",
  "profileComplete": true
}
```

---

### Chapter 6: First Analysis - Code Quality (9:10 AM)

**Alice requests her code quality analysis:**
```bash
GET /ai/code-quality/alice-dev

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**What Happens (DETAILED):**
```
Step 1: Request arrives at API Gateway
  ↓
Step 2: Lambda function starts
  • Cold start: 50ms (first time)
  • Warm start: 5ms (subsequent)
  ↓
Step 3: Token Validation
  • Extract token from Authorization header
  • Verify signature with Cognito
  • Check expiration (valid?)
  • Extract claims: userId, organizationId
  ✅ Token valid!
  ↓
Step 4: Authorization Check
  • Can user "user-123" access data for "alice-dev"?
  • Check if alice-dev belongs to org-alice-123
  ✅ Authorized!
  ↓
Step 5: Check Cache (DynamoDB)
  Query:
  {
    PK: "ORG#org-alice-123",
    SK: "GITHUB_DATA#alice-dev"
  }
  
  Result: Cache MISS (first time)
  ↓
Step 6: Fetch Real GitHub Data
  
  6.1: Get User Repositories
    GET https://api.github.com/users/alice-dev/repos
    
    Response:
    [
      {
        "name": "project-1",
        "language": "JavaScript",
        "size": 2048,
        "stargazers_count": 15
      },
      {
        "name": "project-2",
        "language": "Python",
        "size": 1024,
        "stargazers_count": 8
      },
      // ... 8 more repos
    ]
    
    Total: 10 repositories found
  
  6.2: For Each Repository, Get Commits
    Parallel requests (faster!):
    
    GET /repos/alice-dev/project-1/commits
    GET /repos/alice-dev/project-2/commits
    ...
    GET /repos/alice-dev/project-10/commits
    
    Aggregate Results:
    • Total commits: 2,456
    • Date range: Jan 2024 - Jan 2025
    • Languages: JavaScript, Python, TypeScript
  
  6.3: Get Pull Requests
    GET /repos/alice-dev/project-1/pulls
    
    Aggregate:
    • Total PRs: 156
    • Average merge time: 3.2 days
    • PR review cycles: 2.1 average
  
  6.4: Get Issues
    GET /repos/alice-dev/project-1/issues
    
    Aggregate:
    • Total issues: 89
    • Closed: 76
    • Average resolution time: 4.5 days
  
  Total Data Collected:
  ├─ 10 repositories
  ├─ 2,456 commits
  ├─ 156 pull requests
  └─ 89 issues
  
  Time: ~200ms (parallel requests)
  ↓
Step 7: Analyze with AI (OpenRouter + Mistral)
  
  Prepare Prompt:
```
  Analyze this developer's code quality:
  
  Repositories: 10
  Total commits: 2,456
  Languages: JavaScript (60%), Python (30%), TypeScript (10%)
  
  Commit patterns:
  - Average commit size: 15 files
  - Large commits (>50 files): 12%
  - Small commits (<5 files): 60%
  
  Pull request metrics:
  - Average merge time: 3.2 days
  - Review cycles: 2.1 average
  
  Issue resolution:
  - Average resolution: 4.5 days
  - Open issues: 13
  
  Analyze code quality (0-10 score) and provide:







{
    "choices": [{
      "message": {
        "content": {
          "overallScore": 7.8,
          "analysis": "Good code quality with room for improvement",
          "issues": [
            "12% of commits are very large (>50 files) - suggests insufficient decomposition",
            "Average PR merge time of 3.2 days indicates potential review bottlenecks",
            "Code predominantly JavaScript - limited type safety"
          ],
          "recommendations": [
            "Break down large commits into smaller, focused changes",
            "Add TypeScript for better type safety in JavaScript projects",
            "Establish PR review SLA to reduce merge time",
            "Consider adding automated code quality checks (linting, testing)"
          ],
          "strengths": [
            "High commit frequency (6-7 per day) shows active development",
            "60% of commits are small and focused",
            "Good issue resolution rate (85%)"
          ]
        }
      }
    }]
  }
```
  
  Time: ~500ms
  ↓
Step 8: Save to Cache (DynamoDB)
  
  Write:
  {
    PK: "ORG#org-alice-123",
    SK: "GITHUB_DATA#alice-dev",
    data: {
      codeQuality: {
        overallScore: 7.8,
        issues: [...],
        recommendations: [...]
      },
      metrics: {
        totalCommits: 2456,
        totalRepos: 10,
        languages: {...}
      }
    },
    cachedAt: 1705959600000,
    ttl: 1706046000000  // Expires in 24 hours
  }
  
  Time: ~20ms
  ↓
Step 9: Return Response to Alice
  
  HTTP 200 OK
  {
    "success": true,
    "data": {
      "codeQuality": {
        "overallScore": 7.8,
        "analysis": "Good code quality...",
        "issues": [...],
        "recommendations": [...]
      },
      "metrics": {
        "totalCommits": 2456,
        "totalRepositories": 10,
        "averageCommitSize": 15
      },
      "dataSource": "REAL GitHub API",
      "generatedAt": "2025-01-24T09:10:30Z",
      "cached": false
    }
  }
  
  Total Time: ~850ms ✅
```

**Alice sees her dashboard:**
```
╔══════════════════════════════════════════════════════╗
║           ALICE'S CODE QUALITY REPORT                ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Overall Score: 7.8/10                              ║
║  Rating: Good with room for improvement             ║
║                                                      ║
║  📊 Your Metrics:                                   ║
║  • Total Commits: 2,456                             ║
║  • Repositories: 10                                 ║
║  • Primary Language: JavaScript (60%)               ║
║  • Average Commit Size: 15 files                    ║
║                                                      ║
║  ⚠️  Issues Detected:                               ║
║  1. 12% of commits are very large (>50 files)      ║
║  2. Average PR merge time: 3.2 days                ║
║  3. Limited type safety (mostly JavaScript)        ║
║                                                      ║
║  💡 Recommendations:                                ║
║  • Break down large commits                         ║
║  • Add TypeScript for type safety                   ║
║  • Establish PR review SLA                          ║
║  • Add automated quality checks                     ║
║                                                      ║
║  ✅ Strengths:                                      ║
║  • High commit frequency (6-7/day)                  ║
║  • 60% commits are focused                          ║
║  • Good issue resolution (85%)                      ║
║                                                      ║
╚══════════════════════════════════════════════════════╝

[View Detailed Report] [Export PDF] [Share with Manager]
```

---

### Chapter 7: Burnout Analysis (9:15 AM)

**Alice is concerned about burnout:**
```bash
GET /ai/burnout-risk/alice@startup.com

Authorization: Bearer <token>
```

**What Happens:**
```
Step 1-5: Same as before (auth, validation)
  ↓
Step 6: Analyze Commit Timestamps
  
  From 2,456 commits, analyze timing:
  
  Late Night Commits (10 PM - 6 AM):
  ├─ Total: 1,102 commits (45%)
  ├─ Frequency: Almost daily
  └─ Pattern: Increasing over last 3 months
  
  Weekend Commits:
  ├─ Saturday: 312 commits
  ├─ Sunday: 289 commits
  └─ Total weekend: 601 (25% of all commits)
  
  No-Break Periods:
  ├─ Longest streak: 14 consecutive days
  ├─ Average work hours: 11 hours/day
  └─ Days with 0 commits: Only 12 in last year
  
  Commit Intensity:
  ├─ Average commits/day: 6.7
  ├─ Max commits/day: 23
  └─ Trend: Increasing 15% month-over-month
  ↓
Step 7: AI Burnout Analysis
  
  Prompt to Mistral AI:
```
  Analyze burnout risk for this developer:
  
  Work Patterns:
  - Late commits (10 PM - 6 AM): 45%
  - Weekend work: 25%
  - Consecutive work days: 14 max
  - Average work hours: 11 hours/day
  - Days off in last year: 12
  
  Commit intensity:
  - Daily average: 6.7 commits
  - Trend: +15% month-over-month
  
  Provide:
  1. Burnout risk score (0-10)
  2. Risk level
  3. Detected patterns
  4. Recommendations
```
  
  AI Response:
  {
    "burnoutRisk": {
      "riskScore": 8.2,
      "riskLevel": "HIGH",
      "confidence": 87%,
      "patterns": {
        "lateNightWork": "45% of commits after 10 PM - CRITICAL",
        "weekendWork": "25% on weekends - HIGH",
        "noBreaks": "Only 12 days off in 365 - CRITICAL",
        "workloadTrend": "Increasing 15% monthly - CONCERNING"
      },
      "psychologicalIndicators": [
        "Consistent late-night work suggests poor work-life balance",
        "Lack of breaks increases risk of burnout by 300%",
        "Increasing workload without compensation raises stress"
      ],
      "recommendations": [
        "URGENT: Schedule at least 2 consecutive days off",
        "Set hard stop time: No work after 8 PM",
        "Block weekends for personal time",
        "Discuss workload with manager immediately",
        "Consider taking a vacation week"
      ]
    }
  }
```

**Alice sees alarming results:**
```
╔══════════════════════════════════════════════════════╗
║         🚨 BURNOUT RISK ANALYSIS 🚨                  ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Risk Score: 8.2/10                                 ║
║  Risk Level: ⚠️  HIGH ⚠️                            ║
║  Confidence: 87%                                    ║
║                                                      ║
║  🔥 Critical Issues:                                ║
║                                                      ║
║  Late Night Work: 45% of commits after 10 PM       ║
║  └─ Pattern: Almost every night                     ║
║                                                      ║
║  Weekend Work: 25% of commits on weekends          ║
║  └─ Pattern: Both Saturday & Sunday                 ║
║                                                      ║
║  No Breaks: Only 12 days off in last year          ║
║  └─ Pattern: Working 353 days out of 365            ║
║                                                      ║
║  Workload Trend: +15% increase monthly             ║
║  └─ Pattern: Unsustainable trajectory               ║
║                                                      ║
║  💡 URGENT Recommendations:                         ║
║                                                      ║
║  1. Schedule 2 consecutive days off THIS WEEK      ║
║  2. Set hard stop: No work after 8 PM              ║
║  3. Block ALL weekends for personal time           ║
║  4. Talk to manager about workload ASAP            ║
║  5. Plan a vacation week within next month         ║
║                                                      ║
║  📊 Health Impact Prediction:                       ║
║  • Continued pattern: 85% chance serious burnout    ║
║  • Recommended changes: 60% risk reduction          ║
║                                                      ║
╚══════════════════════════════════════════════════════╝

[📄 Export Report] [📧 Email to Manager] [💬 Schedule 1:1]
```

---

### Chapter 8: Taking Action (9:20 AM)

**Alice exports the burnout report:**
```bash
POST /ai/generate-report/org-alice-123

Request:
{
  "reportType": "burnout_analysis",
  "includeGraphs": true,
  "confidential": false
}

Response:
{
  "success": true,
  "reportUrl": "https://s3.amazonaws.com/devinsights/reports/alice-burnout-jan2025.pdf",
  "generatedAt": "2025-01-24T09:20:00Z"
}
```

**Alice emails report to her manager:**
```
To: manager@startup.com
Subject: Work-Life Balance Discussion

Hi [Manager],

I've been analyzing my work patterns and wanted to share 
some concerning data with you.

Attached is a report showing:
- 45% of my commits happen after 10 PM
- I've worked 25% of weekends this year
- Only 12 days off in the last year

I'd like to discuss adjusting my workload and establishing
better boundaries. Can we schedule a 1:1?

[Burnout Analysis Report PDF]

Thanks,
Alice
```

---

### Chapter 9: Second Request - Cached! (9:25 AM)

**Alice refreshes her dashboard:**
```bash
GET /ai/code-quality/alice-dev

Authorization: Bearer <token>
```

**What Happens This Time:**
```
Step 1-5: Auth validation (same as before)
  ↓
Step 6: Check Cache (DynamoDB)
  
  Query:
  {
    PK: "ORG#org-alice-123",
    SK: "GITHUB_DATA#alice-dev"
  }
  
  Result: Cache HIT! ✅
  
  Retrieved data:
  {
    codeQuality: { ... },
    metrics: { ... },
    cachedAt: 1705959600000,  // 5 minutes ago
    ttl: 1706046000000         // Valid for 23 more hours
  }
  ↓
Step 7: Skip GitHub + AI (use cached data)
  ↓
Step 8: Return cached response
  
  HTTP 200 OK
  {
    "success": true,
    "data": { ... },
    "cached": true,
    "cacheAge": "5 minutes",
    "expiresIn": "23 hours"
  }
  
  Total Time: ~50ms (17x faster!) ⚡
```

---

### Chapter 10: Understanding the Magic (Behind the Scenes)

**How Your Data is Stored:**
```javascript
// In DynamoDB:

Item 1: Your Profile
{
  PK: "USER#user-123",
  SK: "PROFILE",
  email: "alice@startup.com",
  name: "Alice Developer",
  organizationId: "org-alice-123",
  role: "admin",
  githubUsername: "alice-dev",
  createdAt: 1705959000000
}

Item 2: Your Organization
{
  PK: "ORG#org-alice-123",
  SK: "ORG#org-alice-123",
  name: "Alice's Organization",
  ownerId: "user-123",
  plan: "free",
  memberCount: 1,
  createdAt: 1705959000000
}

Item 3: Your GitHub Data Cache
{
  PK: "ORG#org-alice-123",
  SK: "GITHUB_DATA#alice-dev",
  data: {
    codeQuality: {
      overallScore: 7.8,
      issues: [...],
      recommendations: [...]
    },
    burnoutRisk: {
      riskScore: 8.2,
      patterns: {...}
    },
    metrics: {
      totalCommits: 2456,
      totalRepos: 10
    }
  },
  cachedAt: 1705959600000,
  ttl: 1706046000000  // Auto-deletes after 24 hours
}

// Why this structure?
// - Your data is ISOLATED (only you can see it)
// - Queries are FAST (direct key lookup)
// - Cache EXPIRES automatically (always fresh)
// - SCALES infinitely (add millions of users)
```

---

## 🎯 Summary: Alice's Complete Journey
```
9:00 AM  → Discovers DevInsights
9:05 AM  → Creates account
9:06 AM  → Verifies email
9:07 AM  → Logs in (gets JWT token)
9:08 AM  → Connects GitHub username
9:10 AM  → First code quality analysis
          └─ Real GitHub data fetched
          └─ AI analyzes patterns
          └─ Results cached for 24h
9:15 AM  → Burnout analysis
          └─ Discovers concerning patterns
          └─ Gets actionable recommendations
9:20 AM  → Exports report
          └─ Shares with manager
9:25 AM  → Refreshes dashboard
          └─ Cached results (50ms response!)

Result: Alice has data-driven proof of her burnout risk 
        and can advocate for better work-life balance.
```

---

## 📊 What Made This Possible?
```
✅ Real GitHub Integration
   • No fake data
   • Authentic insights
   • Immediate value

✅ AI-Powered Analysis
   • Mistral AI via OpenRouter
   • Free tier (5M tokens/month)
   • Accurate insights (85%+)

✅ Smart Caching
   • 24-hour cache
   • Sub-second responses
   • Cost-efficient

✅ Serverless Architecture
   • Zero infrastructure management
   • Scales automatically
   • $0 monthly cost

✅ Secure & Private
   • JWT authentication
   • Data isolation
   • No cross-user access
```

---

**Next: See how this works with TEAMS in the Multi-Tenant guide!**
  1. Overall quality score
  2. Detected issues
  3. Recommendations
