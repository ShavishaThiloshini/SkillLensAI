/**
 * SkillLens AI — Analysis History Service
 * Day 27: History & Snapshot Persistence Engine
 *
 * Provides:
 * 1. History retrieval with searching, multi-criteria filtering, sorting, and pagination
 * 2. Immutable snapshot retrieval by analysis ID without triggering re-analysis or recalculation
 * 3. Secure analysis record deletion maintaining cross-user isolation and referential integrity
 * 4. Explicit snapshot creation for historical comparisons
 *
 * Adheres strictly to docs/DATABASE_SCHEMA.md, docs/PRD.md, docs/TRD.md, and docs/APP_FLOW.md.
 */

const db = require("../config/db");
const SkillMatchingService = require("./skillMatchingService");
const MatchScoreService = require("./matchScoreService");

const ALGORITHM_VERSION = "1.0";

class AnalysisHistoryService {
  /**
   * Retrieves paginated analysis history for the authenticated user with search, filtering, and sorting.
   *
   * @param {number} userId - Authenticated user ID
   * @param {Object} [options]
   * @param {string} [options.search] - Search query for job title, company, or resume name
   * @param {string} [options.match] - 'all' | 'high' (>=75) | 'medium' (50-74) | 'low' (<50)
   * @param {string} [options.status] - 'all' | 'COMPLETED' | 'PROCESSING' | 'FAILED' | 'PENDING'
   * @param {string} [options.dateRange] - 'all' | '7d' | '30d' | '90d'
   * @param {string} [options.startDate] - ISO date string
   * @param {string} [options.endDate] - ISO date string
   * @param {string} [options.sortBy] - 'most_recent' | 'oldest' | 'highest_match' | 'lowest_match'
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   * @returns {Promise<Object>}
   */
  static async getHistory(userId, options = {}) {
    if (!userId) {
      const err = new Error("User ID is required.");
      err.status = 401;
      throw err;
    }

    const parsedUserId = Number(userId);
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const {
      search = "",
      match = "all",
      status = "all",
      dateRange = "all",
      startDate,
      endDate,
      sortBy = "most_recent",
    } = options;

    // 1. Build WHERE conditions and query parameters safely
    const conditions = ["a.user_id = ?"];
    const queryParams = [parsedUserId];

    // Search by Job Title, Company, or Resume Name
    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        `(LOWER(COALESCE(j.title, '')) LIKE ? OR LOWER(COALESCE(j.company, '')) LIKE ? OR LOWER(COALESCE(r.original_filename, '')) LIKE ? OR LOWER(COALESCE(a.summary, '')) LIKE ?)`
      );
      queryParams.push(term, term, term, term);
    }

    // Match score category filter
    const matchCat = (match || "all").toLowerCase();
    if (matchCat === "high") {
      conditions.push("a.overall_score >= 75.00");
    } else if (matchCat === "medium") {
      conditions.push("a.overall_score >= 50.00 AND a.overall_score < 75.00");
    } else if (matchCat === "low") {
      conditions.push("a.overall_score < 50.00");
    }

    // Status filter
    if (status && status.toLowerCase() !== "all") {
      conditions.push("a.status = ?");
      queryParams.push(status.toUpperCase());
    }

    // Date range filter
    if (startDate) {
      conditions.push("a.created_at >= ?");
      queryParams.push(new Date(startDate));
    }
    if (endDate) {
      conditions.push("a.created_at <= ?");
      queryParams.push(new Date(endDate));
    } else if (dateRange === "7d") {
      conditions.push("a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
    } else if (dateRange === "30d") {
      conditions.push("a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    } else if (dateRange === "90d") {
      conditions.push("a.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)");
    }

    const whereClause = conditions.join(" AND ");

    // 2. Determine ORDER BY clause
    let orderClause = "a.created_at DESC, a.id DESC";
    if (sortBy === "oldest") {
      orderClause = "a.created_at ASC, a.id ASC";
    } else if (sortBy === "highest_match") {
      orderClause = "a.overall_score DESC, a.created_at DESC, a.id DESC";
    } else if (sortBy === "lowest_match") {
      orderClause = "a.overall_score ASC, a.created_at DESC, a.id DESC";
    }

    // 3. Count total matching rows
    const countSql = `
      SELECT COUNT(*) AS total
      FROM analyses a
      LEFT JOIN jobs j ON a.job_id = j.id
      LEFT JOIN resumes r ON a.resume_id = r.id
      WHERE ${whereClause}
    `;

    const [countRows] = await db.query(countSql, queryParams);
    const totalRecords = Number(countRows[0]?.total || 0);

    // 4. Fetch paginated analysis records
    const selectSql = `
      SELECT
        a.id,
        a.user_id,
        a.resume_id,
        a.job_id,
        a.overall_score,
        a.skill_score,
        a.experience_score,
        a.education_score,
        a.certification_score,
        a.summary,
        a.status,
        a.algorithm_version,
        a.created_at,
        a.completed_at,
        j.title AS job_title,
        j.company AS company_name,
        r.original_filename AS resume_name
      FROM analyses a
      LEFT JOIN jobs j ON a.job_id = j.id
      LEFT JOIN resumes r ON a.resume_id = r.id
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.query(selectSql, [...queryParams, limit, offset]);

    // 5. Check which analyses have roadmap items in batch
    const analysisIds = rows.map((r) => r.id);
    const roadmapPresenceSet = new Set();
    if (analysisIds.length > 0) {
      const [roadmapRows] = await db.query(
        `SELECT DISTINCT analysis_id FROM roadmap_items WHERE analysis_id IN (?)`,
        [analysisIds]
      );
      for (const row of roadmapRows) {
        roadmapPresenceSet.add(row.analysis_id);
      }
    }

    // 6. Format analysis records and restore snapshots if associated records were modified
    const formattedAnalyses = rows.map((row) => {
      let summaryObj = null;
      if (row.summary) {
        try {
          summaryObj = JSON.parse(row.summary);
        } catch {
          // ignore parsing error
        }
      }

      const snap = summaryObj?.snapshot || {};
      const jobTitle = row.job_title || snap.jobTitle || "Saved Job Description";
      const company = row.company_name || snap.company || null;
      const resumeName = row.resume_name || snap.resumeFilename || "Saved Resume";

      const overallNum = row.overall_score !== null ? Number(row.overall_score) : null;
      let matchCategory = "UNAVAILABLE";
      if (overallNum !== null) {
        if (overallNum >= 75) matchCategory = "HIGH";
        else if (overallNum >= 50) matchCategory = "MEDIUM";
        else matchCategory = "LOW";
      }

      return {
        id: row.id,
        resumeId: row.resume_id,
        jobId: row.job_id,
        jobTitle,
        company,
        resumeName,
        overallScore: overallNum !== null ? Math.round(overallNum) : null,
        rawScore: overallNum,
        matchCategory,
        scores: {
          skills: row.skill_score !== null ? Math.round(Number(row.skill_score)) : null,
          experience: row.experience_score !== null ? Math.round(Number(row.experience_score)) : null,
          education: row.education_score !== null ? Math.round(Number(row.education_score)) : null,
        },
        status: row.status,
        algorithmVersion: row.algorithm_version || "1.0",
        createdAt: row.created_at,
        completedAt: row.completed_at || row.created_at,
        hasRoadmap: roadmapPresenceSet.has(row.id),
      };
    });

    // 7. Calculate aggregate summary stats for this user
    const statsSql = `
      SELECT
        COUNT(*) AS totalAnalyses,
        AVG(overall_score) AS averageScore,
        MAX(overall_score) AS highestScore,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedCount
      FROM analyses
      WHERE user_id = ?
    `;
    const [statsRows] = await db.query(statsSql, [parsedUserId]);
    const userStats = statsRows[0] || {};

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return {
      analyses: formattedAnalyses,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
      summaryStats: {
        totalAnalyses: Number(userStats.totalAnalyses || 0),
        averageScore:
          userStats.averageScore !== null &&
          userStats.averageScore !== undefined &&
          !Number.isNaN(Number(userStats.averageScore))
            ? Math.round(Number(userStats.averageScore) * 10) / 10
            : 0,
        highestScore:
          userStats.highestScore !== null &&
          userStats.highestScore !== undefined &&
          !Number.isNaN(Number(userStats.highestScore))
            ? Math.round(Number(userStats.highestScore))
            : 0,
        completedCount: Number(userStats.completedCount || 0),
      },
    };
  }

  /**
   * Retrieves an immutable historical analysis snapshot by ID.
   * Enforces strict user ownership: never returns another user's analysis.
   * Does NOT re-run matching or recalculate scores.
   *
   * @param {number} analysisId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async getAnalysisById(analysisId, userId) {
    if (!analysisId || !userId) {
      const err = new Error("Valid analysis ID and user ID are required.");
      err.status = 400;
      throw err;
    }

    const parsedId = Number(analysisId);
    const parsedUserId = Number(userId);

    if (Number.isNaN(parsedId) || Number.isNaN(parsedUserId)) {
      const err = new Error("Analysis ID and User ID must be valid integers.");
      err.status = 400;
      throw err;
    }

    // 1. Fetch analysis with left joins to job and resume
    const [rows] = await db.query(
      `SELECT
        a.id,
        a.user_id,
        a.resume_id,
        a.job_id,
        a.overall_score,
        a.skill_score,
        a.experience_score,
        a.education_score,
        a.certification_score,
        a.summary,
        a.status,
        a.algorithm_version,
        a.created_at,
        a.completed_at,
        j.title AS job_title,
        j.company AS company_name,
        r.original_filename AS resume_name
       FROM analyses a
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN resumes r ON a.resume_id = r.id
       WHERE a.id = ? AND a.user_id = ?
       LIMIT 1`,
      [parsedId, parsedUserId]
    );

    if (!rows || rows.length === 0) {
      const err = new Error("Analysis not found or access denied.");
      err.status = 404;
      throw err;
    }

    const analysis = rows[0];

    // 2. Parse summary JSON snapshot
    let summaryObj = null;
    if (analysis.summary) {
      try {
        summaryObj = JSON.parse(analysis.summary);
      } catch {
        // ignore parsing error
      }
    }

    const snap = summaryObj?.snapshot || {};
    const jobTitle = analysis.job_title || snap.jobTitle || "Saved Job Description";
    const company = analysis.company_name || snap.company || null;
    const resumeFilename = analysis.resume_name || snap.resumeFilename || "Saved Resume";

    // 3. Fetch persisted skill_matches for this analysis snapshot
    const [matchesRows] = await db.query(
      `SELECT
        sm.id,
        sm.analysis_id,
        sm.skill_id,
        sm.status,
        sm.requirement_type,
        sm.match_score,
        sm.priority,
        sm.explanation,
        sm.evidence,
        s.name AS skill_name,
        s.category AS skill_category
       FROM skill_matches sm
       JOIN skills s ON sm.skill_id = s.id
       WHERE sm.analysis_id = ?
       ORDER BY sm.id ASC`,
      [parsedId]
    );

    // Format skill matches to match frontend structure
    const results = matchesRows.map((sm) => {
      let parsedEvidence = [];
      if (sm.evidence) {
        try {
          parsedEvidence = Array.isArray(sm.evidence) ? sm.evidence : JSON.parse(sm.evidence);
        } catch {
          parsedEvidence = [sm.evidence];
        }
      }

      return {
        jobSkill: sm.skill_name,
        normalizedSkill: sm.skill_name.toLowerCase().trim(),
        skillCategory: sm.skill_category || "OTHER",
        requirementType: sm.requirement_type,
        category: sm.status,
        priority: sm.priority || (sm.requirement_type === "REQUIRED" ? "HIGH" : "MEDIUM"),
        resumeEvidence: parsedEvidence,
        explanation: sm.explanation || (sm.status === "STRONG_MATCH"
          ? `Verified evidence in resume.`
          : sm.status === "PARTIAL_MATCH"
          ? `Partial match with related background.`
          : `Requirement not evidenced in resume.`),
        matchedSkill: sm.status === "PARTIAL_MATCH" ? (parsedEvidence[0] || sm.skill_name) : sm.skill_name,
      };
    });

    // 4. Fetch roadmap items count and presence
    const [roadmapRows] = await db.query(
      `SELECT id, step_order, title, difficulty, status, estimated_duration
       FROM roadmap_items
       WHERE analysis_id = ?
       ORDER BY step_order ASC`,
      [parsedId]
    );

    const overallScoreNum = analysis.overall_score !== null ? Math.round(Number(analysis.overall_score)) : null;
    const skillsScoreNum = analysis.skill_score !== null ? Math.round(Number(analysis.skill_score)) : null;
    const expScoreNum = analysis.experience_score !== null ? Math.round(Number(analysis.experience_score)) : null;
    const eduScoreNum = analysis.education_score !== null ? Math.round(Number(analysis.education_score)) : null;

    return {
      analysisId: parsedId,
      resumeId: analysis.resume_id,
      jobDescriptionId: analysis.job_id,
      jobTitle,
      company,
      resumeFilename,
      overall: {
        score: overallScoreNum,
        status: overallScoreNum !== null ? "AVAILABLE" : (summaryObj?.overall?.status || "AVAILABLE"),
        explanation: summaryObj?.overall?.explanation || `Overall match score of ${overallScoreNum ?? 0}% based on evaluated categories.`,
      },
      scores: {
        skills: {
          score: skillsScoreNum,
          status: skillsScoreNum !== null ? "AVAILABLE" : (summaryObj?.scores?.skills?.status || "NOT_APPLICABLE"),
          explanation: summaryObj?.scores?.skills?.explanation || "Based on evaluated job skill requirements.",
        },
        experience: {
          score: expScoreNum,
          status: expScoreNum !== null ? "AVAILABLE" : (summaryObj?.scores?.experience?.status || "NOT_APPLICABLE"),
          explanation: summaryObj?.scores?.experience?.explanation || "Based on candidate work history duration.",
        },
        education: {
          score: eduScoreNum,
          status: eduScoreNum !== null ? "AVAILABLE" : (summaryObj?.scores?.education?.status || "NOT_APPLICABLE"),
          explanation: summaryObj?.scores?.education?.explanation || "Based on candidate educational degrees and field of study.",
        },
      },
      aiAnalysis: summaryObj?.aiAnalysis || null,
      results,
      roadmap: {
        hasRoadmap: roadmapRows.length > 0,
        itemCount: roadmapRows.length,
        items: roadmapRows,
      },
      metadata: {
        analysisId: parsedId,
        algorithmVersion: analysis.algorithm_version || "1.0",
        calculatedAt: analysis.completed_at || analysis.created_at,
        isHistoricalSnapshot: true,
        warnings: summaryObj?.warnings || [],
      },
    };
  }

  /**
   * Deletes an analysis record owned by the authenticated user.
   * Cascades to related skill_matches and roadmap_items.
   * Preserves the underlying resume and job description.
   *
   * @param {number} analysisId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async deleteAnalysis(analysisId, userId) {
    if (!analysisId || !userId) {
      const err = new Error("Analysis ID and User ID are required.");
      err.status = 400;
      throw err;
    }

    const parsedId = Number(analysisId);
    const parsedUserId = Number(userId);

    // 1. Verify existence & ownership
    const [rows] = await db.query(
      `SELECT id FROM analyses WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedId, parsedUserId]
    );

    if (!rows || rows.length === 0) {
      const err = new Error("Analysis not found or access denied.");
      err.status = 404;
      throw err;
    }

    // 2. Perform deletion (foreign keys ON DELETE CASCADE will clean up skill_matches and roadmap_items)
    const [delResult] = await db.query(
      `DELETE FROM analyses WHERE id = ? AND user_id = ?`,
      [parsedId, parsedUserId]
    );

    if (delResult.affectedRows === 0) {
      const err = new Error("Analysis could not be deleted.");
      err.status = 500;
      throw err;
    }

    return {
      success: true,
      message: "Analysis deleted successfully.",
      deletedId: parsedId,
    };
  }

  /**
   * Explicitly runs an analysis and saves it as a new distinct historical snapshot.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  static async createAnalysisSnapshot(resumeId, jobId, userId, options = {}) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("Resume ID, Job Description ID, and User ID are required.");
      err.status = 400;
      throw err;
    }

    const parsedResumeId = Number(resumeId);
    const parsedJobId = Number(jobId);
    const parsedUserId = Number(userId);

    // Verify ownership
    const [resumes] = await db.query(
      `SELECT id, original_filename FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedResumeId, parsedUserId]
    );
    if (!resumes || resumes.length === 0) {
      const err = new Error("Resume not found or access denied.");
      err.status = 404;
      throw err;
    }

    const [jobs] = await db.query(
      `SELECT id, title, company FROM jobs WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedJobId, parsedUserId]
    );
    if (!jobs || jobs.length === 0) {
      const err = new Error("Job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    // Run matching and scoring
    const scoreResult = await MatchScoreService.calculateMatchScore(parsedResumeId, parsedJobId, parsedUserId, {
      ...options,
      createNew: true,
    });

    return scoreResult;
  }
}

module.exports = AnalysisHistoryService;

