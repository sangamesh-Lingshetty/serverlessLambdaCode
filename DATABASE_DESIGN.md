# Database Design - DevInsights AI

Complete database schema, access patterns, indexing strategy, and data modeling for multi-tenant architecture.

---

## 📋 **Table of Contents**

1. [Database Overview](#database-overview)
2. [Technology Choice: Why DynamoDB?](#technology-choice-why-dynamodb)
3. [Single-Table Design](#single-table-design)
4. [Schema Structure](#schema-structure)
5. [Access Patterns](#access-patterns)
6. [Indexes & Performance](#indexes--performance)
7. [Data Examples](#data-examples)
8. [TTL & Auto-Cleanup](#ttl--auto-cleanup)
9. [Multi-Tenancy Implementation](#multi-tenancy-implementation)
10. [Query Performance](#query-performance)
11. [Scaling Strategy](#scaling-strategy)
12. [Backup & Recovery](#backup--recovery)

---

## 🎯 **Database Overview**

### **Technology Stack**
```
Database: AWS DynamoDB
Type: NoSQL (Key-Value + Document Store)
Deployment: Fully managed, serverless
Region: ap-south-1 (Mumbai)
Billing: On-demand capacity
Encryption: AES-256 at rest (automatic)
Backup: Point-in-time recovery (enabled)
```

### **Key Characteristics**
```
✅ Serverless (no server management)
✅ Auto-scaling (handles any load)
✅ Single-digit millisecond latency
✅ Multi-tenant friendly (partition keys)
✅ TTL support (automatic data cleanup)
✅ Free tier: 25GB + 2.5M requests/month
✅ Encryption at rest (built-in)
✅ Global tables (multi-region replication)
```

---

## 🤔 **Technology Choice: Why DynamoDB?**

### **Comparison with Alternatives**
```
╔═══════════════════════════════════════════════════════════════╗
║  DynamoDB vs PostgreSQL (RDS)                                 ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  PostgreSQL (RDS):                                            ║
║  ❌ Requires server management (instance sizing)             ║
║  ❌ Fixed capacity (must provision)                          ║
║  ❌ Vertical scaling only (upgrade instance)                 ║
║  ❌ Cost: $16+/month minimum (db.t2.micro)                   ║
║  ❌ Manual backups needed                                    ║
║  ❌ Multi-tenancy requires complex queries                   ║
║                                                               ║
║  DynamoDB:                                                    ║
║  ✅ Fully managed (zero server management)                   ║
║  ✅ On-demand capacity (pay per request)                     ║
║  ✅ Horizontal scaling (unlimited)                           ║
║  ✅ Cost: $0/month for typical usage (25GB free)             ║
║  ✅ Automatic backups (point-in-time recovery)               ║
║  ✅ Multi-tenancy via partition keys (built-in)              ║
║                                                               ║
║  Winner: DynamoDB ✅                                          ║
╚═══════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════╗
║  DynamoDB vs MongoDB Atlas                                    ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  MongoDB Atlas:                                               ║
║  ❌ Requires cluster management                              ║
║  ❌ Cost: $9+/month minimum (M0 shared)                      ║
║  ❌ Connection pooling complexity                            ║
║  ❌ No built-in multi-tenancy patterns                       ║
║                                                               ║
║  DynamoDB:                                                    ║
║  ✅ Zero cluster management                                  ║
║  ✅ Cost: $0/month (25GB free tier)                          ║
║  ✅ HTTP API (no connection pooling)                         ║
║  ✅ Partition keys for multi-tenancy                         ║
║                                                               ║
║  Winner: DynamoDB ✅                                          ║
╚═══════════════════════════════════════════════════════════════╝
```

### **Why DynamoDB Wins for This Use Case**
```
1. Multi-Tenancy:
   • Partition key = Organization ID
   • Physical data isolation (different partitions)
   • No cross-org queries possible

2. Serverless Architecture:
   • Pairs perfectly with Lambda
   • No connection pool management
   • HTTP API (not persistent connections)

3. Cost Efficiency:
   • Free tier: 25GB storage
   • On-demand: Pay only for actual requests
   • $0/month for typical startup usage

4. Performance:
   • Single-digit millisecond latency
   • Key-value lookups: 5-10ms
   • No complex joins (NoSQL design)

5. Scalability:
   • Auto-scales to unlimited data
   • No manual capacity planning
   • Handles 10M+ requests/day easily
```

---

## 📊 **Single-Table Design**

### **Why Single-Table?**

DynamoDB best practice: Store all entities in ONE table with composite keys.
```
Benefits:
✅ Cost-efficient (fewer tables = lower cost)
✅ Atomic transactions across entity types
✅ Easier to query related data
✅ Simplified access patterns
✅ Better performance (fewer table scans)

Alternative (Multi-Table):
❌ More expensive (multiple tables)
❌ No cross-table transactions
❌ Complex joins needed
❌ Higher latency for related data
```

### **Single-Table Structure**
```
Table: organizations

All entities stored in ONE table:
├─ Organizations
├─ Users
├─ Team Members
├─ GitHub Data Cache
├─ Team Reports
├─ Invitations
└─ Settings
```

---

## 🏗️ **Schema Structure**

### **Table Configuration**
```yaml
Table Name: organizations
Region: ap-south-1
Billing Mode: On-Demand (pay per request)
Encryption: AWS managed (AES-256)

Primary Key:
  Partition Key: PK (String)
  Sort Key: SK (String)

Global Secondary Indexes:
  GSI1:
    Partition Key: GSI1PK (String)
    Sort Key: GSI1SK (String)
  
  GSI2:
    Partition Key: GSI2PK (String)
    Sort Key: GSI2SK (String)

TTL Attribute: expiresAt (Number - Unix timestamp)

Stream: Enabled (for future real-time features)
```

### **Attribute Schema**
```javascript
{
  // Primary Keys (Required)
  PK: String,              // Partition key: ORG#{organizationId}
  SK: String,              // Sort key: TYPE#{entityId}
  
  // Global Secondary Index Keys
  GSI1PK: String,          // Alternative partition key
  GSI1SK: String,          // Alternative sort key
  GSI2PK: String,          // Second alternative partition key
  GSI2SK: String,          // Second alternative sort key
  
  // Common Attributes
  entityType: String,      // Type of entity: ORG, USER, GITHUB_DATA, etc.
  organizationId: String,  // Always present (for filtering)
  createdAt: Number,       // Unix timestamp
  updatedAt: Number,       // Unix timestamp
  expiresAt: Number,       // TTL for auto-deletion (optional)
  
  // Entity-Specific Attributes
  // ... varies by entity type
}
```

---

## 🔑 **Access Patterns**

### **Pattern 1: Get Organization Details**
```javascript
// Query
{
  TableName: "organizations",
  Key: {
    PK: "ORG#org-xyz-789",
    SK: "ORG#org-xyz-789"
  }
}

// Item Structure
{
  PK: "ORG#org-xyz-789",
  SK: "ORG#org-xyz-789",
  entityType: "ORGANIZATION",
  organizationId: "org-xyz-789",
  name: "My Startup",
  plan: "pro",
  maxMembers: 100,
  currentMembers: 10,
  ownerId: "user-abc-123",
  settings: {
    allowMembersViewOthers: true,
    privacyMode: "team_transparent",
    timezone: "America/Los_Angeles",
    features: {
      codeQuality: true,
      burnoutDetection: true,
      teamAnalytics: true
    }
  },
  createdAt: 1705329000000,
  updatedAt: 1706088000000
}

// Performance: ~5ms (key lookup)
```

---

### **Pattern 2: Get All Team Members**
```javascript
// Query
{
  TableName: "organizations",
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
  ExpressionAttributeValues: {
    ":pk": "ORG#org-xyz-789",
    ":sk": "MEMBER#"
  }
}

// Returns all items where:
// - PK = "ORG#org-xyz-789"
// - SK starts with "MEMBER#"

// Result: All members in organization
[
  {
    PK: "ORG#org-xyz-789",
    SK: "MEMBER#user-bob-002",
    entityType: "MEMBER",
    userId: "user-bob-002",
    email: "bob@startup.com",
    name: "Bob Senior",
    role: "member",
    githubUsername: "bob-senior",
    joinedAt: 1705415400000,
    status: "active"
  },
  {
    PK: "ORG#org-xyz-789",
    SK: "MEMBER#user-charlie-003",
    entityType: "MEMBER",
    userId: "user-charlie-003",
    email: "charlie@startup.com",
    name: "Charlie Junior",
    role: "member",
    githubUsername: "charlie-junior",
    joinedAt: 1705501800000,
    status: "active"
  }
  // ... more members
]

// Performance: ~10ms (partition query)
```

---

### **Pattern 3: Get Specific User**
```javascript
// Query
{
  TableName: "organizations",
  Key: {
    PK: "ORG#org-xyz-789",
    SK: "MEMBER#user-bob-002"
  }
}

// Returns single user
{
  PK: "ORG#org-xyz-789",
  SK: "MEMBER#user-bob-002",
  entityType: "MEMBER",
  userId: "user-bob-002",
  email: "bob@startup.com",
  name: "Bob Senior",
  role: "member",
  githubUsername: "bob-senior",
  permissions: [
    "read_own_data",
    "read_team_data",
    "view_reports"
  ],
  preferences: {
    emailNotifications: true,
    weeklyReports: true,
    burnoutAlerts: true
  },
  joinedAt: 1705415400000,
  lastLoginAt: 1706088000000,
  status: "active"
}

// Performance: ~5ms (key lookup)
```

---

### **Pattern 4: Get User's GitHub Data (Cache)**
```javascript
// Query
{
  TableName: "organizations",
  Key: {
    PK: "ORG#org-xyz-789",
    SK: "GITHUB_DATA#bob-senior"
  }
}

// Returns cached GitHub analytics
{
  PK: "ORG#org-xyz-789",
  SK: "GITHUB_DATA#bob-senior",
  entityType: "GITHUB_DATA",
  githubUsername: "bob-senior",
  userId: "user-bob-002",
  organizationId: "org-xyz-789",
  data: {
    codeQuality: {
      overallScore: 8.5,
      rating: "Excellent",
      issues: [
        "Occasional large commits (>50 files)"
      ],
      recommendations: [
        "Continue current practices",
        "Consider mentoring junior developers"
      ],
      strengths: [
        "Consistent commit frequency",
        "High code review participation",
        "Fast issue resolution"
      ]
    },
    metrics: {
      totalCommits: 1234,
      totalRepositories: 5,
      totalPullRequests: 67,
      totalIssues: 23,
      averageCommitSize: 12,
      languages: {
        "JavaScript": 45,
        "TypeScript": 30,
        "Python": 25
      }
    },
    burnoutRisk: {
      riskScore: 4.2,
      riskLevel: "LOW",
      patterns: {
        lateNightCommits: 15,
        weekendWork: 10
      }
    }
  },
  cachedAt: 1706088000000,
  expiresAt: 1706174400000,  // 24 hours later (TTL)
  dataSource: "REAL GitHub API",
  generationTime: "850ms"
}

// Performance: ~5ms (key lookup)
// TTL: Auto-deleted after 24 hours
```

---

### **Pattern 5: Get All Cached Data (Team-Wide)**
```javascript
// Query
{
  TableName: "organizations",
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
  ExpressionAttributeValues: {
    ":pk": "ORG#org-xyz-789",
    ":sk": "GITHUB_DATA#"
  }
}

// Returns all cached GitHub data for team
[
  {
    PK: "ORG#org-xyz-789",
    SK: "GITHUB_DATA#bob-senior",
    data: { /* Bob's analytics */ }
  },
  {
    PK: "ORG#org-xyz-789",
    SK: "GITHUB_DATA#charlie-junior",
    data: { /* Charlie's analytics */ }
  },
  {
    PK: "ORG#org-xyz-789",
    SK: "GITHUB_DATA#alice-dev",
    data: { /* Alice's analytics */ }
  }
  // ... all team members
]

// Performance: ~15ms (batch query)
// Use case: Team dashboard
```

---

### **Pattern 6: Get Team Report**
```javascript
// Query
{
  TableName: "organizations",
  Key: {
    PK: "ORG#org-xyz-789",
    SK: "TEAM_REPORT#2025-01-24"
  }
}

// Returns daily team report
{
  PK: "ORG#org-xyz-789",
  SK: "TEAM_REPORT#2025-01-24",
  entityType: "TEAM_REPORT",
  organizationId: "org-xyz-789",
  reportDate: "2025-01-24",
  generatedBy: "user-abc-123",
  data: {
    teamHealth: 7.2,
    summary: {
      totalMembers: 10,
      averageCodeQuality: 7.4,
      totalCommits: 8234
    },
    topPerformers: [ /* ... */ ],
    burnoutRisks: [ /* ... */ ],
    recommendations: [ /* ... */ ]
  },
  generatedAt: 1706088000000,
  expiresAt: 1706174400000  // Expires in 24 hours
}

// Performance: ~5ms (key lookup)
```

---

### **Pattern 7: Find User by Email (GSI)**
```javascript
// Query using GSI
{
  TableName: "organizations",
  IndexName: "GSI1",
  KeyConditionExpression: "GSI1PK = :email",
  ExpressionAttributeValues: {
    ":email": "EMAIL#bob@startup.com"
  }
}

// Item with GSI attributes
{
  PK: "ORG#org-xyz-789",
  SK: "MEMBER#user-bob-002",
  GSI1PK: "EMAIL#bob@startup.com",    // Searchable by email
  GSI1SK: "USER#user-bob-002",
  // ... other attributes
}

// Returns user by email (across organizations)
// Performance: ~10ms (GSI query)
```

---

### **Pattern 8: List Pending Invitations**
```javascript
// Query
{
  TableName: "organizations",
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
  FilterExpression: "#status = :status",
  ExpressionAttributeNames: {
    "#status": "status"
  },
  ExpressionAttributeValues: {
    ":pk": "ORG#org-xyz-789",
    ":sk": "INVITE#",
    ":status": "pending"
  }
}

// Returns all pending invitations
[
  {
    PK: "ORG#org-xyz-789",
    SK: "INVITE#invite-abc-123",
    entityType: "INVITATION",
    inviteId: "invite-abc-123",
    email: "newuser@startup.com",
    name: "New User",
    role: "member",
    invitedBy: "user-abc-123",
    status: "pending",
    token: "secure-random-token",
    createdAt: 1706088000000,
    expiresAt: 1706174400000  // Expires in 24 hours
  }
]

// Performance: ~15ms (query + filter)
```

---

## 📈 **Indexes & Performance**

### **Primary Index (Main Table)**
```
Partition Key: PK
Sort Key: SK

Use Cases:
✅ Get specific entity (e.g., user, org, cache)
✅ Get all entities of same type in org
✅ Efficient partition queries
✅ Multi-tenant data isolation

Query Patterns:
- PK = "ORG#xyz" AND SK = "ORG#xyz"          (Get org)
- PK = "ORG#xyz" AND SK = "MEMBER#user-123"  (Get user)
- PK = "ORG#xyz" AND begins_with(SK, "MEMBER#") (Get all members)

Performance: 5-10ms
```

### **Global Secondary Index 1 (GSI1)**
```
Partition Key: GSI1PK
Sort Key: GSI1SK

Use Cases:
✅ Search by email
✅ Find user across organizations
✅ Alternative query patterns

Example:
GSI1PK: "EMAIL#bob@startup.com"
GSI1SK: "USER#user-bob-002"

Query Pattern:
- GSI1PK = "EMAIL#bob@startup.com"  (Find user by email)

Performance: 10-15ms
```

### **Global Secondary Index 2 (GSI2)**
```
Partition Key: GSI2PK
Sort Key: GSI2SK

Use Cases:
✅ Sort by creation date
✅ Time-based queries
✅ Activity tracking

Example:
GSI2PK: "ORG_ACTIVITY#org-xyz-789"
GSI2SK: "TIMESTAMP#1706088000000"

Query Pattern:
- GSI2PK = "ORG_ACTIVITY#xyz" AND GSI2SK > "TIMESTAMP#..."
  (Get recent activity)

Performance: 10-15ms
```

---

## 📦 **Data Examples**

### **Example 1: Organization Record**
```javascript
{
  // Primary Keys
  PK: "ORG#org-xyz-789",
  SK: "ORG#org-xyz-789",
  
  // Entity Info
  entityType: "ORGANIZATION",
  organizationId: "org-xyz-789",
  
  // Organization Data
  name: "My Startup",
  plan: "pro",
  maxMembers: 100,
  currentMembers: 10,
  ownerId: "user-abc-123",
  
  // Settings
  settings: {
    allowMembersViewOthers: true,
    privacyMode: "team_transparent",
    timezone: "America/Los_Angeles",
    features: {
      codeQuality: true,
      burnoutDetection: true,
      teamAnalytics: true,
      aiReports: true
    },
    emailNotifications: {
      burnoutAlerts: true,
      weeklyReports: true,
      criticalAlerts: true
    }
  },
  
  // Usage Tracking
  usage: {
    apiCalls: {
      current: 45000,
      limit: 100000
    },
    storage: {
      current: 1200000000,  // 1.2 GB in bytes
      limit: 26843545600    // 25 GB
    }
  },
  
  // Timestamps
  createdAt: 1705329000000,
  updatedAt: 1706088000000
}
```

---

### **Example 2: Admin User Record**
```javascript
{
  // Primary Keys
  PK: "ORG#org-xyz-789",
  SK: "ADMIN#user-abc-123",
  
  // GSI Keys
  GSI1PK: "EMAIL#alice@startup.com",
  GSI1SK: "USER#user-abc-123",
  GSI2PK: "USER#user-abc-123",
  GSI2SK: "JOINED#1705329000000",
  
  // Entity Info
  entityType: "ADMIN",
  userId: "user-abc-123",
  organizationId: "org-xyz-789",
  
  // User Data
  email: "alice@startup.com",
  name: "Alice Developer",
  role: "admin",
  status: "active",
  githubUsername: "alice-dev",
  
  // Permissions
  permissions: [
    "read_own_data",
    "read_team_data",
    "write_team_data",
    "invite_members",
    "remove_members",
    "manage_settings",
    "view_reports",
    "generate_reports"
  ],
  
  // Preferences
  preferences: {
    emailNotifications: true,
    weeklyReports: true,
    burnoutAlerts: true,
    language: "en",
    dateFormat: "MM/DD/YYYY"
  },
  
  // Timestamps
  createdAt: 1705329000000,
  joinedAt: 1705329000000,
  lastLoginAt: 1706088000000,
  updatedAt: 1706088000000
}
```

---

### **Example 3: Member User Record**
```javascript
{
  // Primary Keys
  PK: "ORG#org-xyz-789",
  SK: "MEMBER#user-bob-002",
  
  // GSI Keys
  GSI1PK: "EMAIL#bob@startup.com",
  GSI1SK: "USER#user-bob-002",
  
  // Entity Info
  entityType: "MEMBER",
  userId: "user-bob-002",
  organizationId: "org-xyz-789",
  
  // User Data
  email: "bob@startup.com",
  name: "Bob Senior",
  role: "member",
  status: "active",
  githubUsername: "bob-senior",
  invitedBy: "user-abc-123",
  
  // Permissions (limited compared to admin)
  permissions: [
    "read_own_data",
    "read_team_data",
    "view_reports"
  ],
  
  // Preferences
  preferences: {
    emailNotifications: true,
    weeklyReports: false,
    burnoutAlerts: true
  },
  
  // Timestamps
  createdAt: 1705415400000,
  joinedAt: 1705415400000,
  lastLoginAt: 1706084400000,
  updatedAt: 1705415400000
}
```

---

### **Example 4: Viewer User Record**
```javascript
{
  // Primary Keys
  PK: "ORG#org-xyz-789",
  SK: "VIEWER#user-diana-004",
  
  // GSI Keys
  GSI1PK: "EMAIL#diana@startup.com",
  GSI1SK: "USER#user-diana-004",
  
  // Entity Info
  entityType: "VIEWER",
  userId: "user-diana-004",
  organizationId: "org-xyz-789",
  
  // User Data
  email: "diana@startup.com",
  name: "Diana CTO",
  role: "viewer",
  status: "active",
  githubUsername: null,  // CTO doesn't code
  invitedBy: "user-abc-123",
  
  // Permissions (read-only)
  permissions: [
    "view_team_stats",
    "view_reports"
  ],
  
  // Timestamps
  createdAt: 1705501800000,
  joinedAt: 1705501800000,
  lastLoginAt: 1706081400000,
  updatedAt: 1705501800000
}
```

---

### **Example 5: Invitation Record**
```javascript
{
  // Primary Keys
  PK: "ORG#org-xyz-789",
  SK: "INVITE#invite-abc-123",
  
  // Entity Info
  entityType: "INVITATION",
  inviteId: "invite-abc-123",
  organizationId: "org-xyz-789",
  
  // Invitation Data
  email: "newuser@startup.com",
  name: "New User",
  role: "member",
  githubUsername: null,
  invitedBy: "user-abc-123",
  invitedByName: "Alice Developer",
  status: "pending",
  
  // Security
  token: "secure-random-token-xyz",
  
  // Timestamps
  createdAt: 1706088000000,
  expiresAt: 1706174400000,  // Expires in 24 hours (TTL)
  acceptedAt: null
}
```

---

### **Example 6: GitHub Data Cache**
```javascript
{
  // Primary Keys
  PK: "ORG#org-xyz-789",
  SK: "GITHUB_DATA#bob-senior",
  
  // Entity Info
  entityType: "GITHUB_DATA",
  githubUsername: "bob-senior",
  userId: "user-bob-002",
  organizationId: "org-xyz-789",
  
  // Cached Analytics Data
  data: {
    codeQuality: {
      overallScore: 8.5,
      rating: "Excellent",
      analysis: "Consistently high-quality code with excellent practices.",
      issues: [
        "Occasional large commits (>50 files) - 8% of total"
      ],
      recommendations: [
        "Continue current practices",
        "Consider mentoring junior developers",
        "Document complex architectural decisions"
      ],
      strengths: [
        "Consistent commit frequency (daily)",
        "High code review participation (reviews 80% of team PRs)",
        "Fast issue resolution (avg 2.3 days)",
        "Clean commit messages"
      ]
    },
    metrics: {
      totalCommits: 1234,
      totalRepositories: 5,
      totalPullRequests: 67,
      totalIssues: 23,
      averageCommitSize: 12,
      largeCommitPercentage: 8,
      averagePRMergeTime: 2.1,
      issueResolutionRate: 92,
      languages: {
        "JavaScript": 45,
        "TypeScript": 30,
        "Python": 15,
        "Go": 10
      },
      activityPeriod: {
        start: "2024-01-15",
        end: "2025-01-24"
      },
      commitFrequency: {
        daily: 6.2,
        weekly: 43.4,
        monthly: 187
      }
    },
    burnoutRisk: {
      riskScore: 4.2,
      riskLevel: "LOW",
      confidence: 82,
      patterns: {
        lateNightCommits: 15,
        weekendWork: 10,
        consecutiveWorkDays: 7,
        averageWorkHours: 8
      },
      healthStatus: "HEALTHY"
    }
  },
  
  // Cache Metadata
  dataSource: "REAL GitHub API",
  cachedAt: 1706088000000,
  expiresAt: 1706174400000,  // 24 hours (TTL)
  generationTime: "850ms",
  apiCallsMade: 15
}
```

---

### **Example 7: Team Report**
```javascript
{
  // Primary Keys
  PK: "ORG#org-xyz-789",
  SK: "TEAM_REPORT#2025-01-24",
  
  // Entity Info
  entityType: "TEAM_REPORT",
  reportId: "report-abc-123",
  organizationId: "org-xyz-789",
  reportDate: "2025-01-24",
  reportType: "daily",
  
  // Report Data
  generatedBy: "user-abc-123",
  generatedByName: "Alice Developer",
  data: {
    teamHealth: 7.2,
    summary: {
      totalMembers: 10,
      activeMembers: 10,
      averageCodeQuality: 7.4,
      totalCommits: 8234,
      totalPullRequests: 456,
      totalIssues: 178,
      teamVelocity: "+12% month-over-month",
      capacity: "85%"
    },
    topPerformers: [
      {
        userId: "user-bob-002",
        name: "Bob Senior",
        codeQuality: 8.5,
        commits: 1234,
        contributions: "Outstanding"
      }
    ],
    needsSupport: [
      {
        userId: "user-charlie-003",
        name: "Charlie Junior",
        codeQuality: 6.2,
        recommendation: "Pair programming with senior"
      }
    ],
    burnoutRisks: [
      {
        userId: "user-alice-005",
        name: "Alice Dev",
        riskScore: 8.1,
        severity: "CRITICAL",
        urgency: "Immediate action required"
      }
    ],
    recommendations: [
      {
        priority: "URGENT",
        category: "Burnout Prevention",
        action: "Address Alice's burnout immediately"
      },
      {
        priority: "HIGH",
        category: "Team Development",
        action: "Implement mentoring program"
      },
      {
        priority: "MEDIUM",
        category: "Scaling",
        action: "Hire 2 backend engineers"
      }
    ]
  },
  
  // Timestamps
  generatedAt: 1706088000000,
  expiresAt: 1706174400000  // Expires in 24 hours (TTL)
}
```

---

## ⏰ **TTL & Auto-Cleanup**

### **How TTL Works**
```
DynamoDB Time-To-Live (TTL):
- Automatic item deletion after expiration
- No manual cleanup needed
- No cost for deletion
- Background process (may take 48 hours)
- Perfect for cache data

TTL Attribute: expiresAt (Unix timestamp in seconds)
```

### **Items with TTL**
```javascript
// Cache Item (expires in 24 hours)
{
  PK: "ORG#org-xyz-789",
  SK: "GITHUB_DATA#bob-senior",
  data: { /* analytics */ },
  cachedAt: 1706088000,      // Now
  expiresAt: 1706174400      // 24 hours later
  // DynamoDB auto-deletes after this time
}

// Invitation (expires in 24 hours)
{
  PK: "ORG#org-xyz-789",
  SK: "INVITE#invite-abc-123",
  email: "newuser@startup.com",
  createdAt: 1706088000,
  expiresAt: 1706174400      // Expires in 24h
  // Auto-deleted if not accepted
}

// Team Report (expires in 24 hours)
{
  PK: "ORG#org-xyz-789",
  SK: "TEAM_REPORT#2025-01-24",
  data: { /* report */ },
  generatedAt: 1706088000,
  expiresAt: 1706174400      // Fresh report daily
}
```

### **TTL Timeline**
```
T = 0 hours:
  ├─ Item created
  ├─ expiresAt = now + 24 hours
  └─ Item available ✅

T = 12 hours:
  ├─ Item still available ✅
  └─ Halfway to expiration

T = 24 hours:
  ├─ Item reaches expiration time
  ├─ DynamoDB marks for deletion
  └─ Item may still be available briefly

T = 24-48 hours:
  ├─ Background deletion process
  ├─ Item removed from table
  └─ Item no longer queryable ❌

Benefits:
✅ Automatic data cleanup
✅ No storage cost for expired data
✅ Data freshness guaranteed
✅ Compliance (data minimization)
```

---

## 🏢 **Multi-Tenancy Implementation**

### **Data Isolation Strategy**
```
Every item MUST have:
  PK: "ORG#{organizationId}#{...}"

This ensures:
✅ Physical partition separation
✅ No cross-org queries possible
✅ Automatic data isolation
✅ Query-level security
```

### **Multi-Tenant Query Example**
```javascript
// User Alice (org-xyz-789) requests data
const token = verifyJWT(request.headers.authorization);
// token.organizationId = "org-xyz-789"

// Query automatically scoped to Alice's org
const params = {
  TableName: "organizations",
  KeyConditionExpression: "PK = :pk",
  ExpressionAttributeValues: {
    ":pk": `ORG#${token.organizationId}`  // ← Always from token
  }
};

// Result: Only data from org-xyz-789 returned
// org-abc-123 data is physically unreachable!
```

### **Security: Why Cross-Org Access is Impossible**
```
┌─────────────────────────────────────────────────────────────┐
│  DynamoDB Physical Storage                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PARTITION 1: PK = "ORG#org-xyz-789"                       │
│  ├─ All TechStartup Inc data                               │
│  ├─ Stored in partition 1                                  │
│  └─ Physically separate from other partitions              │
│                                                             │
│  PARTITION 2: PK = "ORG#org-abc-123"                       │
│  ├─ All CompetitorCorp data                                │
│  ├─ Stored in partition 2                                  │
│  └─ Physically separate from partition 1                   │
│                                                             │
│  Query Limitation:                                          │
│  • DynamoDB queries MUST specify exact PK                  │
│  • Cannot query across partitions                          │
│  • JWT token contains ONLY user's organizationId           │
│  • User cannot change their organizationId (signed token)  │
│  → Cross-org access = IMPOSSIBLE ✅                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ **Query Performance**

### **Performance Benchmarks**
```
Query Type                    | Latency  | Items Returned
─────────────────────────────────────────────────────────────
Key Lookup (single item)      | 5-10ms   | 1
Partition Query (members)     | 10-15ms  | 10-50
Partition Query (cache data)  | 15-20ms  | 10-50
GSI Query (by email)          | 10-15ms  | 1
Batch Get (multiple items)    | 20-30ms  | 10-100
Scan (avoid!)                 | 100ms+   | All items ❌
```

### **Optimization Techniques**
```
1. Use Key Lookups (Fastest)
   ✅ Specify exact PK and SK
   ✅ Single-digit millisecond latency
   ✅ Most cost-efficient

2. Partition Queries (Fast)
   ✅ Query within one partition
   ✅ Use begins_with for prefix matching
   ✅ Efficient for related data

3. Batch Operations (Efficient)
   ✅ Get multiple items in one request
   ✅ Reduce network round trips
   ✅ Up to 100 items per batch

4. Avoid Scans (Slow!)
   ❌ Reads entire table
   ❌ Expensive and slow
   ❌ Use GSI instead
```

### **Bad vs Good Queries**
```javascript
// ❌ BAD: Table Scan (slow, expensive)
{
  TableName: "organizations",
  FilterExpression: "email = :email",
  ExpressionAttributeValues: {
    ":email": "bob@startup.com"
  }
}
// Problem: Scans ENTIRE table, then filters
// Latency: 100ms+
// Cost: Expensive (reads all items)


// ✅ GOOD: GSI Query (fast, cheap)
{
  TableName: "organizations",
  IndexName: "GSI1",
  KeyConditionExpression: "GSI1PK = :email",
  ExpressionAttributeValues: {
    ":email": "EMAIL#bob@startup.com"
  }
}
// Solution: Direct lookup via index
// Latency: 10-15ms
// Cost: Minimal (reads only matching items)
```

---

## 📊 **Scaling Strategy**

### **Automatic Scaling**
```
DynamoDB On-Demand Capacity:
✅ Automatically scales up/down
✅ No capacity planning needed
✅ Handles sudden traffic spikes
✅ Pay only for actual requests

Scaling Limits:
- Reads: Unlimited
- Writes: Unlimited
- Storage: Unlimited (petabytes)
- Partitions: Auto-created by AWS
```

### **Growth Path**
```
STAGE 1: Startup (100 users)
──────────────────────────────────────────────────────────
Data Size: 10 MB
Requests: 10K/day
Partitions: 1-2
Cost: $0 (free tier)


STAGE 2: Growth (1,000 users)
──────────────────────────────────────────────────────────
Data Size: 1 GB
Requests: 100K/day
Partitions: 5-10
Cost: $0 (free tier)


STAGE 3: Scale (10,000 users)
──────────────────────────────────────────────────────────
Data Size: 25 GB
Requests: 1M/day
Partitions: 50-100
Cost: $0 (exactly at free tier limit!)


STAGE 4: Enterprise (100,000 users)
──────────────────────────────────────────────────────────
Data Size: 250 GB
Requests: 10M/day
Partitions: 500-1000
Cost: ~$200/month
  • Storage: (250GB - 25GB) × $0.25 = $56.25
  • Reads: Varies by workload
  • Writes: Varies by workload

But revenue: 100K users × $10/month = $1M/month
Margin: 99.98% 🚀
```

---

## 💾 **Backup & Recovery**

### **Backup Strategy**
```
Point-in-Time Recovery (PITR):
✅ Enabled by default
✅ 35-day retention
✅ Restore to any second
✅ No performance impact
✅ Cost: $0.20/GB/month

On-Demand Backups:
✅ Manual snapshots
✅ Retained until deleted
✅ Full table backup
✅ Cost: $0.10/GB/month

AWS Backup Integration:
✅ Automated backup schedules
✅ Cross-region replication
✅ Compliance-ready
```

### **Disaster Recovery**
```
Recovery Time Objective (RTO): < 1 hour
Recovery Point Objective (RPO): < 1 minute

Disaster Scenarios:
1. Accidental deletion → PITR restore (< 1 hour)
2. Region failure → Global tables failover (< 5 minutes)
3. Data corruption → On-demand backup restore (< 2 hours)
```

---

## 📚 **Summary**
```
✅ Single-table design (all entities in one table)
✅ Multi-tenant via partition keys (org-scoped)
✅ TTL for automatic cache cleanup (24h expiration)
✅ GSI for alternative access patterns (email lookup)
✅ On-demand capacity (auto-scaling)
✅ Point-in-time recovery (35-day retention)
✅ 5-10ms latency (key lookups)
✅ $0/month cost (typical usage in free tier)
✅ Unlimited scalability (petabytes of data)
✅ Zero database management (fully serverless)
```

---

## 🔗 **Related Documentation**

- [Architecture Overview](./ARCHITECTURE.md) - System design
- [API Documentation](./API_DOCUMENTATION.md) - All endpoints
- [Architecture Diagrams](./ARCHITECTURE_DIAGRAMS.md) - Visual flows
- [User Journeys](./USER_JOURNEY_SINGLE.md) - User flows

---

**Database design optimized for multi-tenancy, performance, and cost efficiency.**

---

**Built with ❤️ for scalable SaaS applications**
```
