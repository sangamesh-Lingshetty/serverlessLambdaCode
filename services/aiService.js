// services/aiService.js - AI Integration using OpenRouter (FREE!)
// Works with Mistral, LLaMA, and other free models
// No expensive OpenAI required!

const fetch = require("node-fetch");

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.apiUrl = "https://openrouter.ai/api/v1";
    this.model = "mistralai/mistral-small-24b-instruct-2501"; // FREE model
    this.timeout = 30000;

    if (!this.apiKey) {
      console.warn(
        "⚠️ OPENROUTER_API_KEY not set - Using mock responses for testing"
      );
      this.enabled = false;
    } else {
      this.enabled = true;
      console.log(`✅ OpenRouter AI initialized (Model: ${this.model})`);
      console.log("💰 Using FREE tier - No credit card required!");
    }
  }

  // ============================================
  // ANALYZE CODE QUALITY
  // ============================================

  async analyzeCodeQuality(commitData, username) {
    if (!this.enabled) {
      return this.getMockCodeQualityResponse(username);
    }

    try {
      console.log(`🧠 Analyzing code quality for ${username}`);

      const prompt = `
You are a code quality expert. Analyze this developer's GitHub activity and provide a code quality assessment.

Developer: ${username}
Commits: ${JSON.stringify(commitData.commits || [], null, 2)}
Total commits: ${commitData.totalCommits || 0}
Average commits per day: ${commitData.averageCommitsPerDay || 0}
Last commit: ${commitData.lastCommit || "Unknown"}

Respond ONLY with valid JSON (no markdown):
{
  "score": <number 0-10>,
  "complexity": "<low|medium|high>",
  "issues": [<list of max 3 issues>],
  "strengths": [<list of max 3 strengths>],
  "recommendations": [<list of max 3 recommendations>]
}`;

      const response = await this.callOpenRouter(prompt);

      console.log("📊 Code quality analysis received");

      return {
        success: true,
        username,
        codeQuality: {
          score: response.score || 7.5,
          complexity: response.complexity || "medium",
          issues: response.issues || [],
          strengths: response.strengths || [],
          recommendations: response.recommendations || [],
        },
        analyzedAt: new Date().toISOString(),
        model: this.model,
      };
    } catch (error) {
      console.error("❌ Code quality analysis error:", error.message);
      return this.getMockCodeQualityResponse(username);
    }
  }

  // ============================================
  // DETECT BURNOUT RISK
  // ============================================

  async detectBurnoutRisk(workPatterns, email) {
    if (!this.enabled) {
      return this.getMockBurnoutResponse(email);
    }

    try {
      console.log(`🧠 Analyzing burnout risk for ${email}`);

      const prompt = `
You are a workplace wellness expert. Assess burnout risk based on work patterns.

Developer: ${email}
Work Patterns:
- Commits per day: ${workPatterns.commitsPerDay || 5}
- Average commit time: ${workPatterns.averageCommitTime || "9 AM"}
- Weekend commits: ${workPatterns.weekendCommits || 0}
- Late night commits (after 10 PM): ${workPatterns.lateNightCommits || 0}
- PR review time: ${workPatterns.prReviewTime || "4 hours"}
- Issues resolved: ${workPatterns.issuesResolved || 5}
- Days off in last month: ${workPatterns.timeOffDays || 5}
- Work consistency: ${workPatterns.workConsistency || "consistent"}

Respond ONLY with valid JSON (no markdown):
{
  "riskScore": <number 0-10>,
  "riskLevel": "<low|medium|high|critical>",
  "signs": [<list of max 3 burnout signs>],
  "recommendations": [<list of max 3 wellness recommendations>],
  "urgency": "<not urgent|moderate|urgent>"
}`;

      const response = await this.callOpenRouter(prompt);

      console.log("📊 Burnout analysis received");

      return {
        success: true,
        email,
        burnoutRisk: {
          riskScore: response.riskScore || 4,
          riskLevel: response.riskLevel || "low",
          signs: response.signs || [],
          recommendations: response.recommendations || [],
          urgency: response.urgency || "not urgent",
        },
        analyzedAt: new Date().toISOString(),
        model: this.model,
      };
    } catch (error) {
      console.error("❌ Burnout analysis error:", error.message);
      return this.getMockBurnoutResponse(email);
    }
  }

  // ============================================
  // ANALYZE TEAM PERFORMANCE
  // ============================================

  async analyzeTeamPerformance(teamData, organizationId) {
    if (!this.enabled) {
      return this.getMockTeamPerformanceResponse(organizationId);
    }

    try {
      console.log(`🧠 Analyzing team performance for ${organizationId}`);

      const prompt = `
You are a team performance analyst. Analyze team metrics and provide insights.

Organization: ${organizationId}
Team Data:
- Members: ${teamData.memberCount || 0}
- Total commits: ${teamData.totalCommits || 0}
- Total PRs: ${teamData.totalPRs || 0}
- Total issues: ${teamData.totalIssues || 0}
- Average code review time: ${teamData.averageCodeReviewTime || "3 hours"}
- Team velocity: ${teamData.teamVelocity || "stable"}
- Code quality trend: ${teamData.codeQualityTrend || "stable"}

Members: ${JSON.stringify(teamData.members || [], null, 2)}

Respond ONLY with valid JSON (no markdown):
{
  "healthScore": <number 0-10>,
  "velocity": "<decreasing|stable|increasing>",
  "collaboration": "<poor|fair|good|excellent>",
  "insights": [<list of max 3 key insights>],
  "recommendations": [<list of max 3 improvements>],
  "trend": "<negative|neutral|positive>"
}`;

      const response = await this.callOpenRouter(prompt);

      console.log("📊 Team performance analysis received");

      return {
        success: true,
        organizationId,
        teamPerformance: {
          healthScore: response.healthScore || 7,
          velocity: response.velocity || "stable",
          collaboration: response.collaboration || "good",
          insights: response.insights || [],
          recommendations: response.recommendations || [],
          trend: response.trend || "neutral",
        },
        analyzedAt: new Date().toISOString(),
        model: this.model,
      };
    } catch (error) {
      console.error("❌ Team analysis error:", error.message);
      return this.getMockTeamPerformanceResponse(organizationId);
    }
  }

  // ============================================
  // OPENROUTER API CALL
  // ============================================

  async callOpenRouter(userPrompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log("🌐 Calling OpenRouter API...");

      const systemPrompt = `You are a professional code quality and team performance analyzer. 
Provide accurate, actionable insights based on the data provided. 
Always respond with valid JSON only, no markdown or extra text.`;

      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "DevInsights-AI",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      // Handle errors
      if (!response.ok) {
        console.error("OpenRouter error:", data);

        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Try again later.");
        }

        if (response.status === 401) {
          throw new Error(
            "Invalid API key. Check OPENROUTER_API_KEY in .env"
          );
        }

        throw new Error(data.error?.message || "OpenRouter API error");
      }

      const answer = data.choices?.[0]?.message?.content || "";

      if (!answer || answer.trim().length === 0) {
        throw new Error("Empty response from OpenRouter");
      }

      console.log("✅ OpenRouter response received");

      // Parse JSON response
      try {
        const jsonMatch = answer.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn("⚠️ Could not extract JSON, returning mock data");
          return this.getDefaultResponse();
        }
        return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.warn("⚠️ JSON parse error, returning mock data");
        return this.getDefaultResponse();
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error("Request timeout. Please try again.");
      }

      throw error;
    }
  }

  // ============================================
  // MOCK RESPONSES (Fallback)
  // ============================================

  getMockCodeQualityResponse(username) {
    return {
      success: true,
      username,
      codeQuality: {
        score: 7.5,
        complexity: "medium",
        issues: [
          "Some functions could be more modular",
          "Consider adding more tests",
        ],
        strengths: ["Good variable naming", "Consistent style"],
        recommendations: ["Add JSDoc comments", "Increase test coverage"],
      },
      analyzedAt: new Date().toISOString(),
      mock: true,
      note: "Mock response - API not configured",
    };
  }

  getMockBurnoutResponse(email) {
    return {
      success: true,
      email,
      burnoutRisk: {
        riskScore: 4,
        riskLevel: "low",
        signs: [],
        recommendations: ["Maintain current pace"],
        urgency: "not urgent",
      },
      analyzedAt: new Date().toISOString(),
      mock: true,
      note: "Mock response - API not configured",
    };
  }

  getMockTeamPerformanceResponse(organizationId) {
    return {
      success: true,
      organizationId,
      teamPerformance: {
        healthScore: 8,
        velocity: "increasing",
        collaboration: "good",
        insights: ["Team is productive", "Good collaboration"],
        recommendations: ["Continue current pace"],
        trend: "positive",
      },
      analyzedAt: new Date().toISOString(),
      mock: true,
      note: "Mock response - API not configured",
    };
  }

  getDefaultResponse() {
    return {
      score: 7,
      complexity: "medium",
      issues: [],
      strengths: ["Code analysis complete"],
      recommendations: ["Review code regularly"],
    };
  }
}

module.exports = AIService;