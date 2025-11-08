class AnalyticsService {
  constructor() {
    // DSA: Initialize data structures for processing
    this.commitCache = new Map(); // O(1) lookups
    this.authorStats = new Map(); // Author performance tracking
  }

  // ========================================
  // METHOD 1: Commit Trends Analysis
  // ========================================
  // DSA Application: Sliding window for time-based analysis
  analyzeCommitTrends(commits) {
    if (!commits || commits.length === 0) {
      return [];
    }

    // Group commits by date using Map (Hash Table)
    const commitsByDate = new Map();
    
    commits.forEach(commit => {
      const date = commit.author.date.split('T')[0]; // Extract date only
      if (!commitsByDate.has(date)) {
        commitsByDate.set(date, []);
      }
      commitsByDate.get(date).push(commit);
    });

    // Convert to sorted array for time series
    const timeSeriesData = Array.from(commitsByDate.entries())
      .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
      .map(([date, commits]) => ({
        date,
        count: commits.length,
        authors: [...new Set(commits.map(c => c.author.name))].length
      }));

    return timeSeriesData;
  }

  // ========================================
  // METHOD 2: Author Productivity Analysis
  // ========================================
  // DSA Application: Frequency counting with Map
  analyzeAuthorProductivity(commits) {
    if (!commits || commits.length === 0) {
      return [];
    }

    const authorStats = new Map();

    commits.forEach(commit => {
      const author = commit.author.name;
      
      if (!authorStats.has(author)) {
        authorStats.set(author, {
          name: author,
          email: commit.author.email,
          commits: 0,
          first_commit: commit.author.date,
          last_commit: commit.author.date,
          active_days: new Set()
        });
      }

      const stats = authorStats.get(author);
      stats.commits++;
      
      // Track active days
      stats.active_days.add(commit.author.date.split('T')[0]);
      
      // Update date range
      if (new Date(commit.author.date) > new Date(stats.last_commit)) {
        stats.last_commit = commit.author.date;
      }
      if (new Date(commit.author.date) < new Date(stats.first_commit)) {
        stats.first_commit = commit.author.date;
      }
    });

    // Convert to array and sort by commits (DSA: Sorting)
    return Array.from(authorStats.values())
      .map(stats => ({
        ...stats,
        active_days: stats.active_days.size // Convert Set to number
      }))
      .sort((a, b) => b.commits - a.commits); // Descending order
  }

  // ========================================
  // METHOD 3: Repository Metrics (THIS IS THE MISSING ONE!)
  // ========================================
  // DSA Application: Statistical calculations
  calculateRepositoryMetrics(repositories, allCommits) {
    if (!repositories || repositories.length === 0) {
      return {
        total_repositories: 0,
        total_commits: 0,
        unique_contributors: 0,
        commits_per_day: 0,
        most_active_repo: 'N/A',
        activity_score: 0
      };
    }

    const totalCommits = allCommits?.length || 0;
    const uniqueAuthors = allCommits && allCommits.length > 0 
      ? new Set(allCommits.map(c => c.author.email)).size 
      : 0;
    
    // Calculate commit frequency (commits per day)
    const daySpan = this.calculateDateSpan(allCommits);
    const commitsPerDay = daySpan > 0 ? (totalCommits / daySpan).toFixed(2) : 0;

    return {
      total_repositories: repositories.length,
      total_commits: totalCommits,
      unique_contributors: uniqueAuthors,
      commits_per_day: parseFloat(commitsPerDay),
      most_active_repo: this.findMostActiveRepository(repositories, allCommits),
      activity_score: this.calculateActivityScore(totalCommits, uniqueAuthors, daySpan)
    };
  }

  // ========================================
  // METHOD 4: Date Span Calculation
  // ========================================
  // Helper: Calculate days between first and last commit
  calculateDateSpan(commits) {
    if (!commits || commits.length === 0) return 0;
    
    try {
      const dates = commits.map(c => new Date(c.author.date));
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      
      const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
      return daysDiff || 1; // Return at least 1 day
    } catch (error) {
      console.error('Error calculating date span:', error);
      return 1;
    }
  }

  // ========================================
  // METHOD 5: Most Active Repository
  // ========================================
  findMostActiveRepository(repositories, commits) {
    if (!commits || commits.length === 0) {
      // Fallback: return most recently updated repo
      if (repositories && repositories.length > 0) {
        const sorted = [...repositories].sort((a, b) => 
          new Date(b.updated_at) - new Date(a.updated_at)
        );
        return sorted[0]?.name || 'Unknown';
      }
      return 'Unknown';
    }

    // Count commits per repository
    const repoCommitCount = commits.reduce((acc, commit) => {
      const repoName = commit.repository || 'Unknown';
      acc[repoName] = (acc[repoName] || 0) + 1;
      return acc;
    }, {});

    // Find repo with most commits
    const mostActive = Object.entries(repoCommitCount)
      .sort(([, a], [, b]) => b - a)[0];

    return mostActive ? mostActive[0] : 'Unknown';
  }

  // ========================================
  // METHOD 6: Activity Score Calculation
  // ========================================
  calculateActivityScore(commits, authors, days) {
    if (commits === 0) return 0;

    // Simple scoring algorithm (0-10 scale)
    const commitScore = Math.min(commits / 10, 10); // Max 10 points for commits
    const authorScore = Math.min(authors * 2, 10);  // Max 10 points for team size
    const consistencyScore = days > 0 ? Math.min((commits / days) * 10, 10) : 0;
    
    const totalScore = (commitScore + authorScore + consistencyScore) / 3;
    return Math.round(totalScore * 10) / 10; // Round to 1 decimal
  }

  // ========================================
  // METHOD 7: Pull Request Analytics
  // ========================================
  analyzePullRequestMetrics(pullRequests) {
    if (!pullRequests || pullRequests.length === 0) {
      return {
        total: 0,
        merged: 0,
        open: 0,
        closed: 0,
        avg_time_to_merge_hours: 0,
        merge_rate: 0
      };
    }

    const merged = pullRequests.filter(pr => pr.merged_at);
    const open = pullRequests.filter(pr => pr.state === 'open');
    const closed = pullRequests.filter(pr => pr.state === 'closed');

    // Calculate average merge time
    const avgMergeTime = merged.length > 0
      ? merged.reduce((sum, pr) => sum + (pr.time_to_merge?.hours || 0), 0) / merged.length
      : 0;

    // Merge rate (percentage of PRs that get merged)
    const mergeRate = pullRequests.length > 0
      ? ((merged.length / pullRequests.length) * 100).toFixed(1)
      : 0;

    return {
      total: pullRequests.length,
      merged: merged.length,
      open: open.length,
      closed: closed.length,
      avg_time_to_merge_hours: Math.round(avgMergeTime),
      merge_rate: parseFloat(mergeRate)
    };
  }

  // ========================================
  // METHOD 8: Issue Analytics
  // ========================================
  analyzeIssueMetrics(issues) {
    if (!issues || issues.length === 0) {
      return {
        total: 0,
        open: 0,
        closed: 0,
        bugs: 0,
        features: 0,
        stale: 0,
        avg_resolution_hours: 0
      };
    }

    const open = issues.filter(i => i.state === 'open');
    const closed = issues.filter(i => i.state === 'closed');
    const bugs = issues.filter(i => i.is_bug);
    const features = issues.filter(i => i.is_feature);
    const stale = issues.filter(i => i.state === 'open' && i.age?.days > 30);

    // Calculate average resolution time
    const closedWithTime = closed.filter(i => i.time_to_close);
    const avgResolution = closedWithTime.length > 0
      ? closedWithTime.reduce((sum, i) => sum + (i.time_to_close?.hours || 0), 0) / closedWithTime.length
      : 0;

    return {
      total: issues.length,
      open: open.length,
      closed: closed.length,
      bugs: bugs.length,
      features: features.length,
      stale: stale.length,
      avg_resolution_hours: Math.round(avgResolution)
    };
  }

  // ========================================
  // METHOD 9: Overall Health Score
  // ========================================
  calculateOverallHealthScore(commits, pullRequests, issues) {
    let score = 50; // Start at middle

    // Commit activity (max 20 points)
    if (commits > 0) {
      score += Math.min(commits / 5, 20);
    }

    // PR merge rate (max 15 points)
    const merged = pullRequests.filter(pr => pr.merged_at).length;
    if (pullRequests.length > 0) {
      const mergeRate = merged / pullRequests.length;
      score += mergeRate * 15;
    }

    // Issue resolution (max 15 points)
    const closed = issues.filter(i => i.state === 'closed').length;
    if (issues.length > 0) {
      const resolutionRate = closed / issues.length;
      score += resolutionRate * 15;
    }

    return Math.min(Math.round(score), 100); // Cap at 100
  }
}

module.exports = AnalyticsService;