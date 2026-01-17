// handlers/ai.js - CORRECTED VERSION
// Properly calls GitHub API with owner and repo parameters

const AIService = require("../services/aiService");
const CognitoService = require("../services/cognitoService");
const UserService = require("../services/userService");
const GitHubServices = require("../services/githubService"); // ⭐ Import GitHub Service

const aiService = new AIService();
const cognitoService = new CognitoService();
const userService = new UserService();
const githubService = new GitHubServices(); // ⭐ Create instance

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
// HELPER: Get real GitHub data for user
// ============================================

async function getRealGitHubData(username) {
  try {
    console.log(`📥 Fetching REAL GitHub data for ${username}`);

    // STEP 1: Get all repositories for user
    const repos = await githubService.getUserRepositories(username, {
      limit: 10, // Get top 10 repos
    });

    if (!repos || repos.length === 0) {
      console.log(`⚠️ No repositories found for ${username}`);
      return null;
    }

    console.log(`✅ Found ${repos.length} repositories`);

    // STEP 2: Aggregate data from all repositories
    let allCommits = [];
    let allPullRequests = [];
    let allIssues = [];

    // STEP 3: Loop through each repository
    for (const repo of repos) {
      // Extract owner and repo name from full_name
      // Example: "sangamesh/devinsights-api" → owner: "sangamesh", repo: "devinsights-api"
      const [owner, repoName] = repo.full_name.split("/");

      console.log(`📥 Processing ${owner}/${repoName}...`);

      try {
        // Get commits from THIS specific repository
        const commits = await githubService.getRepositoryCommits(
          owner,
          repoName,
          { limit: 50 } // Get last 50 commits
        );
        allCommits = allCommits.concat(commits);
        console.log(`   ✅ ${commits.length} commits`);

        // Get pull requests from THIS specific repository
        const pullRequests = await githubService.getRepositoryPullRequests(
          owner,
          repoName,
          { limit: 50 }
        );
        allPullRequests = allPullRequests.concat(pullRequests);
        console.log(`   ✅ ${pullRequests.length} pull requests`);

        // Get issues from THIS specific repository
        const issues = await githubService.getRepositoryIssues(
          owner,
          repoName,
          { limit: 50 }
        );
        allIssues = allIssues.concat(issues);
        console.log(`   ✅ ${issues.length} issues`);
      } catch (error) {
        console.warn(
          `⚠️ Error fetching from ${owner}/${repoName}: ${error.message}`
        );
        // Continue with next repository
        continue;
      }
    }

    console.log(`✅ Data aggregated successfully`);

    // STEP 4: Organize and return aggregated data
    const realData = {
      username: username,
      totalRepositories: repos.length,
      repositories: repos.map((r) => r.name),

      // Commit statistics
      totalCommits: allCommits.length,
      commits: allCommits.slice(0, 20), // Top 20 commits
      averageCommitsPerDay:
        allCommits.length > 0
          ? (allCommits.length / 30).toFixed(2)
          : 0,

      // Pull request statistics
      pullRequests: {
        total: allPullRequests.length,
        merged: allPullRequests.filter((p) => p.merged_at).length,
        pending: allPullRequests.filter((p) => !p.merged_at).length,
        averageMergeTime:
          allPullRequests.length > 0
            ? calculateAverageMergeTime(allPullRequests)
            : "Unknown",
        list: allPullRequests.slice(0, 10), // Top 10 PRs
      },

      // Issue statistics
      issues: {
        total: allIssues.length,
        closed: allIssues.filter((i) => i.state === "closed").length,
        open: allIssues.filter((i) => i.state === "open").length,
        list: allIssues.slice(0, 10), // Top 10 issues
      },
    };

    return realData;
  } catch (error) {
    console.error("❌ Error fetching GitHub data:", error.message);
    return null;
  }
}

// ============================================
// HELPER: Calculate average merge time
// ============================================

function calculateAverageMergeTime(pullRequests) {
  const mergedPRs = pullRequests.filter((p) => p.merged_at);
  if (mergedPRs.length === 0) return "Unknown";

  const times = mergedPRs.map((p) => {
    const created = new Date(p.created_at);
    const merged = new Date(p.merged_at);
    const hours = (merged - created) / (1000 * 60 * 60);
    return hours;
  });

  const average = times.reduce((a, b) => a + b, 0) / times.length;
  return `${Math.round(average)} hours`;
}

// ============================================
// GET /ai/code-quality/{username}
// Analyzes code quality using REAL GitHub data
// ============================================

module.exports.analyzeCodeQuality = async (event) => {
  try {
    console.log("📊 Code quality analysis request");

    const username = event.pathParameters?.username;
    const token = (
      event.headers.authorization || event.headers.Authorization
    )?.replace("Bearer ", "");

    if (!username || !token) {
      return createResponse(400, {
        success: false,
        error: "Username and token required",
      });
    }

    // Verify user
    const user = await cognitoService.verifyToken(token);
    if (!user) {
      return createResponse(401, {
        success: false,
        error: "Invalid token",
      });
    }

    console.log(`🧠 Analyzing code quality for ${username}`);

    // ⭐ GET REAL DATA from GitHub (with proper owner/repo parameters)
    const realData = await getRealGitHubData(username);

    // Use real data if available, otherwise skip
    if (!realData) {
      return createResponse(503, {
        success: false,
        error: "Could not fetch GitHub data. Check token and repository access.",
        dataSource: "FAILED",
      });
    }

    // Call AI service with REAL data
    const analysis = await aiService.analyzeCodeQuality(realData, username);

    return createResponse(200, {
      success: true,
      data: analysis,
      dataSource: "REAL GitHub API",
      metrics: {
        totalCommits: realData.totalCommits,
        totalRepositories: realData.totalRepositories,
        totalPRs: realData.pullRequests.total,
        totalIssues: realData.issues.total,
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// GET /ai/burnout-risk/{email}
// Analyzes burnout risk using REAL GitHub data
// ============================================

module.exports.detectBurnoutRisk = async (event) => {
  try {
    console.log("📊 Burnout risk analysis request");

    const email = event.pathParameters?.email;
    const token = (
      event.headers.authorization || event.headers.Authorization
    )?.replace("Bearer ", "");

    if (!email || !token) {
      return createResponse(400, {
        success: false,
        error: "Email and token required",
      });
    }

    // Verify user
    const user = await cognitoService.verifyToken(token);
    if (!user) {
      return createResponse(401, {
        success: false,
        error: "Invalid token",
      });
    }

    console.log(`🧠 Analyzing burnout risk for ${email}`);

    // Extract username from email or use user field
    const username = user.email.split("@")[0];

    // ⭐ GET REAL DATA from GitHub
    const realData = await getRealGitHubData(username);

    if (!realData) {
      return createResponse(503, {
        success: false,
        error: "Could not fetch GitHub data",
      });
    }

    // Analyze real work patterns
    const workPatterns = {
      commitsPerDay: parseFloat(realData.averageCommitsPerDay),
      totalCommits: realData.totalCommits,
      mergedPRs: realData.pullRequests.merged,
      pendingPRs: realData.pullRequests.pending,
      closedIssues: realData.issues.closed,
      openIssues: realData.issues.open,
      mergeTime: realData.pullRequests.averageMergeTime,
    };

    // Call AI service
    const analysis = await aiService.detectBurnoutRisk(workPatterns, email);

    return createResponse(200, {
      success: true,
      data: analysis,
      dataSource: "REAL GitHub API",
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// GET /ai/team-performance/{organizationId}
// Analyzes team performance using REAL GitHub data
// ============================================

module.exports.analyzeTeamPerformance = async (event) => {
  try {
    console.log("📊 Team performance analysis request");

    const organizationId = event.pathParameters?.organizationId;
    const token = (
      event.headers.authorization || event.headers.Authorization
    )?.replace("Bearer ", "");

    if (!organizationId || !token) {
      return createResponse(400, {
        success: false,
        error: "OrganizationId and token required",
      });
    }

    // Verify user
    const user = await cognitoService.verifyToken(token);
    if (!user || user.organizationId !== organizationId) {
      return createResponse(403, {
        success: false,
        error: "Unauthorized",
      });
    }

    console.log(`🧠 Analyzing team performance for ${organizationId}`);

    // Get team members
    const members = await userService.getUsersByOrganization(organizationId);

    console.log(`📊 Analyzing ${members.length} team members`);

    // ⭐ GET REAL DATA for each team member
    const teamDataPromises = members.map((member) => {
      const username = member.email.split("@")[0]; // Extract username from email
      return getRealGitHubData(username);
    });

    const allTeamData = await Promise.all(teamDataPromises);

    // Aggregate real team data
    const teamData = {
      memberCount: members.length,
      members: members
        .map((m, idx) => {
          const data = allTeamData[idx];
          return {
            email: m.email,
            role: m.role,
            realCommits: data?.totalCommits || 0,
            realPRs: data?.pullRequests.total || 0,
            realIssues: data?.issues.total || 0,
            realRepositories: data?.totalRepositories || 0,
          };
        })
        .sort((a, b) => b.realCommits - a.realCommits), // Sort by commits (descending)

      totalCommits: allTeamData.reduce((sum, d) => sum + (d?.totalCommits || 0), 0),
      totalPRs: allTeamData.reduce(
        (sum, d) => sum + (d?.pullRequests.total || 0),
        0
      ),
      totalIssues: allTeamData.reduce((sum, d) => sum + (d?.issues.total || 0), 0),
    };

    console.log(`✅ Real team data collected`);

    // Call AI service
    const analysis = await aiService.analyzeTeamPerformance(
      teamData,
      organizationId
    );

    return createResponse(200, {
      success: true,
      data: analysis,
      dataSource: "REAL GitHub API",
      teamMetrics: {
        totalMembers: teamData.memberCount,
        totalCommits: teamData.totalCommits,
        totalPRs: teamData.totalPRs,
        totalIssues: teamData.totalIssues,
        topContributor: teamData.members[0]?.email || "Unknown",
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// GET /ai/dashboard/{organizationId}
// ============================================

module.exports.getDashboard = async (event) => {
  try {
    console.log("📊 Dashboard generation request");

    const organizationId = event.pathParameters?.organizationId;
    const token = (
      event.headers.authorization || event.headers.Authorization
    )?.replace("Bearer ", "");

    if (!organizationId || !token) {
      return createResponse(400, {
        success: false,
        error: "OrganizationId and token required",
      });
    }

    // Verify user
    const user = await cognitoService.verifyToken(token);
    if (!user || user.organizationId !== organizationId) {
      return createResponse(403, {
        success: false,
        error: "Unauthorized",
      });
    }

    console.log(`📊 Building dashboard for ${organizationId}`);

    // Get team members
    const members = await userService.getUsersByOrganization(organizationId);

    // Extract username from current user email
    const currentUsername = user.email.split("@")[0];

    // ⭐ Analyze current user with REAL data
    const userRealData = await getRealGitHubData(currentUsername);

    if (!userRealData) {
      return createResponse(503, {
        success: false,
        error: "Could not fetch GitHub data for current user",
      });
    }

    const userAnalysis = await aiService.analyzeCodeQuality(
      userRealData,
      currentUsername
    );

    const burnoutAnalysis = await aiService.detectBurnoutRisk(
      userRealData,
      user.email
    );

    // ⭐ Analyze team with REAL data
    const teamDataPromises = members.map((m) => {
      const username = m.email.split("@")[0];
      return getRealGitHubData(username);
    });

    const allTeamData = await Promise.all(teamDataPromises);

    const teamData = {
      memberCount: members.length,
      members: allTeamData.filter((d) => d !== null),
      totalCommits: allTeamData.reduce((sum, d) => sum + (d?.totalCommits || 0), 0),
    };

    const teamAnalysis = await aiService.analyzeTeamPerformance(
      teamData,
      organizationId
    );

    console.log("✅ Dashboard ready");

    return createResponse(200, {
      success: true,
      data: {
        organizationId,
        userEmail: user.email,
        dashboard: {
          codeQuality: userAnalysis.codeQuality,
          burnoutRisk: burnoutAnalysis.burnoutRisk,
          teamPerformance: teamAnalysis.teamPerformance,
          teamSize: members.length,
          generatedAt: new Date().toISOString(),
        },
        dataSource: "REAL GitHub API",
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// POST /ai/generate-report/{organizationId}
// ============================================

module.exports.generateReport = async (event) => {
  try {
    console.log("📋 Report generation request");

    const organizationId = event.pathParameters?.organizationId;
    const token = (
      event.headers.authorization || event.headers.Authorization
    )?.replace("Bearer ", "");

    if (!organizationId || !token) {
      return createResponse(400, {
        success: false,
        error: "OrganizationId and token required",
      });
    }

    // Verify user is admin
    const user = await cognitoService.verifyToken(token);
    if (
      !user ||
      user.organizationId !== organizationId ||
      user.role !== "admin"
    ) {
      return createResponse(403, {
        success: false,
        error: "Admin only",
      });
    }

    console.log(`📋 Generating report for ${organizationId}`);

    // Get team
    const members = await userService.getUsersByOrganization(organizationId);

    // ⭐ Generate analyses with REAL data
    const teamDataPromises = members.map((m) => {
      const username = m.email.split("@")[0];
      return getRealGitHubData(username);
    });

    const allTeamData = await Promise.all(teamDataPromises);

    const codeAnalysis = await aiService.analyzeCodeQuality(
      { members: allTeamData.filter((d) => d !== null) },
      "Team"
    );

    const teamAnalysis = await aiService.analyzeTeamPerformance(
      {
        memberCount: members.length,
        members: allTeamData.filter((d) => d !== null),
      },
      organizationId
    );

    console.log("✅ Report generated");

    return createResponse(200, {
      success: true,
      data: {
        organizationId,
        reportType: "Comprehensive AI Analysis",
        teamSize: members.length,
        analysis: {
          codeQuality: codeAnalysis.codeQuality,
          teamPerformance: teamAnalysis.teamPerformance,
        },
        dataSource: "REAL GitHub API",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return createResponse(500, {
      success: false,
      error: error.message,
    });
  }
};