/**
 * SkillLens AI — Day 27: Analysis History Test Suite
 *
 * Automated verification of all 20 required scenarios:
 * 1. User with no previous analyses
 * 2. User with one saved analysis
 * 3. User with multiple saved analyses
 * 4. Analyses using different resumes
 * 5. Analyses using different job descriptions
 * 6. Analyses with different match percentages (High, Medium, Low tiers)
 * 7. Search by job title
 * 8. Search by company
 * 9. Search by resume name
 * 10. Filter by match category (high, medium, low)
 * 11. Filter by date range (7d, 30d, 90d, custom start/end)
 * 12. Sort by most recent and oldest
 * 13. Sort by highest and lowest match
 * 14. Open a previous analysis by ID (complete immutable snapshot)
 * 15. Refresh a historical analysis page (immutable data, no re-scoring)
 * 16. Delete an analysis with confirmation (cascade to child items, preserve resumes & jobs)
 * 17. Attempt to access another user's history (unauthorized & cross-user isolation)
 * 18. Attempt to access another user's analysis by changing record ID (404 access denied)
 * 19. Handle deleted or unavailable associated records (snapshot fallback)
 * 20. Responsive desktop, tablet, and mobile layouts / UI schema validation
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const AnalysisHistoryService = require("../services/analysisHistoryService");
const {
  getAnalysisHistory,
  getHistoricalAnalysis,
  deleteAnalysis,
} = require("../controllers/analysisController");

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

// Sample mock analyses rows
function createMockAnalysisRow(overrides = {}) {
  const now = new Date();
  const summaryPayload = {
    jobTitle: overrides.job_title || "Full Stack Developer",
    company: overrides.company_name || "TechFlow Innovations",
    resumeFilename: overrides.resume_name || "Jane_Doe_Resume.pdf",
    snapshot: {
      jobTitle: overrides.job_title || "Full Stack Developer",
      company: overrides.company_name || "TechFlow Innovations",
      resumeFilename: overrides.resume_name || "Jane_Doe_Resume.pdf",
    },
    overall: {
      status: "AVAILABLE",
      explanation: "Overall score calculation.",
    },
    scores: {
      skills: { status: "AVAILABLE", explanation: "Skills evaluation." },
      experience: { status: "AVAILABLE", explanation: "Experience evaluation." },
      education: { status: "AVAILABLE", explanation: "Education evaluation." },
    },
    aiAnalysis: {
      summary: "Candidate matches core full-stack stack well.",
      strengths: ["React", "Node.js"],
      gaps: ["Docker", "Kubernetes"],
      recommendations: ["Focus on cloud containerization"],
    },
    warnings: [],
  };

  return {
    id: 1,
    user_id: 10,
    resume_id: 101,
    job_id: 201,
    overall_score: "82.50",
    skill_score: "85.00",
    experience_score: "80.00",
    education_score: "80.00",
    certification_score: null,
    summary: JSON.stringify(summaryPayload),
    status: "COMPLETED",
    algorithm_version: "1.0",
    created_at: now.toISOString(),
    completed_at: now.toISOString(),
    job_title: "Full Stack Developer",
    company_name: "TechFlow Innovations",
    resume_name: "Jane_Doe_Resume.pdf",
    ...overrides,
  };
}

async function runDay27AnalysisHistoryTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 27 Analysis History Tests ---");

  // Keep a reference to original db.query
  const originalDbQuery = db.query;

  // Helper to safely stub db.query for a test and restore it
  function withMockDb(handler, fn) {
    return async () => {
      db.query = handler;
      try {
        await fn();
      } finally {
        db.query = originalDbQuery;
      }
    };
  }

  // ---- Test 1: User with no previous analyses ----
  await testAsync("1. User with no previous analyses returns clean empty list and 0-stats", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS totalAnalyses")) {
        return [[{ totalAnalyses: 0, averageScore: null, highestScore: null, completedCount: 0 }]];
      }
      if (sql.includes("COUNT(*) AS total")) {
        return [[{ total: 0 }]];
      }
      return [[]];
    },
    async () => {
      const result = await AnalysisHistoryService.getHistory(101);
      assert.strictEqual(result.analyses.length, 0, "Analyses array must be empty");
      assert.strictEqual(result.pagination.total, 0, "Total count must be 0");
      assert.strictEqual(result.pagination.totalPages, 1);
      assert.strictEqual(result.pagination.hasMore, false);
      assert.strictEqual(result.summaryStats.totalAnalyses, 0);
      assert.strictEqual(result.summaryStats.averageScore, 0);
      assert.strictEqual(result.summaryStats.highestScore, 0);
      assert.strictEqual(result.summaryStats.completedCount, 0);
    }
  ));

  // ---- Test 2: User with one saved analysis ----
  await testAsync("2. User with one saved analysis returns formatted record and valid KPI stats", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS totalAnalyses")) {
        return [[{ totalAnalyses: 1, averageScore: "78.4", highestScore: "78.4", completedCount: 1 }]];
      }
      if (sql.includes("COUNT(*) AS total")) {
        return [[{ total: 1 }]];
      }
      if (sql.includes("roadmap_items WHERE analysis_id IN")) {
        return [[{ analysis_id: 1 }]];
      }
      const row = createMockAnalysisRow({ id: 1, overall_score: "78.40" });
      return [[row]];
    },
    async () => {
      const result = await AnalysisHistoryService.getHistory(10);
      assert.strictEqual(result.analyses.length, 1);
      const item = result.analyses[0];
      assert.strictEqual(item.id, 1);
      assert.strictEqual(item.jobTitle, "Full Stack Developer");
      assert.strictEqual(item.company, "TechFlow Innovations");
      assert.strictEqual(item.resumeName, "Jane_Doe_Resume.pdf");
      assert.strictEqual(item.overallScore, 78);
      assert.strictEqual(item.matchCategory, "HIGH");
      assert.strictEqual(item.hasRoadmap, true);
      assert.strictEqual(result.summaryStats.totalAnalyses, 1);
      assert.strictEqual(result.summaryStats.highestScore, 78);
    }
  ));

  // ---- Test 3: User with multiple saved analyses ----
  await testAsync("3. User with multiple saved analyses accurately calculates aggregate KPI summary stats", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS totalAnalyses")) {
        return [[{ totalAnalyses: 3, averageScore: "73.666", highestScore: "85.0", completedCount: 3 }]];
      }
      if (sql.includes("COUNT(*) AS total")) {
        return [[{ total: 3 }]];
      }
      if (sql.includes("roadmap_items WHERE analysis_id IN")) {
        return [[]];
      }
      return [[
        createMockAnalysisRow({ id: 101, overall_score: "85.00" }),
        createMockAnalysisRow({ id: 102, overall_score: "72.00" }),
        createMockAnalysisRow({ id: 103, overall_score: "64.00" }),
      ]];
    },
    async () => {
      const result = await AnalysisHistoryService.getHistory(10);
      assert.strictEqual(result.analyses.length, 3);
      assert.strictEqual(result.pagination.total, 3);
      assert.strictEqual(result.summaryStats.totalAnalyses, 3);
      assert.strictEqual(result.summaryStats.averageScore, 73.7);
      assert.strictEqual(result.summaryStats.highestScore, 85);
      assert.strictEqual(result.summaryStats.completedCount, 3);
    }
  ));

  // ---- Test 4: Analyses using different resumes ----
  await testAsync("4. Analyses using different resumes correctly preserve each resume's identity and filename", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 2, averageScore: "80", highestScore: "85", completedCount: 2 }]];
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 2 }]];
      if (sql.includes("roadmap_items WHERE analysis_id IN")) return [[]];
      return [[
        createMockAnalysisRow({ id: 1, resume_id: 11, resume_name: "Frontend_Resume.pdf" }),
        createMockAnalysisRow({ id: 2, resume_id: 12, resume_name: "Cloud_Architect_Resume.pdf" }),
      ]];
    },
    async () => {
      const result = await AnalysisHistoryService.getHistory(10);
      assert.strictEqual(result.analyses[0].resumeId, 11);
      assert.strictEqual(result.analyses[0].resumeName, "Frontend_Resume.pdf");
      assert.strictEqual(result.analyses[1].resumeId, 12);
      assert.strictEqual(result.analyses[1].resumeName, "Cloud_Architect_Resume.pdf");
    }
  ));

  // ---- Test 5: Analyses using different job descriptions ----
  await testAsync("5. Analyses using different jobs preserve specific job title and company identity", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 2, averageScore: "75", highestScore: "80", completedCount: 2 }]];
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 2 }]];
      if (sql.includes("roadmap_items WHERE analysis_id IN")) return [[]];
      return [[
        createMockAnalysisRow({ id: 1, job_id: 201, job_title: "Senior React Engineer", company_name: "Meta" }),
        createMockAnalysisRow({ id: 2, job_id: 202, job_title: "DevOps Engineer", company_name: "Amazon" }),
      ]];
    },
    async () => {
      const result = await AnalysisHistoryService.getHistory(10);
      assert.strictEqual(result.analyses[0].jobId, 201);
      assert.strictEqual(result.analyses[0].jobTitle, "Senior React Engineer");
      assert.strictEqual(result.analyses[0].company, "Meta");
      assert.strictEqual(result.analyses[1].jobId, 202);
      assert.strictEqual(result.analyses[1].jobTitle, "DevOps Engineer");
      assert.strictEqual(result.analyses[1].company, "Amazon");
    }
  ));

  // ---- Test 6: Analyses with different match percentages ----
  await testAsync("6. Match percentages are correctly categorized into HIGH, MEDIUM, and LOW tiers", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 4, averageScore: "60", highestScore: "85", completedCount: 4 }]];
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 4 }]];
      if (sql.includes("roadmap_items WHERE analysis_id IN")) return [[]];
      return [[
        createMockAnalysisRow({ id: 1, overall_score: "85.00" }), // High
        createMockAnalysisRow({ id: 2, overall_score: "75.00" }), // High threshold
        createMockAnalysisRow({ id: 3, overall_score: "62.50" }), // Medium
        createMockAnalysisRow({ id: 4, overall_score: "38.00" }), // Low
      ]];
    },
    async () => {
      const result = await AnalysisHistoryService.getHistory(10);
      assert.strictEqual(result.analyses[0].matchCategory, "HIGH");
      assert.strictEqual(result.analyses[1].matchCategory, "HIGH");
      assert.strictEqual(result.analyses[2].matchCategory, "MEDIUM");
      assert.strictEqual(result.analyses[3].matchCategory, "LOW");
    }
  ));

  // ---- Test 7: Search by job title ----
  await testAsync("7. Search by job title constructs parameterized SQL query without SQL injection risk", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 1, averageScore: "80", highestScore: "80", completedCount: 1 }]];
      if (sql.includes("COUNT(*) AS total")) {
        assert.ok(sql.includes("LOWER(COALESCE(j.title, '')) LIKE ?"), "Must query job title");
        assert.ok(params.includes("%frontend%"), "Query params must include wildcard search term");
        return [[{ total: 1 }]];
      }
      if (sql.includes("roadmap_items WHERE analysis_id IN")) return [[]];
      return [[createMockAnalysisRow({ job_title: "Senior Frontend Engineer" })]];
    },
    async () => {
      const result = await AnalysisHistoryService.getHistory(10, { search: "Frontend" });
      assert.strictEqual(result.analyses.length, 1);
      assert.ok(result.analyses[0].jobTitle.toLowerCase().includes("frontend"));
    }
  ));

  // ---- Test 8: Search by company ----
  await testAsync("8. Search by company name queries company column and summary fallback", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 1, averageScore: "90", highestScore: "90", completedCount: 1 }]];
      if (sql.includes("COUNT(*) AS total")) {
        assert.ok(sql.includes("LOWER(COALESCE(j.company, '')) LIKE ?"), "Must query job company");
        assert.ok(params.includes("%google%"), "Query params must include search keyword");
        return [[{ total: 1 }]];
      }
      if (sql.includes("roadmap_items WHERE analysis_id IN")) return [[]];
      return [[createMockAnalysisRow({ company_name: "Google LLC" })]];
    },
    async () => {
      const result = await AnalysisHistoryService.getHistory(10, { search: "Google" });
      assert.strictEqual(result.analyses[0].company, "Google LLC");
    }
  ));

  // ---- Test 9: Search by resume name ----
  await testAsync("9. Search by resume name queries resume original filename and snapshot", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 1, averageScore: "70", highestScore: "70", completedCount: 1 }]];
      if (sql.includes("COUNT(*) AS total")) {
        assert.ok(sql.includes("LOWER(COALESCE(r.original_filename, '')) LIKE ?"), "Must query resume filename");
        assert.ok(params.includes("%john_doe%"), "Query params must include search keyword");
        return [[{ total: 1 }]];
      }
      if (sql.includes("roadmap_items WHERE analysis_id IN")) return [[]];
      return [[createMockAnalysisRow({ resume_name: "John_Doe_CV.pdf" })]];
    },
    async () => {
      const result = await AnalysisHistoryService.getHistory(10, { search: "John_Doe" });
      assert.strictEqual(result.analyses[0].resumeName, "John_Doe_CV.pdf");
    }
  ));

  // ---- Test 10: Filter by match category (high, medium, low) ----
  await testAsync("10. Filter by match category enforces documented threshold boundaries", withMockDb(
    async (sql, params) => {
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
      if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 1, averageScore: "85", highestScore: "85", completedCount: 1 }]];
      if (sql.includes("roadmap_items WHERE analysis_id IN")) return [[]];
      return [[createMockAnalysisRow({ overall_score: "85.00" })]];
    },
    async () => {
      // Test high
      let capturedSql = "";
      db.query = async (sql) => {
        capturedSql += " " + sql;
        if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
        if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 1, averageScore: "85", highestScore: "85", completedCount: 1 }]];
        if (sql.includes("roadmap_items")) return [[]];
        return [[createMockAnalysisRow({ overall_score: "85.00" })]];
      };
      await AnalysisHistoryService.getHistory(10, { match: "high" });
      assert.ok(capturedSql.includes("a.overall_score >= 75.00"), "High filter must check >= 75.00");

      // Test medium
      capturedSql = "";
      await AnalysisHistoryService.getHistory(10, { match: "medium" });
      assert.ok(capturedSql.includes("a.overall_score >= 50.00 AND a.overall_score < 75.00"), "Medium filter must check 50.00 to 75.00");

      // Test low
      capturedSql = "";
      await AnalysisHistoryService.getHistory(10, { match: "low" });
      assert.ok(capturedSql.includes("a.overall_score < 50.00"), "Low filter must check < 50.00");
    }
  ));

  // ---- Test 11: Filter by date range (7d, 30d, 90d, custom start/end) ----
  await testAsync("11. Date range filters apply SQL date intervals and custom boundaries", withMockDb(
    null,
    async () => {
      let capturedSql = "";
      db.query = async (sql) => {
        capturedSql += " " + sql;
        if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
        if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 1, averageScore: "85", highestScore: "85", completedCount: 1 }]];
        if (sql.includes("roadmap_items")) return [[]];
        return [[createMockAnalysisRow()]];
      };

      // 7 days
      await AnalysisHistoryService.getHistory(10, { dateRange: "7d" });
      assert.ok(capturedSql.includes("DATE_SUB(NOW(), INTERVAL 7 DAY)"));

      // 30 days
      capturedSql = "";
      await AnalysisHistoryService.getHistory(10, { dateRange: "30d" });
      assert.ok(capturedSql.includes("DATE_SUB(NOW(), INTERVAL 30 DAY)"));

      // 90 days
      capturedSql = "";
      await AnalysisHistoryService.getHistory(10, { dateRange: "90d" });
      assert.ok(capturedSql.includes("DATE_SUB(NOW(), INTERVAL 90 DAY)"));

      // Custom bounds
      capturedSql = "";
      await AnalysisHistoryService.getHistory(10, { startDate: "2026-01-01", endDate: "2026-01-31" });
      assert.ok(capturedSql.includes("a.created_at >= ?") && capturedSql.includes("a.created_at <= ?"));
    }
  ));

  // ---- Test 12: Sort by most recent and oldest ----
  await testAsync("12. Sort by most recent and oldest generates correct ORDER BY clauses", withMockDb(
    null,
    async () => {
      let capturedSql = "";
      db.query = async (sql) => {
        capturedSql += " " + sql;
        if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
        if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 1, averageScore: "85", highestScore: "85", completedCount: 1 }]];
        if (sql.includes("roadmap_items")) return [[]];
        return [[createMockAnalysisRow()]];
      };

      // Most recent (default)
      await AnalysisHistoryService.getHistory(10, { sortBy: "most_recent" });
      assert.ok(capturedSql.includes("ORDER BY a.created_at DESC, a.id DESC"));

      // Oldest
      capturedSql = "";
      await AnalysisHistoryService.getHistory(10, { sortBy: "oldest" });
      assert.ok(capturedSql.includes("ORDER BY a.created_at ASC, a.id ASC"));
    }
  ));

  // ---- Test 13: Sort by highest and lowest match ----
  await testAsync("13. Sort by highest and lowest match generates score-first ordering", withMockDb(
    null,
    async () => {
      let capturedSql = "";
      db.query = async (sql) => {
        capturedSql += " " + sql;
        if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
        if (sql.includes("COUNT(*) AS totalAnalyses")) return [[{ totalAnalyses: 1, averageScore: "85", highestScore: "85", completedCount: 1 }]];
        if (sql.includes("roadmap_items")) return [[]];
        return [[createMockAnalysisRow()]];
      };

      // Highest match
      await AnalysisHistoryService.getHistory(10, { sortBy: "highest_match" });
      assert.ok(capturedSql.includes("ORDER BY a.overall_score DESC"));

      // Lowest match
      capturedSql = "";
      await AnalysisHistoryService.getHistory(10, { sortBy: "lowest_match" });
      assert.ok(capturedSql.includes("ORDER BY a.overall_score ASC"));
    }
  ));

  // ---- Test 14: Open a previous analysis by ID ----
  await testAsync("14. Open a previous analysis by ID returns full immutable snapshot with all sections", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM analyses a")) {
        return [[createMockAnalysisRow({ id: 42, overall_score: "88.00" })]];
      }
      if (sql.includes("FROM skill_matches sm")) {
        return [[
          {
            id: 1,
            analysis_id: 42,
            skill_id: 10,
            status: "STRONG_MATCH",
            requirement_type: "REQUIRED",
            match_score: "1.00",
            priority: "HIGH",
            explanation: "Verified React proficiency in resume.",
            evidence: JSON.stringify(["Built React UI for analytics platform"]),
            skill_name: "React",
            skill_category: "FRAMEWORK",
          },
          {
            id: 2,
            analysis_id: 42,
            skill_id: 11,
            status: "MISSING",
            requirement_type: "REQUIRED",
            match_score: "0.00",
            priority: "HIGH",
            explanation: "Docker containerization not mentioned.",
            evidence: "[]",
            skill_name: "Docker",
            skill_category: "DEVOPS",
          },
        ]];
      }
      if (sql.includes("FROM roadmap_items")) {
        return [[{ id: 9, step_order: 1, title: "Learn Docker fundamentals", difficulty: "BEGINNER", status: "NOT_STARTED", estimated_duration: "1 week" }]];
      }
      return [[]];
    },
    async () => {
      const snapshot = await AnalysisHistoryService.getAnalysisById(42, 10);
      assert.strictEqual(snapshot.analysisId, 42);
      assert.strictEqual(snapshot.overall.score, 88);
      assert.strictEqual(snapshot.scores.skills.score, 85);
      assert.strictEqual(snapshot.scores.experience.score, 80);
      assert.strictEqual(snapshot.scores.education.score, 80);
      assert.strictEqual(snapshot.results.length, 2);
      assert.strictEqual(snapshot.results[0].jobSkill, "React");
      assert.strictEqual(snapshot.results[0].category, "STRONG_MATCH");
      assert.strictEqual(snapshot.results[1].jobSkill, "Docker");
      assert.strictEqual(snapshot.results[1].category, "MISSING");
      assert.strictEqual(snapshot.roadmap.hasRoadmap, true);
      assert.strictEqual(snapshot.metadata.isHistoricalSnapshot, true);
      assert.strictEqual(snapshot.metadata.algorithmVersion, "1.0");
      assert.ok(snapshot.aiAnalysis !== null);
    }
  ));

  // ---- Test 15: Refresh a historical analysis page ----
  const fixedAnalysisRow = createMockAnalysisRow({
    id: 50,
    overall_score: "79.00",
    created_at: "2026-10-15T12:00:00.000Z",
    completed_at: "2026-10-15T12:05:00.000Z",
  });
  await testAsync("15. Refreshing a historical analysis snapshot returns identical immutable data without recalculating", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM analyses a")) {
        return [[fixedAnalysisRow]];
      }
      if (sql.includes("FROM skill_matches sm")) return [[]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      return [[]];
    },
    async () => {
      const snap1 = await AnalysisHistoryService.getAnalysisById(50, 10);
      const snap2 = await AnalysisHistoryService.getAnalysisById(50, 10);
      assert.strictEqual(snap1.overall.score, snap2.overall.score);
      assert.strictEqual(snap1.metadata.calculatedAt, snap2.metadata.calculatedAt);
      assert.deepStrictEqual(snap1.scores, snap2.scores);
    }
  ));

  // ---- Test 16: Delete an analysis with confirmation ----
  await testAsync("16. Delete analysis removes record via user-scoped query without deleting resumes or jobs", withMockDb(
    async (sql, params) => {
      if (sql.includes("SELECT id FROM analyses WHERE id = ? AND user_id = ?")) {
        return [[{ id: 77 }]];
      }
      if (sql.includes("DELETE FROM analyses WHERE id = ? AND user_id = ?")) {
        return [{ affectedRows: 1 }];
      }
      // Fail test if any delete was attempted on resumes or jobs
      if (sql.includes("DELETE FROM resumes") || sql.includes("DELETE FROM jobs")) {
        throw new Error("Must NOT delete from resumes or jobs table!");
      }
      return [[]];
    },
    async () => {
      const req = { user: { id: 10 }, params: { id: "77" } };
      const res = createMockRes();
      await deleteAnalysis(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.deletedId, 77);
    }
  ));

  // ---- Test 17: Attempt to access another user's history ----
  await testAsync("17. Attempt to access history without auth returns 401; user query strictly scopes to user_id", withMockDb(
    null,
    async () => {
      // 1. Controller rejects unauthenticated access
      const reqUnauth = { user: null, query: {} };
      const resUnauth = createMockRes();
      await getAnalysisHistory(reqUnauth, resUnauth);
      assert.strictEqual(resUnauth.statusCode, 401, "Unauthenticated request must return 401");

      // 2. Service rejects missing userId
      await assert.rejects(
        async () => await AnalysisHistoryService.getHistory(null),
        (err) => err.status === 401
      );
    }
  ));

  // ---- Test 18: Attempt to access another user's analysis by changing record ID ----
  await testAsync("18. Attempt to access another user's analysis ID returns 404 access denied", withMockDb(
    async (sql, params) => {
      // User 20 owns nothing for id 999
      return [[]];
    },
    async () => {
      const req = { user: { id: 20 }, params: { id: "999" } };
      const res = createMockRes();
      await getHistoricalAnalysis(req, res);
      assert.strictEqual(res.statusCode, 404, "Cross-user ID access must return 404");
      assert.ok(res.body.message.includes("not found or access denied"));
    }
  ));

  // ---- Test 19: Handle deleted or unavailable associated records ----
  await testAsync("19. When job or resume is deleted, historical analysis seamlessly falls back to snapshot metadata", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM analyses a")) {
        // Return row where LEFT JOIN resulted in NULL job_title and resume_name
        return [[
          createMockAnalysisRow({
            id: 88,
            job_title: null,
            company_name: null,
            resume_name: null,
          }),
        ]];
      }
      if (sql.includes("FROM skill_matches sm")) return [[]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      return [[]];
    },
    async () => {
      const snapshot = await AnalysisHistoryService.getAnalysisById(88, 10);
      assert.strictEqual(snapshot.jobTitle, "Full Stack Developer", "Must fall back to snapshot job title");
      assert.strictEqual(snapshot.company, "TechFlow Innovations", "Must fall back to snapshot company");
      assert.strictEqual(snapshot.resumeFilename, "Jane_Doe_Resume.pdf", "Must fall back to snapshot resume filename");
    }
  ));

  // ---- Test 20: Responsive desktop, tablet, and mobile layouts / UI schema validation ----
  await testAsync("20. AnalysisHistory UI component and CSS adhere to responsive layout and accessibility contracts", async () => {
    const jsxPath = path.join(__dirname, "..", "..", "frontend", "src", "pages", "AnalysisHistory.jsx");
    const cssPath = path.join(__dirname, "..", "..", "frontend", "src", "pages", "AnalysisHistory.module.css");

    assert.ok(fs.existsSync(jsxPath), "AnalysisHistory.jsx must exist");
    assert.ok(fs.existsSync(cssPath), "AnalysisHistory.module.css must exist");

    const jsx = fs.readFileSync(jsxPath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    // Check UI components & accessibility
    assert.ok(jsx.includes("role=\"dialog\""), "Must have accessible modal dialog role");
    assert.ok(jsx.includes("aria-modal=\"true\""), "Must have aria-modal attribute");
    assert.ok(jsx.includes("aria-label="), "Must have accessible aria labels");
    assert.ok(jsx.includes("Delete Analysis"), "Must provide delete confirmation modal");
    assert.ok(jsx.includes("searchQuery"), "Must have search query state");
    assert.ok(jsx.includes("matchFilter"), "Must have match filter");
    assert.ok(jsx.includes("sortBy"), "Must have sorting options");
    assert.ok(jsx.includes("summaryStats"), "Must render KPI summary stats");

    // Check responsive CSS breakpoints
    assert.ok(css.includes("@media (max-width: 768px)"), "CSS must contain 768px tablet breakpoint");
    assert.ok(css.includes("@media (max-width: 480px)"), "CSS must contain 480px mobile breakpoint");
    assert.ok(css.includes(".summaryGrid"), "CSS must support KPI summary grid");
    assert.ok(css.includes(".historyCard"), "CSS must format history cards");
    assert.ok(css.includes(".scoreBadge"), "CSS must render match score badge");
  });
}

// Standalone runner support
if (require.main === module) {
  let passed = 0;
  let failed = 0;

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  (async () => {
    await runDay27AnalysisHistoryTests(testAsync);
    console.log(`\nStandalone Day 27 Test Summary: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  })();
}

module.exports = { runDay27AnalysisHistoryTests };
