# API Documentation - DevInsights AI

Complete reference for all 23 API endpoints with request/response examples, authentication, and error handling.

---

## 📋 **Table of Contents**

1. [Base URL & Authentication](#base-url--authentication)
2. [Response Format](#response-format)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Authentication Endpoints](#authentication-endpoints)
6. [AI Analytics Endpoints](#ai-analytics-endpoints)
7. [Team Management Endpoints](#team-management-endpoints)
8. [Organization Endpoints](#organization-endpoints)
9. [User Profile Endpoints](#user-profile-endpoints)

---

## 🌐 **Base URL & Authentication**

### **Base URL**
```
Production: https://your-api-id.execute-api.ap-south-1.amazonaws.com
Development: http://localhost:3000 (local testing)
```

### **Authentication**

All endpoints (except `/auth/signup` and `/auth/login`) require JWT authentication.

**Header Format:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**How to get token:**
1. Sign up: `POST /auth/signup`
2. Verify email: `POST /auth/verify`
3. Login: `POST /auth/login` → Receive `accessToken`
4. Use token in all subsequent requests

---

## 📦 **Response Format**

### **Success Response**
```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Optional success message",
  "timestamp": "2025-01-24T10:30:00Z"
}
```

### **Error Response**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error context (optional)"
  },
  "timestamp": "2025-01-24T10:30:00Z"
}
```

---

## ❌ **Error Handling**

### **HTTP Status Codes**

| Status Code | Meaning | Description |
|-------------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### **Common Error Codes**
```json
{
  "INVALID_TOKEN": "JWT token is invalid or expired",
  "UNAUTHORIZED": "Authentication required",
  "FORBIDDEN": "Insufficient permissions",
  "NOT_FOUND": "Resource not found",
  "VALIDATION_ERROR": "Request validation failed",
  "RATE_LIMIT_EXCEEDED": "Too many requests",
  "ORG_NOT_FOUND": "Organization not found",
  "USER_NOT_FOUND": "User not found",
  "GITHUB_API_ERROR": "GitHub API error",
  "AI_SERVICE_ERROR": "AI service error"
}
```

### **Error Response Examples**

**401 Unauthorized:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "JWT token is expired"
  }
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource"
  }
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with GitHub username 'invalid-user' not found in your organization"
  }
}
```

---

## ⏱️ **Rate Limiting**

### **Limits**

| Endpoint Type | Rate Limit |
|--------------|------------|
| Authentication | 10 requests/minute |
| AI Analytics | 100 requests/hour |
| Team Management | 50 requests/hour |
| All Others | 1000 requests/hour |

### **Rate Limit Headers**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706091600
```

### **Rate Limit Exceeded Response**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 3600 seconds",
    "retryAfter": 3600
  }
}
```

---

## 🔐 **Authentication Endpoints**

### **1. Sign Up**

Create a new user account and organization.

**Endpoint:** `POST /auth/signup`

**Authentication:** None required

**Request Body:**
```json
{
  "email": "alice@startup.com",
  "password": "SecurePassword123",
  "name": "Alice Developer",
  "organizationName": "My Startup",
  "githubUsername": "alice-dev"
}
```

**Request Parameters:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| email | string | Yes | Valid email format |
| password | string | Yes | Min 8 chars, 1 uppercase, 1 number |
| name | string | Yes | 2-50 characters |
| organizationName | string | Yes | 2-100 characters |
| githubUsername | string | No | Valid GitHub username |

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "userId": "user-abc-123",
    "email": "alice@startup.com",
    "organizationId": "org-xyz-789",
    "role": "admin",
    "verificationRequired": true
  },
  "message": "Account created successfully. Please check your email to verify."
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email already exists"
  }
}
```

**Example cURL:**
```bash
curl -X POST https://your-api.execute-api.ap-south-1.amazonaws.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@startup.com",
    "password": "SecurePassword123",
    "name": "Alice Developer",
    "organizationName": "My Startup",
    "githubUsername": "alice-dev"
  }'
```

---

### **2. Verify Email**

Verify email address with code sent to user's email.

**Endpoint:** `POST /auth/verify`

**Authentication:** None required

**Request Body:**
```json
{
  "email": "alice@startup.com",
  "code": "ABC123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now login."
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CODE",
    "message": "Verification code is invalid or expired"
  }
}
```

**Example cURL:**
```bash
curl -X POST https://your-api.execute-api.ap-south-1.amazonaws.com/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@startup.com",
    "code": "ABC123"
  }'
```

---

### **3. Login**

Authenticate user and receive JWT tokens.

**Endpoint:** `POST /auth/login`

**Authentication:** None required

**Request Body:**
```json
{
  "email": "alice@startup.com",
  "password": "SecurePassword123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer",
    "user": {
      "id": "user-abc-123",
      "email": "alice@startup.com",
      "name": "Alice Developer",
      "organizationId": "org-xyz-789",
      "organizationName": "My Startup",
      "role": "admin",
      "githubUsername": "alice-dev"
    }
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

**Example cURL:**
```bash
curl -X POST https://your-api.execute-api.ap-south-1.amazonaws.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@startup.com",
    "password": "SecurePassword123"
  }'
```

---

### **4. Refresh Token**

Get a new access token using refresh token.

**Endpoint:** `POST /auth/refresh`

**Authentication:** None required (uses refresh token)

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

**Example cURL:**
```bash
curl -X POST https://your-api.execute-api.ap-south-1.amazonaws.com/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

---

### **5. Get Current User**

Get authenticated user's profile.

**Endpoint:** `GET /auth/me`

**Authentication:** Required

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "user-abc-123",
    "email": "alice@startup.com",
    "name": "Alice Developer",
    "organizationId": "org-xyz-789",
    "organizationName": "My Startup",
    "role": "admin",
    "githubUsername": "alice-dev",
    "createdAt": "2025-01-15T10:30:00Z",
    "lastLoginAt": "2025-01-24T09:00:00Z"
  }
}
```

**Example cURL:**
```bash
curl -X GET https://your-api.execute-api.ap-south-1.amazonaws.com/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### **6. Logout**

Invalidate current session (optional - client-side token removal is sufficient).

**Endpoint:** `POST /auth/logout`

**Authentication:** Required

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🤖 **AI Analytics Endpoints**

### **7. Code Quality Analysis**

Analyze code quality for a GitHub user.

**Endpoint:** `GET /ai/code-quality/{username}`

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| username | string | GitHub username to analyze |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| forceRefresh | boolean | No | false | Bypass cache and fetch fresh data |

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "codeQuality": {
      "overallScore": 7.8,
      "rating": "Good",
      "analysis": "Good code quality with room for improvement in certain areas.",
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
    },
    "metrics": {
      "totalCommits": 2456,
      "totalRepositories": 10,
      "totalPullRequests": 156,
      "totalIssues": 89,
      "averageCommitSize": 15,
      "largeCommitPercentage": 12,
      "averagePRMergeTime": 3.2,
      "issueResolutionRate": 85,
      "languages": {
        "JavaScript": 60,
        "Python": 30,
        "TypeScript": 10
      },
      "activityPeriod": {
        "start": "2024-01-15",
        "end": "2025-01-24"
      }
    }
  },
  "dataSource": "REAL GitHub API",
  "cached": false,
  "cacheAge": null,
  "generatedAt": "2025-01-24T10:30:00Z",
  "generationTime": "850ms"
}
```

**Cached Response:**
```json
{
  "success": true,
  "data": { /* ... same as above ... */ },
  "dataSource": "CACHE",
  "cached": true,
  "cacheAge": "2 hours",
  "cachedAt": "2025-01-24T08:30:00Z",
  "expiresAt": "2025-01-25T08:30:00Z",
  "generationTime": "50ms"
}
```

**Example cURL:**
```bash
# Get code quality (uses cache if available)
curl -X GET https://your-api.execute-api.ap-south-1.amazonaws.com/ai/code-quality/torvalds \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Force refresh (bypass cache)
curl -X GET "https://your-api.execute-api.ap-south-1.amazonaws.com/ai/code-quality/torvalds?forceRefresh=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "GitHub user 'invalid-user' not found or not a member of your organization"
  }
}
```

---

### **8. Burnout Risk Analysis**

Detect burnout risk patterns for a developer.

**Endpoint:** `GET /ai/burnout-risk/{email}`

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| email | string | User's email address |

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "burnoutRisk": {
      "riskScore": 8.1,
      "riskLevel": "HIGH",
      "confidence": 87,
      "severity": "CRITICAL",
      "patterns": {
        "lateNightCommits": {
          "percentage": 45,
          "description": "45% of commits made after 10 PM",
          "severity": "CRITICAL"
        },
        "weekendWork": {
          "percentage": 25,
          "description": "Working on 25% of weekends",
          "severity": "HIGH"
        },
        "consecutiveWorkDays": {
          "maxStreak": 14,
          "description": "Worked 14 consecutive days without break",
          "severity": "HIGH"
        },
        "noBreaks": {
          "daysOffInYear": 12,
          "description": "Only 12 days off in last 365 days",
          "severity": "CRITICAL"
        },
        "workloadTrend": {
          "trend": "+15%",
          "description": "Workload increasing 15% month-over-month",
          "severity": "MEDIUM"
        }
      },
      "psychologicalIndicators": [
        "Consistent late-night work suggests poor work-life balance",
        "Lack of breaks increases burnout risk by 300%",
        "Increasing workload without compensation raises stress"
      ],
      "recommendations": [
        {
          "priority": "URGENT",
          "action": "Schedule at least 2 consecutive days off THIS WEEK",
          "rationale": "Immediate rest needed to prevent burnout"
        },
        {
          "priority": "HIGH",
          "action": "Set hard stop time: No work after 8 PM",
          "rationale": "Late-night work severely impacts mental health"
        },
        {
          "priority": "HIGH",
          "action": "Block weekends for personal time",
          "rationale": "Weekend work prevents proper recovery"
        },
        {
          "priority": "MEDIUM",
          "action": "Discuss workload with manager immediately",
          "rationale": "Current pace is unsustainable"
        },
        {
          "priority": "MEDIUM",
          "action": "Plan a vacation week within next month",
          "rationale": "Extended break needed for recovery"
        }
      ],
      "healthImpact": {
        "currentTrajectory": "85% chance of serious burnout within 3 months",
        "withChanges": "60% risk reduction if recommendations followed"
      }
    },
    "workPatterns": {
      "averageWorkHoursPerDay": 11,
      "peakWorkHours": "9 AM - 11 PM",
      "mostActiveDay": "Tuesday",
      "leastActiveDay": "Sunday (still working 25%)",
      "commitFrequency": "6.7 commits/day",
      "commitTrend": "+15% month-over-month"
    }
  },
  "generatedAt": "2025-01-24T10:30:00Z"
}
```

**Example cURL:**
```bash
curl -X GET https://your-api.execute-api.ap-south-1.amazonaws.com/ai/burnout-risk/alice@startup.com \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Privacy Note:** Burnout data is only visible to:
- The user themselves
- Organization admins
- Not visible to other team members

---

### **9. Team Performance Analytics**

Get comprehensive team performance metrics.

**Endpoint:** `GET /ai/team-performance/{organizationId}`

**Authentication:** Required (Admin or Member role)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Organization ID |

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "teamPerformance": {
      "overallScore": 7.2,
      "teamHealth": "GOOD with concerns",
      "totalMembers": 10,
      "summary": {
        "averageCodeQuality": 7.4,
        "totalCommits": 8234,
        "averageCommitsPerMember": 823,
        "teamVelocity": {
          "current": "823 commits/member/month",
          "trend": "+12% month-over-month",
          "capacity": "85% (near limit)"
        }
      },
      "topPerformers": [
        {
          "userId": "user-bob-002",
          "name": "Bob Senior",
          "githubUsername": "bob-senior",
          "codeQualityScore": 8.5,
          "commits": 1234,
          "pullRequests": 67,
          "issuesResolved": 23,
          "strengths": [
            "Consistently high code quality",
            "Excellent PR review participation",
            "Fast issue resolution"
          ]
        }
      ],
      "needsSupport": [
        {
          "userId": "user-charlie-003",
          "name": "Charlie Junior",
          "githubUsername": "charlie-junior",
          "codeQualityScore": 6.2,
          "commits": 456,
          "recommendations": [
            "Pair programming with senior developer",
            "Weekly code review sessions",
            "Focus on code quality fundamentals"
          ]
        }
      ],
      "burnoutRisks": [
        {
          "userId": "user-alice-005",
          "name": "Alice Dev",
          "githubUsername": "alice-dev",
          "riskScore": 8.1,
          "riskLevel": "CRITICAL",
          "pattern": "45% late-night commits, 25% weekend work",
          "urgency": "Immediate action required"
        }
      ],
      "insights": [
        "Team velocity healthy at +12% month-over-month",
        "Code quality above industry average (7.4 vs 6.8)",
        "1 developer showing critical burnout signs",
        "1 junior developer needs mentoring",
        "Team at 85% capacity - consider hiring"
      ],
      "recommendations": [
        {
          "priority": "URGENT",
          "category": "Burnout Prevention",
          "action": "Address Alice's burnout within 48 hours",
          "steps": [
            "Schedule 1:1 meeting immediately",
            "Reduce workload by 30%",
            "Mandate no work after 8 PM",
            "Plan 1 week vacation within 30 days"
          ]
        },
        {
          "priority": "HIGH",
          "category": "Team Development",
          "action": "Implement mentoring program",
          "steps": [
            "Pair Charlie with Bob",
            "Weekly code review sessions",
            "Set up learning plan"
          ]
        },
        {
          "priority": "MEDIUM",
          "category": "Scaling",
          "action": "Hire 2 backend engineers within 3 months",
          "rationale": {
            "currentCapacity": "85% (at risk)",
            "burnoutRisk": "1 critical case",
            "projectedCapacity": "70% with 2 new hires",
            "roi": {
              "cost": "$240K/year (2 × $120K)",
              "benefit": "$400K productivity gain",
              "netROI": "$160K/year (66% return)"
            }
          }
        }
      ]
    }
  },
  "generatedAt": "2025-01-24T10:30:00Z",
  "cached": true,
  "cacheAge": "30 minutes"
}
```

**Example cURL:**
```bash
curl -X GET https://your-api.execute-api.ap-south-1.amazonaws.com/ai/team-performance/org-xyz-789 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### **10. Dashboard Summary**

Get complete dashboard with all analytics.

**Endpoint:** `GET /ai/dashboard/{organizationId}`

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Organization ID |

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "dashboard": {
      "organization": {
        "id": "org-xyz-789",
        "name": "My Startup",
        "memberCount": 10,
        "plan": "pro"
      },
      "summary": {
        "teamHealth": 7.2,
        "averageCodeQuality": 7.4,
        "totalCommits": 8234,
        "criticalAlerts": 1
      },
      "codeQuality": {
        /* Team-wide code quality metrics */
      },
      "burnoutRisks": {
        /* Team burnout overview */
      },
      "teamPerformance": {
        /* Complete team analytics */
      },
      "recentActivity": [
        {
          "type": "HIGH_BURNOUT_DETECTED",
          "user": "Alice Dev",
          "timestamp": "2025-01-24T09:00:00Z",
          "severity": "CRITICAL"
        },
        {
          "type": "CODE_QUALITY_IMPROVED",
          "user": "Charlie Junior",
          "improvement": "+0.5 points",
          "timestamp": "2025-01-23T15:30:00Z"
        }
      ],
      "alerts": [
        {
          "id": "alert-001",
          "type": "BURNOUT_RISK",
          "severity": "CRITICAL",
          "message": "Alice Dev showing critical burnout signs",
          "actionRequired": "Immediate manager intervention",
          "createdAt": "2025-01-24T09:00:00Z"
        }
      ]
    }
  },
  "generatedAt": "2025-01-24T10:30:00Z"
}
```

**Example cURL:**
```bash
curl -X GET https://your-api.execute-api.ap-south-1.amazonaws.com/ai/dashboard/org-xyz-789 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### **11. Generate Executive Report**

Generate comprehensive PDF report for executives.

**Endpoint:** `POST /ai/generate-report/{organizationId}`

**Authentication:** Required (Admin only)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Organization ID |

**Request Body:**
```json
{
  "reportType": "executive",
  "includeGraphs": true,
  "includeIndividuals": false,
  "confidential": true,
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-24"
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reportId": "report-abc-123",
    "reportUrl": "https://s3.amazonaws.com/devinsights/reports/report-abc-123.pdf",
    "reportType": "executive",
    "generatedAt": "2025-01-24T10:30:00Z",
    "expiresAt": "2025-01-31T10:30:00Z",
    "summary": {
      "teamSize": 10,
      "overallHealth": 7.2,
      "criticalFindings": 1,
      "pageCount": 15
    }
  }
}
```

**Example cURL:**
```bash
curl -X POST https://your-api.execute-api.ap-south-1.amazonaws.com/ai/generate-report/org-xyz-789 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "executive",
    "includeGraphs": true
  }'
```

---

## 👥 **Team Management Endpoints**

### **12. List Team Members**

Get all members in organization.

**Endpoint:** `GET /team/members`

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| role | string | No | all | Filter by role: admin, member, viewer, all |
| status | string | No | active | Filter by status: active, invited, inactive |
| limit | integer | No | 50 | Results per page (max 100) |
| offset | integer | No | 0 | Pagination offset |

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "userId": "user-abc-123",
        "email": "alice@startup.com",
        "name": "Alice Developer",
        "role": "admin",
        "status": "active",
        "githubUsername": "alice-dev",
        "joinedAt": "2025-01-15T10:30:00Z",
        "lastActiveAt": "2025-01-24T09:00:00Z",
        "metrics": {
          "codeQuality": 7.8,
          "commits": 2456,
          "burnoutRisk": 8.1
        }
      },
      {
        "userId": "user-bob-002",
        "email": "bob@startup.com",
        "name": "Bob Senior",
        "role": "member",
        "status": "active",
        "githubUsername": "bob-senior",
        "joinedAt": "2025-01-16T14:20:00Z",
        "lastActiveAt": "2025-01-24T10:15:00Z",
        "metrics": {
          "codeQuality": 8.5,
          "commits": 1234,
          "burnoutRisk": 4.2
        }
      }
    ],
    "pagination": {
      "total": 10,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

**Example cURL:**
```bash
# Get all members
curl -X GET https://your-api.execute-api.ap-south-1.amazonaws.com/team/members \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get only admins
curl -X GET "https://your-api.execute-api.ap-south-1.amazonaws.com/team/members?role=admin" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### **13. Invite Team Members**

Invite new members to organization.

**Endpoint:** `POST /team/invite`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "invitations": [
    {
      "email": "newuser@startup.com",
      "name": "New User",
      "role": "member",
      "githubUsername": "new-user-gh"
    },
    {
      "email": "another@startup.com",
      "name": "Another User",
      "role": "viewer"
    }
  ]
}
```

**Request Parameters:**

| Field | Type | Required | Options |
|-------|------|----------|---------|
| email | string | Yes | Valid email |
| name | string | Yes | 2-50 characters |
| role | string | Yes | admin, member, viewer |
| githubUsername | string | No | GitHub username |

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "invitations": {
      "sent": 2,
      "failed": 0,
      "pending": 2
    },
    "details": [
      {
        "email": "newuser@startup.com",
        "status": "sent",
        "inviteId": "invite-abc-123",
        "expiresAt": "2025-01-31T10:30:00Z"
      },
      {
        "email": "another@startup.com",
        "status": "sent",
        "inviteId": "invite-def-456",
        "expiresAt": "2025-01-31T10:30:00Z"
      }
    ]
  },
  "message": "2 invitations sent successfully"
}
```

**Example cURL:**
```bash
curl -X POST https://your-api.execute-api.ap-south-1.amazonaws.com/team/invite \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invitations": [
      {
        "email": "newuser@startup.com",
        "name": "New User",
        "role": "member"
      }
    ]
  }'
```

---

### **14. Remove Team Member**

Remove a member from organization.

**Endpoint:** `DELETE /team/member/{userId}`

**Authentication:** Required (Admin only)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| userId | string | User ID to remove |

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "User removed from organization successfully"
}
```

**Example cURL:**
```bash
curl -X DELETE https://your-api.execute-api.ap-south-1.amazonaws.com/team/member/user-bob-002 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### **15. Update Member Role**

Update a team member's role.

**Endpoint:** `PUT /team/member/{userId}/role`

**Authentication:** Required (Admin only)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| userId | string | User ID to update |

**Request Body:**
```json
{
  "role": "admin"
}
```

**Allowed Roles:**
- `admin`: Full access to all features
- `member`: Can view team data, manage own profile
- `viewer`: Read-only access to team metrics

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "user-bob-002",
    "previousRole": "member",
    "newRole": "admin",
    "updatedAt": "2025-01-24T10:30:00Z"
  },
  "message": "User role updated successfully"
}
```

**Example cURL:**
```bash
curl -X PUT https://your-api.execute-api.ap-south-1.amazonaws.com/team/member/user-bob-002/role \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

---

## 🏢 **Organization Endpoints**

### **16. Get Organization Details**

Get organization information and settings.

**Endpoint:** `GET /organization`

**Authentication:** Required

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "organizationId": "org-xyz-789",
    "name": "My Startup",
    "plan": "pro",
    "memberCount": 10,
    "maxMembers": 100,
    "createdAt": "2025-01-15T10:30:00Z",
    "settings": {
      "allowMembersViewOthers": true,
      "privacyMode": "team_transparent",
      "timezone": "America/Los_Angeles",
      "features": {
        "codeQuality": true,
        "burnoutDetection": true,
        "teamAnalytics": true,
        "aiReports": true
      }
    },
    "usage": {
      "apiCalls": {
        "current": 45000,
        "limit": 100000,
        "percentage": 45
      },
      "storage": {
        "current": "1.2 GB",
        "limit": "25 GB",
        "percentage": 4.8
      }
    }
  }
}
```

**Example cURL:**
```bash
curl -X GET https://your-api.execute-api.ap-south-1.amazonaws.com/organization \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### **17. Update Organization Settings**

Update organization settings.

**Endpoint:** `PUT /organization/settings`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "name": "Updated Startup Name",
  "settings": {
    "allowMembersViewOthers": false,
    "privacyMode": "fully_private",
    "timezone": "America/New_York"
  }
}
```

**Privacy Modes:**
- `fully_private`: Members see only their own data
- `team_transparent`: Members see team metrics, admins see everything
- `public_metrics`: All data visible to team

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "organizationId": "org-xyz-789",
    "name": "Updated Startup Name",
    "settings": {
      "allowMembersViewOthers": false,
      "privacyMode": "fully_private",
      "timezone": "America/New_York"
    },
    "updatedAt": "2025-01-24T10:30:00Z"
  },
  "message": "Organization settings updated successfully"
}
```

**Example cURL:**
```bash
curl -X PUT https://your-api.execute-api.ap-south-1.amazonaws.com/organization/settings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "allowMembersViewOthers": false,
      "privacyMode": "fully_private"
    }
  }'
```

---

## 👤 **User Profile Endpoints**

### **18. Get User Profile**

Get user's profile information.

**Endpoint:** `GET /profile`

**Authentication:** Required

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "user-abc-123",
    "email": "alice@startup.com",
    "name": "Alice Developer",
    "organizationId": "org-xyz-789",
    "organizationName": "My Startup",
    "role": "admin",
    "githubUsername": "alice-dev",
    "createdAt": "2025-01-15T10:30:00Z",
    "lastLoginAt": "2025-01-24T09:00:00Z",
    "preferences": {
      "emailNotifications": true,
      "weeklyReports": true,
      "burnoutAlerts": true
    }
  }
}
```

**Example cURL:**
```bash
curl -X GET https://your-api.execute-api.ap-south-1.amazonaws.com/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### **19. Update User Profile**

Update user's profile information.

**Endpoint:** `PUT /profile`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Alice Senior Developer",
  "githubUsername": "alice-senior-dev",
  "preferences": {
    "emailNotifications": false,
    "weeklyReports": true,
    "burnoutAlerts": true
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "user-abc-123",
    "name": "Alice Senior Developer",
    "githubUsername": "alice-senior-dev",
    "preferences": {
      "emailNotifications": false,
      "weeklyReports": true,
      "burnoutAlerts": true
    },
    "updatedAt": "2025-01-24T10:30:00Z"
  },
  "message": "Profile updated successfully"
}
```

**Example cURL:**
```bash
curl -X PUT https://your-api.execute-api.ap-south-1.amazonaws.com/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Senior Developer",
    "preferences": {
      "emailNotifications": false
    }
  }'
```

---

### **20. Delete Account**

Permanently delete user account.

**Endpoint:** `DELETE /profile`

**Authentication:** Required

**Request Body:**
```json
{
  "password": "SecurePassword123",
  "confirmation": "DELETE_MY_ACCOUNT"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Example cURL:**
```bash
curl -X DELETE https://your-api.execute-api.ap-south-1.amazonaws.com/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "SecurePassword123",
    "confirmation": "DELETE_MY_ACCOUNT"
  }'
```

---

## 📊 **Quick Reference**

### **Complete Endpoint List**
```
Authentication (6 endpoints)
├─ POST   /auth/signup
├─ POST   /auth/verify
├─ POST   /auth/login
├─ POST   /auth/refresh
├─ GET    /auth/me
└─ POST   /auth/logout

AI Analytics (5 endpoints)
├─ GET    /ai/code-quality/{username}
├─ GET    /ai/burnout-risk/{email}
├─ GET    /ai/team-performance/{organizationId}
├─ GET    /ai/dashboard/{organizationId}
└─ POST   /ai/generate-report/{organizationId}

Team Management (4 endpoints)
├─ GET    /team/members
├─ POST   /team/invite
├─ DELETE /team/member/{userId}
└─ PUT    /team/member/{userId}/role

Organization (2 endpoints)
├─ GET    /organization
└─ PUT    /organization/settings

User Profile (3 endpoints)
├─ GET    /profile
├─ PUT    /profile
└─ DELETE /profile

Health Check (1 endpoint)
└─ GET    /health

Total: 21 endpoints
```

---

## 🧪 **Testing with Postman**

### **Environment Setup**
```json
{
  "name": "DevInsights API - Production",
  "values": [
    {
      "key": "base_url",
      "value": "https://your-api-id.execute-api.ap-south-1.amazonaws.com"
    },
    {
      "key": "access_token",
      "value": ""
    }
  ]
}
```

### **Sample Request Sequence**
```
1. Sign Up
   POST {{base_url}}/auth/signup
   Save userId from response

2. Verify Email
   POST {{base_url}}/auth/verify
   Use code from email

3. Login
   POST {{base_url}}/auth/login
   Save accessToken to environment variable

4. Get Code Quality
   GET {{base_url}}/ai/code-quality/torvalds
   Authorization: Bearer {{access_token}}

5. Get Team Performance
   GET {{base_url}}/ai/team-performance/org-xyz-789
   Authorization: Bearer {{access_token}}
```

---

## 📞 **Support**

**Issues or Questions?**
- GitHub Issues: https://github.com/yourusername/devinsights-ai/issues
- Email: support@devinsights.com
- Documentation: https://docs.devinsights.com

---

**Built with ❤️ by DevInsights Team**
