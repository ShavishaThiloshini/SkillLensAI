/**
 * SkillLens AI — Skill Matching Service
 * Day 20: Deterministic & Explainable Skill Matching Engine
 *
 * Compares technical skills extracted from a user's saved resume
 * against requirements extracted from a user's saved job description.
 *
 * Categories:
 * - STRONG_MATCH (Green): Exact match or verified canonical equivalent.
 * - PARTIAL_MATCH (Yellow): Genuinely related skill providing partial coverage with explainable rationale.
 * - MISSING (Red): Required or preferred skill not evidenced or supported in the resume.
 *
 * Adheres to docs/DATABASE_SCHEMA.md, docs/PRD.md, and docs/TRD.md.
 */

const db = require("../config/db");
const { normalizeSkillName, areDistinctTechnologies, deduplicateSkills } = require("../utils/skillNormalizer");
const SkillExtractionService = require("./skillExtractionService");

const ALGORITHM_VERSION = "1.0";

/**
 * Conservative, explainable domain relationships between technologies.
 * Key: normalized name of the JOB requirement (what the job wants)
 * Values: array of { skill: string, rationale: string, direction: 'superset'|'subset'|'transferable' }
 */
const RELATED_SKILLS_MAP = {
  // TypeScript required by job
  "typescript": [
    {
      skill: "javascript",
      rationale: "The candidate demonstrates JavaScript proficiency, which is the foundational language for TypeScript, though strict TypeScript type systems and compilation workflows are not directly evidenced.",
    },
  ],
  // JavaScript required by job
  "javascript": [
    {
      skill: "typescript",
      rationale: "The candidate demonstrates TypeScript proficiency, which directly encompasses JavaScript syntax and modern ECMAScript standards.",
    },
  ],
  // Node.js required by job
  "node.js": [
    {
      skill: "express.js",
      rationale: "The candidate has experience with Express.js, a primary backend framework running on Node.js, demonstrating practical Node.js ecosystem exposure.",
    },
    {
      skill: "nestjs",
      rationale: "The candidate has experience with NestJS, a progressive Node.js framework, demonstrating Node.js server-side architecture experience.",
    },
  ],
  // Express.js required by job
  "express.js": [
    {
      skill: "node.js",
      rationale: "The candidate has experience with Node.js runtime fundamentals, but specific Express.js routing and middleware patterns are not explicitly evidenced.",
    },
  ],
  // Next.js required by job
  "next.js": [
    {
      skill: "react",
      rationale: "The candidate demonstrates strong React fundamentals, which Next.js builds upon, though Next.js SSR/SSG and server components are not explicitly evidenced.",
    },
  ],
  // React required by job
  "react": [
    {
      skill: "next.js",
      rationale: "The candidate demonstrates Next.js experience, which is built directly on React and indicates React component proficiency.",
    },
  ],
  // Tailwind CSS required by job
  "tailwind css": [
    {
      skill: "css3",
      rationale: "The candidate demonstrates foundational CSS3 styling proficiency, though utility-first Tailwind CSS conventions are not explicitly evidenced.",
    },
  ],
  // CSS3 required by job
  "css3": [
    {
      skill: "tailwind css",
      rationale: "The candidate demonstrates Tailwind CSS experience, which applies modern CSS styling and layout principles.",
    },
  ],
  // C required by job
  "c": [
    {
      skill: "c++",
      rationale: "The candidate has C++ experience, which shares core procedural syntax, pointers, and memory management concepts with C.",
    },
  ],
  // C++ required by job
  "c++": [
    {
      skill: "c",
      rationale: "The candidate has C experience, which shares low-level procedural concepts with C++, though C++ OOP features, templates, and the STL are not explicitly evidenced.",
    },
  ],
  // Relational databases (MySQL, PostgreSQL, Microsoft SQL Server, Oracle DB)
  "mysql": [
    {
      skill: "sql",
      rationale: "The candidate demonstrates core SQL database querying proficiency, but MySQL-specific administration or indexing is not explicitly evidenced.",
    },
    {
      skill: "postgresql",
      rationale: "The candidate has production experience with PostgreSQL, demonstrating transferable relational database design and SQL querying skills.",
    },
  ],
  "postgresql": [
    {
      skill: "sql",
      rationale: "The candidate demonstrates core SQL database querying proficiency, but PostgreSQL-specific features (e.g. JSONB, advanced indexing) are not explicitly evidenced.",
    },
    {
      skill: "mysql",
      rationale: "The candidate has production experience with MySQL, demonstrating transferable relational database design and SQL querying skills.",
    },
  ],
  "sql": [
    {
      skill: "mysql",
      rationale: "The candidate demonstrates hands-on experience with MySQL, which utilizes standard SQL for data definition and querying.",
    },
    {
      skill: "postgresql",
      rationale: "The candidate demonstrates hands-on experience with PostgreSQL, which utilizes standard SQL for data definition and querying.",
    },
  ],
  // Python frameworks
  "django": [
    {
      skill: "python",
      rationale: "The candidate has Python language proficiency, the underlying language for Django, but Django ORM and MVT patterns are not explicitly evidenced.",
    },
    {
      skill: "flask",
      rationale: "The candidate has experience with Flask web framework in Python, sharing Python web concepts with Django.",
    },
  ],
  "fastapi": [
    {
      skill: "python",
      rationale: "The candidate has Python proficiency, the foundation language for FastAPI, but FastAPI-specific asynchronous endpoints and Pydantic validation are not explicitly evidenced.",
    },
  ],
  "flask": [
    {
      skill: "python",
      rationale: "The candidate has Python proficiency, but specific Flask micro-framework patterns are not explicitly evidenced.",
    },
  ],
  // Container & Cloud orchestration
  "kubernetes": [
    {
      skill: "docker",
      rationale: "The candidate has containerization experience with Docker, foundational to Kubernetes container orchestration, though cluster deployment manifests and pods are not directly evidenced.",
    },
  ],
  // Cloud platforms transferable exposure
  "aws": [
    {
      skill: "google cloud platform",
      rationale: "The candidate demonstrates cloud infrastructure experience with Google Cloud Platform, sharing transferable cloud architecture patterns with AWS.",
    },
    {
      skill: "microsoft azure",
      rationale: "The candidate demonstrates cloud infrastructure experience with Microsoft Azure, sharing transferable cloud architecture patterns with AWS.",
    },
  ],
  "google cloud platform": [
    {
      skill: "aws",
      rationale: "The candidate demonstrates cloud infrastructure experience with AWS, sharing transferable cloud architecture patterns with GCP.",
    },
  ],
  "microsoft azure": [
    {
      skill: "aws",
      rationale: "The candidate demonstrates cloud infrastructure experience with AWS, sharing transferable cloud architecture patterns with Azure.",
    },
  ],
  // API technologies
  "graphql": [
    {
      skill: "rest api",
      rationale: "The candidate demonstrates API design experience with REST APIs, but GraphQL schema definition and query language are not explicitly evidenced.",
    },
  ],
  "rest api": [
    {
      skill: "graphql",
      rationale: "The candidate has API architecture experience with GraphQL, demonstrating foundational understanding of client-server data contracts.",
    },
  ],
};

class SkillMatchingService {
  /**
   * Compares an array of extracted resume skills against an array of extracted job skills.
   * Pure, deterministic, explainable comparison engine.
   *
   * @param {Array<Object>} resumeSkills - Extracted skills from candidate resume
   * @param {Array<Object>} jobSkills - Extracted skills with requirement classifications from job
   * @returns {{ summary: Object, results: Array<Object>, warnings: Array<string> }}
   */
  static compareSkillSets(resumeSkills = [], jobSkills = []) {
    const warnings = [];

    // 1. Normalize and deduplicate resume skills
    const cleanResumeSkills = deduplicateSkills(
      (resumeSkills || []).map((s) => ({
        name: typeof s === "string" ? s : s.name,
        category: s.category || "OTHER",
        evidence: s.evidence || "",
      }))
    );

    // 2. Normalize and deduplicate job skills (preserving required vs preferred)
    const cleanJobSkills = deduplicateSkills(
      (jobSkills || []).map((s) => ({
        name: typeof s === "string" ? s : s.name,
        category: s.category || "OTHER",
        required: s.required !== undefined ? Boolean(s.required) : undefined,
        priority: s.priority || (s.required === false ? "MEDIUM" : "HIGH"),
        evidence: s.evidence || "",
      }))
    );

    if (cleanResumeSkills.length === 0) {
      warnings.push("Candidate resume contains no extracted technical skills.");
    }

    if (cleanJobSkills.length === 0) {
      warnings.push("Selected job description contains no extracted technical skill requirements.");
    }

    // Build lookup maps for fast, canonical matching
    // Map normalized identifier -> array of matching resume skill objects
    const resumeMap = new Map();
    for (const rs of cleanResumeSkills) {
      const key = rs.normalizedName;
      if (!resumeMap.has(key)) {
        resumeMap.set(key, []);
      }
      resumeMap.get(key).push(rs);
    }

    const results = [];

    let strongCount = 0;
    let partialCount = 0;
    let missingCount = 0;

    let reqStrongCount = 0;
    let reqPartialCount = 0;
    let reqMissingCount = 0;

    let prefStrongCount = 0;
    let prefPartialCount = 0;
    let prefMissingCount = 0;

    let unspecStrongCount = 0;
    let unspecPartialCount = 0;
    let unspecMissingCount = 0;

    let requiredSkillsCount = 0;
    let preferredSkillsCount = 0;
    let unspecifiedSkillsCount = 0;

    for (const jobSkill of cleanJobSkills) {
      const jobKey = jobSkill.normalizedName;
      const jobDisplayName = jobSkill.name;

      // Classify requirement type
      let requirementType = "UNSPECIFIED";
      if (jobSkill.required === true) {
        requirementType = "REQUIRED";
        requiredSkillsCount++;
      } else if (jobSkill.required === false) {
        requirementType = "PREFERRED";
        preferredSkillsCount++;
      } else {
        requirementType = "UNSPECIFIED";
        unspecifiedSkillsCount++;
      }

      // Check Category A: STRONG MATCH (Exact or verified alias match)
      if (resumeMap.has(jobKey)) {
        const matches = resumeMap.get(jobKey);
        const evidenceArr = matches
          .map((m) => m.evidence)
          .filter((ev) => Boolean(ev && ev.trim()));

        results.push({
          jobSkill: jobDisplayName,
          normalizedSkill: jobKey,
          requirementType,
          category: "STRONG_MATCH",
          priority: jobSkill.priority || (requirementType === "REQUIRED" ? "HIGH" : "MEDIUM"),
          resumeEvidence: evidenceArr.length > 0 ? evidenceArr : [jobDisplayName],
          explanation: `The candidate resume contains verified evidence of ${jobDisplayName}.`,
          matchedSkill: matches[0]?.name || jobDisplayName,
        });

        strongCount++;
        if (requirementType === "REQUIRED") reqStrongCount++;
        else if (requirementType === "PREFERRED") prefStrongCount++;
        else unspecStrongCount++;

        continue;
      }

      // Check Category B: PARTIAL MATCH (Explainable related technologies)
      let foundPartial = null;
      const relatedCandidates = RELATED_SKILLS_MAP[jobKey] || [];

      for (const rel of relatedCandidates) {
        // Guard against distinct technologies
        if (areDistinctTechnologies(jobKey, rel.skill)) {
          continue;
        }

        if (resumeMap.has(rel.skill)) {
          const relatedMatches = resumeMap.get(rel.skill);
          const evidenceArr = relatedMatches
            .map((m) => m.evidence)
            .filter((ev) => Boolean(ev && ev.trim()));

          foundPartial = {
            matchedSkill: relatedMatches[0]?.name || rel.skill,
            rationale: rel.rationale,
            evidence: evidenceArr.length > 0 ? evidenceArr : [relatedMatches[0]?.name || rel.skill],
          };
          break;
        }
      }

      if (foundPartial) {
        results.push({
          jobSkill: jobDisplayName,
          normalizedSkill: jobKey,
          requirementType,
          category: "PARTIAL_MATCH",
          priority: jobSkill.priority || (requirementType === "REQUIRED" ? "HIGH" : "MEDIUM"),
          resumeEvidence: foundPartial.evidence,
          explanation: foundPartial.rationale,
          matchedSkill: foundPartial.matchedSkill,
        });

        partialCount++;
        if (requirementType === "REQUIRED") reqPartialCount++;
        else if (requirementType === "PREFERRED") prefPartialCount++;
        else unspecPartialCount++;

        continue;
      }

      // Check Category C: MISSING (Neither exact nor credible related skill)
      const requirementLabel = requirementType === "REQUIRED" ? "required" : requirementType === "PREFERRED" ? "preferred" : "specified";

      results.push({
        jobSkill: jobDisplayName,
        normalizedSkill: jobKey,
        requirementType,
        category: "MISSING",
        priority: jobSkill.priority || (requirementType === "REQUIRED" ? "HIGH" : "MEDIUM"),
        resumeEvidence: [],
        explanation: `This skill is ${requirementLabel} by the job description, but no corresponding evidence or accepted equivalent was found in the candidate resume.`,
        matchedSkill: null,
      });

      missingCount++;
      if (requirementType === "REQUIRED") reqMissingCount++;
      else if (requirementType === "PREFERRED") prefMissingCount++;
      else unspecMissingCount++;
    }

    const summary = {
      totalJobSkills: cleanJobSkills.length,
      strongMatches: strongCount,
      partialMatches: partialCount,
      missingSkills: missingCount,
      requiredSkills: requiredSkillsCount,
      preferredSkills: preferredSkillsCount,
      unspecifiedSkills: unspecifiedSkillsCount,
      requiredMatches: {
        strong: reqStrongCount,
        partial: reqPartialCount,
        missing: reqMissingCount,
      },
      preferredMatches: {
        strong: prefStrongCount,
        partial: prefPartialCount,
        missing: prefMissingCount,
      },
      unspecifiedMatches: {
        strong: unspecStrongCount,
        partial: unspecPartialCount,
        missing: unspecMissingCount,
      },
    };

    return {
      summary,
      results,
      warnings,
    };
  }

  /**
   * Runs the skill matching workflow using real saved data from MySQL.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @param {Object} [options]
   * @returns {Promise<Object>} Formatted matching response conforming to Day 20 specification
   */
  static async runMatching(resumeId, jobId, userId, options = {}) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("Resume ID, Job Description ID, and User ID are required.");
      err.status = 400;
      throw err;
    }

    const parsedResumeId = Number(resumeId);
    const parsedJobId = Number(jobId);
    const parsedUserId = Number(userId);

    if (Number.isNaN(parsedResumeId) || Number.isNaN(parsedJobId) || Number.isNaN(parsedUserId)) {
      const err = new Error("Resume ID and Job Description ID must be valid numbers.");
      err.status = 400;
      throw err;
    }

    // 1. Verify resume existence and user ownership
    const [resumes] = await db.query(
      `SELECT id, user_id, original_filename, processing_status
       FROM resumes
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [parsedResumeId, parsedUserId]
    );

    if (!resumes || resumes.length === 0) {
      const err = new Error("Resume not found or access denied.");
      err.status = 404;
      throw err;
    }

    // 2. Verify job description existence and user ownership
    const [jobs] = await db.query(
      `SELECT id, user_id, title, company, processing_status
       FROM jobs
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [parsedJobId, parsedUserId]
    );

    if (!jobs || jobs.length === 0) {
      const err = new Error("Job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    const resumeRecord = resumes[0];
    const jobRecord = jobs[0];

    // 3. Fetch or automatically extract resume skills
    let resumeSkillsData = await SkillExtractionService.getResumeSkills(parsedResumeId, parsedUserId);
    if (!resumeSkillsData?.skills || resumeSkillsData.skills.length === 0) {
      try {
        resumeSkillsData = await SkillExtractionService.extractResumeSkills(parsedResumeId, parsedUserId, {
          forceFallback: options.forceFallback || false,
        });
      } catch (resumeExtractErr) {
        console.warn(`[MatchingService] Automatic resume skill extraction warning: ${resumeExtractErr.message}`);
      }
    }

    // 4. Fetch or automatically extract job skills
    let jobSkillsData = await SkillExtractionService.getJobSkills(parsedJobId, parsedUserId);
    if (!jobSkillsData?.skills || jobSkillsData.skills.length === 0) {
      try {
        jobSkillsData = await SkillExtractionService.extractJobSkills(parsedJobId, parsedUserId, {
          forceFallback: options.forceFallback || false,
        });
      } catch (jobExtractErr) {
        console.warn(`[MatchingService] Automatic job skill extraction warning: ${jobExtractErr.message}`);
      }
    }

    const resumeSkillsList = resumeSkillsData?.skills || [];
    const jobSkillsList = jobSkillsData?.skills || [];

    // 5. Run deterministic matching algorithm
    const comparison = this.compareSkillSets(resumeSkillsList, jobSkillsList);

    // Merge any upstream extraction warnings
    const combinedWarnings = [
      ...(resumeSkillsData?.extractionMetadata?.warnings || []),
      ...(jobSkillsData?.extractionMetadata?.warnings || []),
      ...comparison.warnings,
    ];

    const matchedAt = new Date().toISOString();

    // 6. Database persistence in MySQL transaction (preventing duplicate analyses and skill_matches)
    await this.persistMatchingResults({
      userId: parsedUserId,
      resumeId: parsedResumeId,
      jobId: parsedJobId,
      summary: comparison.summary,
      results: comparison.results,
      algorithmVersion: ALGORITHM_VERSION,
    });

    // 7. Return structured result conforming to Day 20 specification
    return {
      resumeId: parsedResumeId,
      jobDescriptionId: parsedJobId,
      jobTitle: jobRecord.title,
      company: jobRecord.company || null,
      resumeFilename: resumeRecord.original_filename,
      matchingMetadata: {
        status: "COMPLETED",
        algorithmVersion: ALGORITHM_VERSION,
        matchedAt,
        warnings: Array.from(new Set(combinedWarnings)),
      },
      summary: comparison.summary,
      results: comparison.results,
    };
  }

  /**
   * Persists matching results to MySQL atomically using a transaction.
   * Updates existing analysis for (user_id, resume_id, job_id) if it exists,
   * avoiding duplicate records on repeat runs.
   *
   * @param {Object} params
   */
  static async persistMatchingResults({ userId, resumeId, jobId, summary, results, algorithmVersion }) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Check for existing analysis record for this user, resume, and job
      const [existingAnalyses] = await connection.query(
        `SELECT id FROM analyses WHERE user_id = ? AND resume_id = ? AND job_id = ? LIMIT 1`,
        [userId, resumeId, jobId]
      );

      let analysisId;
      const now = new Date();

      // Skill match percentage for overall/skill_score
      const totalJobSkills = summary.totalJobSkills || 0;
      const strongScore = (summary.strongMatches || 0) * 1.0;
      const partialScore = (summary.partialMatches || 0) * 0.5;
      const skillScorePct = totalJobSkills > 0 ? Math.round(((strongScore + partialScore) / totalJobSkills) * 10000) / 100 : 0.0;

      if (existingAnalyses && existingAnalyses.length > 0) {
        analysisId = existingAnalyses[0].id;
        await connection.query(
          `UPDATE analyses
           SET skill_score = ?, overall_score = ?, status = 'COMPLETED', algorithm_version = ?, completed_at = ?
           WHERE id = ?`,
          [skillScorePct, skillScorePct, algorithmVersion, now, analysisId]
        );
      } else {
        const [insertResult] = await connection.query(
          `INSERT INTO analyses
           (user_id, resume_id, job_id, overall_score, skill_score, status, algorithm_version, completed_at)
           VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
          [userId, resumeId, jobId, skillScorePct, skillScorePct, algorithmVersion, now]
        );
        analysisId = insertResult.insertId;
      }

      // 2. Clean up old skill_matches for this analysis to prevent duplicate records
      await connection.query(`DELETE FROM skill_matches WHERE analysis_id = ?`, [analysisId]);

      // 3. Batch insert new skill_matches
      if (results && results.length > 0) {
        // Ensure all evaluated skills exist in `skills` master table so foreign keys resolve
        const skillRows = results.map((r) => [r.jobSkill, "OTHER"]);
        await connection.query(
          `INSERT INTO skills (name, category) VALUES ?
           ON DUPLICATE KEY UPDATE name = VALUES(name)`,
          [skillRows]
        );

        const skillNames = results.map((r) => r.jobSkill);
        const [skillDbRows] = await connection.query(
          `SELECT id, name FROM skills WHERE name IN (?)`,
          [skillNames]
        );

        const skillMap = new Map(skillDbRows.map((s) => [s.name, s.id]));

        const matchRows = [];
        for (const item of results) {
          const skillId = skillMap.get(item.jobSkill);
          if (skillId) {
            const evidenceStr = Array.isArray(item.resumeEvidence)
              ? item.resumeEvidence.join(" | ").slice(0, 500)
              : null;

            matchRows.push([
              analysisId,
              skillId,
              item.category,
              item.requirementType || "REQUIRED",
              item.priority || "HIGH",
              (item.explanation || "").slice(0, 1000),
              evidenceStr,
            ]);
          }
        }

        if (matchRows.length > 0) {
          await connection.query(
            `INSERT INTO skill_matches
             (analysis_id, skill_id, status, requirement_type, priority, explanation, evidence)
             VALUES ?`,
            [matchRows]
          );
        }
      }

      await connection.commit();
      return analysisId;
    } catch (err) {
      await connection.rollback();
      console.error("[MatchingService] Error persisting matching results:", err.message);
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Retrieves saved matching results from MySQL.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  static async getSavedMatching(resumeId, jobId, userId) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("Resume ID, Job Description ID, and User ID are required.");
      err.status = 400;
      throw err;
    }

    const parsedResumeId = Number(resumeId);
    const parsedJobId = Number(jobId);
    const parsedUserId = Number(userId);

    if (Number.isNaN(parsedResumeId) || Number.isNaN(parsedJobId) || Number.isNaN(parsedUserId)) {
      const err = new Error("Resume ID and Job Description ID must be valid numbers.");
      err.status = 400;
      throw err;
    }

    // 1. Verify ownership of resume and job
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

    // 2. Fetch latest analysis
    const [analyses] = await db.query(
      `SELECT id, status, algorithm_version, created_at, completed_at
       FROM analyses
       WHERE user_id = ? AND resume_id = ? AND job_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [parsedUserId, parsedResumeId, parsedJobId]
    );

    if (!analyses || analyses.length === 0) {
      return null;
    }

    const analysis = analyses[0];

    // 3. Fetch skill matches
    const [rows] = await db.query(
      `SELECT sm.id, sm.status, sm.requirement_type, sm.priority, sm.explanation, sm.evidence,
              s.name AS skill_name, s.category AS skill_category
       FROM skill_matches sm
       JOIN skills s ON sm.skill_id = s.id
       WHERE sm.analysis_id = ?
       ORDER BY
         CASE sm.requirement_type WHEN 'REQUIRED' THEN 1 WHEN 'PREFERRED' THEN 2 ELSE 3 END,
         CASE sm.status WHEN 'STRONG_MATCH' THEN 1 WHEN 'PARTIAL_MATCH' THEN 2 ELSE 3 END,
         s.name ASC`,
      [analysis.id]
    );

    const results = (rows || []).map((r) => {
      const norm = normalizeSkillName(r.skill_name, { categoryHint: r.skill_category });
      const evidenceArr = r.evidence
        ? r.evidence.split(" | ").map((e) => e.trim()).filter(Boolean)
        : [];

      return {
        jobSkill: r.skill_name,
        normalizedSkill: norm?.normalizedName || r.skill_name.toLowerCase(),
        requirementType: r.requirement_type,
        category: r.status,
        priority: r.priority || "MEDIUM",
        resumeEvidence: evidenceArr,
        explanation: r.explanation || "",
        matchedSkill: r.status !== "MISSING" ? r.skill_name : null,
      };
    });

    // Recompute summary from saved rows
    let strongCount = 0;
    let partialCount = 0;
    let missingCount = 0;
    let reqStrong = 0, reqPartial = 0, reqMissing = 0;
    let prefStrong = 0, prefPartial = 0, prefMissing = 0;
    let unspecStrong = 0, unspecPartial = 0, unspecMissing = 0;
    let reqTotal = 0, prefTotal = 0, unspecTotal = 0;

    for (const r of results) {
      if (r.category === "STRONG_MATCH") strongCount++;
      else if (r.category === "PARTIAL_MATCH") partialCount++;
      else missingCount++;

      if (r.requirementType === "REQUIRED") {
        reqTotal++;
        if (r.category === "STRONG_MATCH") reqStrong++;
        else if (r.category === "PARTIAL_MATCH") reqPartial++;
        else reqMissing++;
      } else if (r.requirementType === "PREFERRED") {
        prefTotal++;
        if (r.category === "STRONG_MATCH") prefStrong++;
        else if (r.category === "PARTIAL_MATCH") prefPartial++;
        else prefMissing++;
      } else {
        unspecTotal++;
        if (r.category === "STRONG_MATCH") unspecStrong++;
        else if (r.category === "PARTIAL_MATCH") unspecPartial++;
        else unspecMissing++;
      }
    }

    return {
      resumeId: parsedResumeId,
      jobDescriptionId: parsedJobId,
      jobTitle: jobs[0].title,
      company: jobs[0].company || null,
      resumeFilename: resumes[0].original_filename,
      matchingMetadata: {
        status: analysis.status,
        algorithmVersion: analysis.algorithm_version || ALGORITHM_VERSION,
        matchedAt: analysis.completed_at || analysis.created_at,
        warnings: [],
      },
      summary: {
        totalJobSkills: results.length,
        strongMatches: strongCount,
        partialMatches: partialCount,
        missingSkills: missingCount,
        requiredSkills: reqTotal,
        preferredSkills: prefTotal,
        unspecifiedSkills: unspecTotal,
        requiredMatches: { strong: reqStrong, partial: reqPartial, missing: reqMissing },
        preferredMatches: { strong: prefStrong, partial: prefPartial, missing: prefMissing },
        unspecifiedMatches: { strong: unspecStrong, partial: unspecPartial, missing: unspecMissing },
      },
      results,
    };
  }
}

module.exports = SkillMatchingService;
