const GitHubServices = require("../services/githubService");
const AnalyticServices = require("../services/analyticsService");
const MultiTierCache = require("../services/multiTierCache");


const githubService = new GitHubServices();
const analyticService = new AnalyticServices();
const cache = new MultiTierCache();

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
  },
  body: JSON.stringify(body),
});

module.exports.healthCheck = async (event) => {
  return createResponse(200, {
    message: "DevInsights API is running on AWS Lambda!",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    endpoints: [
      "GET /api/github/repos/:username",
      "GET /api/github/repos/:owner/:repo/commits",
      "GET /api/github/repos/:owner/:repo/pulls",
      "GET /api/github/repos/:owner/:repo/issues",
      "GET /api/github/analytics/:username",
      "GET /api/cache/stats",
      "DELETE /api/cache/:username",
    ],
  });
};

module.exports.getUserRepositories = async (event) => {
  try {
    const { username } = event.pathParameters;
    const { limit } = event.queryStringParameters || {};

    if (!username || username.length < 1) {
      return createResponse(400, {
        error: "Username is required and must be valid...",
      });
    }

    // try cache first
    const cacheKey = username;
    const cached = await cache.getAnalytics(username);

    if (cached) {
      return createResponse(200, {
        success: true,
        username,
        count: cached.data.length,
        data: cached.data,
        cached: true,
        cache_age_seconds: cached.cache_age_seconds,
        fetched_at: new Date(cached.cached_at).toISOString(),
      });
    }

    // cache miss - fetch fresh data
    const repositories = await githubService.getUserRepositories(username, {
      limit: parseInt(limit) || 10,
    });

    await cache.saveAnalytics(cacheKey, {
      data: repositories,
    });

    // Return response (SAME structure as Express)
    return createResponse(200, {
      success: true,
      username,
      count: repositories.length,
      data: repositories,
      cached: false,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.log("get User Repo controller error", error.message);
    return createResponse(500, {
      success: false,
      error: {
        type: error.type,
        message: error.message,
        details: error.details,
      },
    });
  }
};

module.exports.getRepositoriesCommits = async (event) => {
  try {
    const { owner, repo } = event.pathParameters;
    const { days, limit } = event.queryStringParameters || {};

    const commits = await githubService.getRepositoryCommits(owner, repo, {
      since: days ? githubService.getDateDaysAgo(parseInt(days)) : 0,
      limit: parseInt(limit) || 50,
    });

    const analytics = {
      total_commits: commits.length,
      unique_authors: [...new Set(commits.map((c) => c.author.email))].length,
      date_range: {
        from: commits[commits.length - 1]?.author.date,
        to: commits[0]?.author.date,
      },
      authors_frequency: commits.reduce((acc, commit) => {
        const author = commit.author.name;
        acc[author] = (acc[author] || 0) + 1;
        return acc;
      }, {}),
    };

    return createResponse(200, {
      success: true,
      repository: `${owner}/${repo}`,
      analytics,
      commits,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.log("Commits route error:", error.message);
    return createResponse(500, {
      success: false,
      error: {
        type: error.type,
        message: error.message,
        details: error.details,
      },
    });
  }
};

module.exports.getRepositoriesPullRequest = async (event) => {
  try {
    const { owner, repo } = event.pathParameters;
    const { state = "all", limit } = event.queryStringParameters || {};

    const pullRequests = await githubService.getRepositoryPullRequests(
      owner,
      repo,
      {
        state,
        limit: parseInt(limit) || 50,
      }
    );

    // Your EXISTING PR analytics (NO CHANGES!)
    const prAnalytics = {
      total: pullRequests.length,
      open: pullRequests.filter((pr) => pr.state === "open").length,
      closed: pullRequests.filter((pr) => pr.state === "closed").length,
      merged: pullRequests.filter((pr) => pr.merged_at).length,

      avg_time_to_merge:
        pullRequests
          .filter((pr) => pr.time_to_merge)
          .reduce((sum, pr) => sum + pr.time_to_merge.hours, 0) /
          pullRequests.filter((pr) => pr.time_to_merge).length || 0,

      top_contributors: Object.entries(
        pullRequests.reduce((acc, pr) => {
          acc[pr.author.login] = (acc[pr.author.login] || 0) + 1;
          return acc;
        }, {})
      )
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([author, count]) => ({ author, prs: count })),
    };

    return createResponse(200, {
      success: true,
      repository: `${owner}/${repo}`,
      analytics: prAnalytics,
      pull_requests: pullRequests,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.log("Pull Request route error", error.message);
    return createResponse(500, {
      success: false,
      error: {
        type: error.type,
        message: error.message,
        details: error.details,
      },
    });
  }
};

module.exports.getRepositoryIssues = async (event) => {
  try {
    const { owner, repo } = event.pathParameters;
    const { state = "all", limit, days } = event.queryStringParameters || {};

    const issues = await githubService.getRepositoryIssues(owner, repo, {
      state,
      limit: parseInt(limit) || 50,
    });

    // Your EXISTING issue analytics (NO CHANGES!)
    const issueAnalytics = {
      total: issues.length,
      open: issues.filter((i) => i.state === "open").length,
      closed: issues.filter((i) => i.state === "closed").length,

      bugs: {
        total: issues.filter((i) => i.is_bug).length,
        open: issues.filter((i) => i.is_bug && i.state === "open").length,
      },

      features: {
        total: issues.filter((i) => i.is_feature).length,
        open: issues.filter((i) => i.is_feature && i.state === "open").length,
      },

      avg_time_to_close_hours:
        issues
          .filter((i) => i.time_to_close)
          .reduce((sum, i) => sum + i.time_to_close.hours, 0) /
          issues.filter((i) => i.time_to_close).length || 0,

      by_priority: {
        high: issues.filter((i) => i.priority === "high").length,
        medium: issues.filter((i) => i.priority === "medium").length,
        low: issues.filter((i) => i.priority === "low").length,
      },

      stale_issues: issues.filter((i) => i.state === "open" && i.age.days > 30)
        .length,

      top_reporters: Object.entries(
        issues.reduce((acc, issue) => {
          acc[issue.author.login] = (acc[issue.author.login] || 0) + 1;
          return acc;
        }, {})
      )
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([author, count]) => ({ author, issues: count })),
    };

    return createResponse(200, {
      success: true,
      repository: `${owner}/${repo}`,
      analytics: issueAnalytics,
      issues,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.log("Issue route error", error.message);
    return createResponse(500, {
      success: false,
      error: {
        type: error.type,
        message: error.message,
        details: error.details,
      },
    });
  }
};

module.exports.getDashBoardAnalytics = async (event) => {
  try {
    const { username } = event.pathParameters;
    const {
      days = 30,
      repos_limit = 5,
      force_refresh,
    } = event.queryStringParameters || {};

    console.log(`Generating complete analytics for ${username}...`);

    if (!force_refresh) {
      const cachedData = await cache.getAnalytics(username);

      if (cachedData) {
        console.log(`✅ CACHE HIT for ${username}!`);

        return createResponse(200, {
          success: true,
          username,
          analytics: cachedData.analytics,
          raw_data: cachedData.raw_data,
          cached: true,
          cache_age_seconds: cachedData.cache_age_seconds,
          generated_at: new Date(cachedData.cached_at).toISOString(),
        });
      }
      console.log(`❌ CACHE MISS for ${username} - generating fresh data...`);
    } else {
      console.log(`🔄 Force refresh requested for ${username}`);
    }

    const startTime = Date.now();

    // cache miss - generae fresh data from Github API
    const repositories = await githubService.getUserRepositories(username, {
      limit: 10,
    });

    let allCommits = [];
    let allPullRequests = [];
    let allIssues = [];

    const reposToAnalyze = repositories.slice(0, parseInt(repos_limit));

    for (const repo of reposToAnalyze) {
      try {
        const commits = await githubService.getRepositoryCommits(
          username,
          repo.name,
          { since: githubService.getDateDaysAgo(parseInt(days)) }
        );
        commits.forEach((c) => (c.repository = repo.name));
        allCommits = allCommits.concat(commits);

        const prs = await githubService.getRepositoryPullRequests(
          username,
          repo.name,
          { state: "all", limit: 30 }
        );
        prs.forEach((pr) => (pr.repository = repo.name));
        allPullRequests = allPullRequests.concat(prs);

        const issues = await githubService.getRepositoryIssues(
          username,
          repo.name,
          { state: "all", limit: 30 }
        );
        issues.forEach((i) => (i.repository = repo.name));
        allIssues = allIssues.concat(issues);
      } catch (error) {
        console.warn(`⚠️ Skipping ${repo.name}: ${error.message}`);
      }
    }

    // Call your EXISTING analytics service methods
    const repoMetrics = analyticService.calculateRepositoryMetrics(
      repositories,
      allCommits
    );
    const commitTrends = analyticService.analyzeCommitTrends(allCommits);
    const authorProductivity =
      analyticService.analyzeAuthorProductivity(allCommits);
    const prMetrics =
      analyticService.analyzePullRequestMetrics(allPullRequests);
    const issueMetrics = analyticService.analyzeIssueMetrics(allIssues);

    // Your EXISTING analytics object (NO CHANGES!)
    const analytics = {
      overview: {
        total_repositories: repoMetrics.total_repositories,
        total_commits: repoMetrics.total_commits,
        unique_contributors: repoMetrics.unique_contributors,
        commits_per_day: repoMetrics.commits_per_day,
        activity_score: repoMetrics.activity_score,
        most_active_repo: repoMetrics.most_active_repo,
        total_pull_requests: prMetrics.total,
        merged_prs: prMetrics.merged,
        pr_merge_rate: prMetrics.merge_rate,
        total_issues: issueMetrics.total,
        open_issues: issueMetrics.open,
        bugs_reported: issueMetrics.bugs,
      },

      commit_trends: commitTrends,
      author_productivity: authorProductivity.slice(0, 10),

      pull_request_metrics: {
        total: prMetrics.total,
        merged: prMetrics.merged,
        open: prMetrics.open,
        closed: prMetrics.closed,
        avg_time_to_merge_hours: prMetrics.avg_time_to_merge_hours,
        merge_rate: prMetrics.merge_rate,
      },

      issue_metrics: {
        total: issueMetrics.total,
        open: issueMetrics.open,
        closed: issueMetrics.closed,
        bugs: issueMetrics.bugs,
        features: issueMetrics.features,
        stale: issueMetrics.stale,
        avg_resolution_hours: issueMetrics.avg_resolution_hours,
      },

      repository_breakdown: repositories.slice(0, 5).map((repo) => ({
        name: repo.name,
        language: repo.language,
        stars: repo.stars,
        commits: allCommits.filter((c) => c.repository === repo.name).length,
        last_updated: repo.updated_at,
      })),

      time_period: {
        days: parseInt(days),
        from: githubService.getDateDaysAgo(parseInt(days)),
        to: new Date().toISOString(),
      },
    };

    const genarationTime = Math.floor(Date.now() - startTime / 1000);
    console.log(`✅ Analytics generated in ${genarationTime}s`);

    // ofter fresh data save in the cache
    const dataToaCache = {
      analytics: analytics,
      raw_data: {
        repositories: repositories.length,
        commits: allCommits.length,
        pull_requests: allPullRequests.length,
        issues: allIssues.length,
        analyzed_repos: reposToAnalyze.length,
      },
    };
    // Save to cache (don't wait - async)
    cache.saveAnalytics(username, dataToaCache).catch((err) => {
      console.error("Failed to cache analytics:", err.message);
    });

    return createResponse(200, {
      success: true,
      username,
      analytics,
      cached: false,
      raw_data: {
        repositories: repositories.length,
        commits: allCommits.length,
        pull_requests: allPullRequests.length,
        issues: allIssues.length,
        analyzed_repos: reposToAnalyze.length,
      },
      generation_time_seconds: genarationTime,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.log("Analytics error:", error.message);
    return createResponse(500, {
      success: false,
      error: {
        type: error.type || "ANALYTICS_ERROR",
        message: error.message,
        details: error.details,
      },
    });
  }

};

// get cache statics

module.exports.getCacheStats = async(event) =>{
  try{
    const stats = await cache.getStats();

    return createResponse(200,{
      sucess:true,
      cache_stats:stats,
      timestamp:new Date().toISOString()
    });

  }catch(error){
    return createResponse(500,{
      success:false,
      error:error.message
    })
  }
}

module.exports.clearUserCache= async(event)=>{
  try{
    const { username } = event.pathParameters;
    
    const cleared = await cache.clearAnalytics(username);
    
    return createResponse(200, {
      success: true,
      message: `Cache cleared for ${username}`,
      username
    })

  }catch(error){
    return createResponse(500, {
      success: false,
      error: error.message
    });
  }
}