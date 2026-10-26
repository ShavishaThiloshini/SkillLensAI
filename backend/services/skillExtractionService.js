/**
 * SkillLens AI — Skill Extraction Service
 * Day 19: AI-Powered Skill Extraction & Normalization
 *
 * Extracts, normalizes, deduplicates, and persists technical skills from:
 * 1. Saved resumes (using resume text, structured sections, and Day 18 AI service with fallback)
 * 2. Saved job descriptions (using job description text, Day 16 requirements, and Day 18 AI service with fallback)
 *
 * Adheres to docs/DATABASE_SCHEMA.md, docs/PRD.md, and docs/TRD.md.
 */

const db = require("../config/db");
const { generateText, validateAiConfig } = require("./aiService");
const { extractSkills: extractSkillsDeterministic } = require("../utils/skillCatalogue");
const { normalizeSkillName, deduplicateSkills } = require("../utils/skillNormalizer");
const JobRequirementExtractionService = require("./jobRequirementExtractionService");

const EXTRACTOR_VERSION = "1.0";
const MAX_AI_INPUT_LENGTH = 10000;

/**
 * Strips code fences and parses JSON safely.
 *
 * @param {string} raw
 * @returns {Object|null}
 */
function safeParseJson(raw) {
  if (!raw || typeof raw !== "string") return null;

  let cleaned = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ...)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\r?\n?/i, "");
    cleaned = cleaned.replace(/\r?\n?```\s*$/i, "");
    cleaned = cleaned.trim();
  }

  // Find first { and last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    return null;
  }
}

class SkillExtractionService {
  /**
   * Extracts and persists technical skills from an authenticated user's saved resume.
   *
   * @param {number} resumeId
   * @param {number} userId
   * @param {Object} [options]
   * @param {boolean} [options.forceFallback=false] - Force deterministic fallback (useful for tests or offline)
   * @returns {Promise<Object>} Conceptual extraction result conforming to Day 19 spec
   */
  static async extractResumeSkills(resumeId, userId, options = {}) {
    if (!resumeId || !userId) {
      const err = new Error("Resume ID and User ID are required.");
      err.status = 400;
      throw err;
    }

    // 1. Fetch resume and verify ownership
    const [resumes] = await db.query(
      `SELECT id, user_id, original_filename, file_type, extracted_text, processing_status
       FROM resumes
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [resumeId, userId]
    );

    if (!resumes || resumes.length === 0) {
      const err = new Error("Resume not found or access denied.");
      err.status = 404;
      throw err;
    }

    const resume = resumes[0];

    // If text extraction hasn't happened yet, attempt full extraction pipeline safely
    let resumeText = (resume.extracted_text || "").trim();
    if (!resumeText && resume.extracted_text === null) {
      try {
        const ResumeService = require("./resumeService");
        const extResult = await ResumeService.extractResume(resumeId, userId);
        if (extResult && extResult.structuredData?.fullText) {
          resumeText = extResult.structuredData.fullText;
        }
      } catch (extErr) {
        // Document may not be on disk or is corrupted; proceed with empty text safely
      }
    }

    const warnings = [];
    let extractedSkills = [];
    let extractionMethod = "FALLBACK_DETERMINISTIC";
    const aiConfigValidation = validateAiConfig();
    const isAiConfigured = Boolean(aiConfigValidation.valid);

    // 2. Fetch specific structured sections to enrich evidence
    const [sections] = await db.query(
      `SELECT section_type, section_content FROM resume_sections WHERE resume_id = ?`,
      [resumeId]
    );

    let skillsSectionText = "";
    let experienceSectionText = "";
    let projectsSectionText = "";
    let summaryText = "";

    for (const sec of sections || []) {
      const st = sec.section_type.toUpperCase();
      if (st.includes("SKILL")) skillsSectionText += " " + sec.section_content;
      else if (st.includes("EXPERIENCE")) experienceSectionText += " " + sec.section_content;
      else if (st.includes("PROJECT")) projectsSectionText += " " + sec.section_content;
      else if (st.includes("SUMMARY")) summaryText += " " + sec.section_content;
    }

    // 3. Attempt AI extraction if configured and not forced to fallback
    if (isAiConfigured && !options.forceFallback && resumeText) {
      try {
        const textToAnalyze = resumeText.slice(0, MAX_AI_INPUT_LENGTH);

        const prompt = `You are an expert technical skill extractor for SkillLens AI.
Analyze the following resume text and extract all explicitly mentioned technical skills (programming languages, frameworks, libraries, databases, cloud platforms, devops tools, and testing tools).

CRITICAL RULES:
1. Extract ONLY skills with explicit textual evidence in the resume. Do NOT infer or assume candidate skills.
2. Provide a short, direct quote or snippet from the resume as evidence (under 120 characters).
3. Classify category into: PROGRAMMING, FRAMEWORK, DATABASE, CLOUD, TOOL, DESIGN, or OTHER.
4. Include confidence as a number between 0.80 and 0.99.
5. Return JSON ONLY matching this exact schema:
{
  "skills": [
    {
      "name": "React",
      "category": "FRAMEWORK",
      "confidence": 0.95,
      "evidence": "Built web applications using React and Redux"
    }
  ]
}

RESUME TEXT:
${textToAnalyze}`;

        const aiResponse = await generateText({
          prompt,
          systemPrompt: "You are a professional technical skill parser that extracts evidenced skills and returns strict JSON.",
          maxTokens: 1200,
          temperature: 0.1,
          timeoutMs: 20000,
        });

        const parsedJson = safeParseJson(aiResponse.text);

        if (parsedJson && Array.isArray(parsedJson.skills)) {
          extractedSkills = parsedJson.skills.filter(
            (s) => s && typeof s.name === "string" && s.name.trim().length > 0
          );
          extractionMethod = "AI";
        } else {
          warnings.push("AI provider returned unexpected output format. Using deterministic extraction fallback.");
        }
      } catch (aiErr) {
        warnings.push(`AI skill extraction could not be completed (${aiErr.code || aiErr.message}). Using deterministic fallback.`);
      }
    } else if (!isAiConfigured) {
      warnings.push("AI provider is not configured. Processed using deterministic extraction engine.");
    }

    // 4. Deterministic fallback extraction if AI was not used or failed to produce skills
    if (extractedSkills.length === 0) {
      const deterministicResults = extractSkillsDeterministic(resumeText, skillsSectionText);

      extractedSkills = deterministicResults.map((s) => ({
        name: s.name,
        category: s.category,
        confidence: s.evidence && s.evidence.length > 20 ? 0.95 : 0.85,
        evidence: s.evidence || `Identified from resume text`,
      }));
      extractionMethod = "FALLBACK_DETERMINISTIC";
    }

    // 5. Shared normalization and deduplication
    const normalizedSkills = deduplicateSkills(extractedSkills);

    // 6. Database persistence in MySQL using atomic transaction
    await this.persistResumeSkills(resumeId, normalizedSkills);

    // 7. Format conceptual result matching Day 19 specification
    return {
      sourceType: "RESUME",
      sourceId: resumeId,
      skills: normalizedSkills.map((s) => ({
        name: s.name,
        normalizedName: s.normalizedName,
        category: s.category,
        confidence: s.confidence,
        evidence: s.evidence || "",
      })),
      extractionMetadata: {
        status: "COMPLETED",
        extractorVersion: EXTRACTOR_VERSION,
        method: extractionMethod,
        aiConfigured: isAiConfigured,
        totalCount: normalizedSkills.length,
        warnings,
      },
    };
  }

  /**
   * Persists extracted resume skills atomically to MySQL.
   *
   * @param {number} resumeId
   * @param {Array<Object>} skills
   */
  static async persistResumeSkills(resumeId, skills) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Clean up previous skills for this resume to prevent duplicates
      await connection.query(`DELETE FROM resume_skills WHERE resume_id = ?`, [resumeId]);

      if (skills.length > 0) {
        // 1. Batch upsert master skills catalogue
        const skillRows = skills.map((s) => [s.name, s.category || "OTHER"]);
        await connection.query(
          `INSERT INTO skills (name, category) VALUES ?
           ON DUPLICATE KEY UPDATE category = VALUES(category)`,
          [skillRows]
        );

        // 2. Fetch all skill IDs in a single query
        const skillNames = skills.map((s) => s.name);
        const [rows] = await connection.query(
          `SELECT id, name FROM skills WHERE name IN (?)`,
          [skillNames]
        );

        const skillMap = new Map(rows.map((r) => [r.name, r.id]));

        // 3. Batch insert resume_skills associations
        const links = [];
        for (const s of skills) {
          const skillId = skillMap.get(s.name);
          if (skillId) {
            links.push([resumeId, skillId, "UNKNOWN", s.evidence || null]);
          }
        }

        if (links.length > 0) {
          await connection.query(
            `INSERT INTO resume_skills (resume_id, skill_id, proficiency, evidence) VALUES ?
             ON DUPLICATE KEY UPDATE evidence = VALUES(evidence)`,
            [links]
          );
        }
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Retrieves saved extracted skills for a saved resume.
   *
   * @param {number} resumeId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async getResumeSkills(resumeId, userId) {
    if (!resumeId || !userId) {
      const err = new Error("Resume ID and User ID are required.");
      err.status = 400;
      throw err;
    }

    // Verify ownership
    const [resumes] = await db.query(
      `SELECT id, user_id, original_filename, processing_status FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`,
      [resumeId, userId]
    );

    if (!resumes || resumes.length === 0) {
      const err = new Error("Resume not found or access denied.");
      err.status = 404;
      throw err;
    }

    const [rows] = await db.query(
      `SELECT s.id, s.name, s.category, rs.proficiency, rs.evidence, rs.created_at
       FROM resume_skills rs
       JOIN skills s ON rs.skill_id = s.id
       WHERE rs.resume_id = ?
       ORDER BY s.category ASC, s.name ASC`,
      [resumeId]
    );

    const skills = (rows || []).map((r) => {
      const norm = normalizeSkillName(r.name, { categoryHint: r.category });
      return {
        name: r.name,
        normalizedName: norm?.normalizedName || r.name.toLowerCase(),
        category: r.category,
        confidence: 0.95,
        evidence: r.evidence || "",
      };
    });

    return {
      sourceType: "RESUME",
      sourceId: resumeId,
      skills,
      extractionMetadata: {
        status: "COMPLETED",
        extractorVersion: EXTRACTOR_VERSION,
        totalCount: skills.length,
        warnings: [],
      },
    };
  }

  /**
   * Extracts and persists technical skills from an authenticated user's saved job description.
   * Preserves required vs preferred classifications.
   *
   * @param {number} jobId
   * @param {number} userId
   * @param {Object} [options]
   * @param {boolean} [options.forceFallback=false]
   * @returns {Promise<Object>}
   */
  static async extractJobSkills(jobId, userId, options = {}) {
    if (!jobId || !userId) {
      const err = new Error("Job ID and User ID are required.");
      err.status = 400;
      throw err;
    }

    // 1. Fetch job description and verify ownership
    const [jobs] = await db.query(
      `SELECT id, user_id, title, company, description, source_type, processing_status
       FROM jobs
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [jobId, userId]
    );

    if (!jobs || jobs.length === 0) {
      const err = new Error("Job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    const job = jobs[0];
    const description = (job.description || "").trim();

    const warnings = [];
    let extractedSkills = [];
    let extractionMethod = "FALLBACK_DETERMINISTIC";
    const aiConfigValidation = validateAiConfig();
    const isAiConfigured = Boolean(aiConfigValidation.valid);

    // 2. Attempt AI extraction if configured and not forced to fallback
    if (isAiConfigured && !options.forceFallback && description) {
      try {
        const textToAnalyze = description.slice(0, MAX_AI_INPUT_LENGTH);

        const prompt = `You are an expert job skill extractor for SkillLens AI.
Analyze the following job description and extract all explicitly mentioned technical skills (programming languages, frameworks, databases, cloud, devops, tools).

CRITICAL RULES:
1. Identify whether each skill is required (mandatory, must-have) or preferred (bonus, nice-to-have, plus).
2. Set priority: 'HIGH' for required skills; 'MEDIUM' or 'LOW' for preferred skills.
3. Provide a direct, short quote or snippet from the text as evidence (under 120 characters).
4. Do NOT infer candidate skills or assume technologies not explicitly stated.
5. Return JSON ONLY matching this exact schema:
{
  "skills": [
    {
      "name": "React",
      "category": "FRAMEWORK",
      "required": true,
      "priority": "HIGH",
      "confidence": 0.98,
      "evidence": "3+ years of professional React experience required"
    }
  ]
}

JOB TITLE: ${job.title}
JOB DESCRIPTION:
${textToAnalyze}`;

        const aiResponse = await generateText({
          prompt,
          systemPrompt: "You are a professional job parser that extracts evidenced technical skills and returns strict JSON.",
          maxTokens: 1400,
          temperature: 0.1,
          timeoutMs: 20000,
        });

        const parsedJson = safeParseJson(aiResponse.text);

        if (parsedJson && Array.isArray(parsedJson.skills)) {
          extractedSkills = parsedJson.skills.filter(
            (s) => s && typeof s.name === "string" && s.name.trim().length > 0
          );
          extractionMethod = "AI";
        } else {
          warnings.push("AI provider returned unexpected output format. Using deterministic extraction fallback.");
        }
      } catch (aiErr) {
        warnings.push(`AI job skill extraction could not be completed (${aiErr.code || aiErr.message}). Using deterministic fallback.`);
      }
    } else if (!isAiConfigured) {
      warnings.push("AI provider is not configured. Processed using deterministic extraction engine.");
    }

    // 3. Deterministic extraction fallback using Day 16 JobRequirementExtractionService
    if (extractedSkills.length === 0) {
      const requirements = JobRequirementExtractionService.extractRequirements(description, job.id, job.title);

      for (const skill of requirements.requiredSkills || []) {
        extractedSkills.push({
          name: skill.name,
          category: skill.category || "OTHER",
          required: true,
          priority: "HIGH",
          confidence: 0.95,
          evidence: skill.evidence || `Mentioned as required in job description`,
        });
      }

      for (const skill of requirements.preferredSkills || []) {
        extractedSkills.push({
          name: skill.name,
          category: skill.category || "OTHER",
          required: false,
          priority: "MEDIUM",
          confidence: 0.90,
          evidence: skill.evidence || `Mentioned as preferred/optional in job description`,
        });
      }

      for (const tech of requirements.technologies || []) {
        extractedSkills.push({
          name: tech.name,
          category: tech.category || "FRAMEWORK",
          required: Boolean(tech.required),
          priority: tech.required ? "HIGH" : "MEDIUM",
          confidence: 0.92,
          evidence: tech.evidence || `Technology requirement`,
        });
      }

      for (const tool of requirements.tools || []) {
        extractedSkills.push({
          name: tool.name,
          category: "TOOL",
          required: Boolean(tool.required),
          priority: tool.required ? "HIGH" : "MEDIUM",
          confidence: 0.90,
          evidence: tool.evidence || `Tool requirement`,
        });
      }

      extractionMethod = "FALLBACK_DETERMINISTIC";
    }

    // 4. Shared normalization and deduplication
    const normalizedSkills = deduplicateSkills(extractedSkills);

    // 5. Database persistence in MySQL
    await this.persistJobSkills(jobId, normalizedSkills);

    // 6. Format conceptual result matching Day 19 specification
    return {
      sourceType: "JOB_DESCRIPTION",
      sourceId: jobId,
      skills: normalizedSkills.map((s) => ({
        name: s.name,
        normalizedName: s.normalizedName,
        category: s.category,
        required: s.required !== undefined ? s.required : true,
        priority: s.priority || (s.required ? "HIGH" : "MEDIUM"),
        confidence: s.confidence,
        evidence: s.evidence || "",
      })),
      extractionMetadata: {
        status: "COMPLETED",
        extractorVersion: EXTRACTOR_VERSION,
        method: extractionMethod,
        aiConfigured: isAiConfigured,
        totalCount: normalizedSkills.length,
        warnings,
      },
    };
  }

  /**
   * Persists extracted job skills atomically to MySQL.
   *
   * @param {number} jobId
   * @param {Array<Object>} skills
   */
  static async persistJobSkills(jobId, skills) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Clean up previous job_skills for this job
      await connection.query(`DELETE FROM job_skills WHERE job_id = ?`, [jobId]);

      if (skills.length > 0) {
        // 1. Batch upsert master skills catalogue
        const skillRows = skills.map((s) => [s.name, s.category || "OTHER"]);
        await connection.query(
          `INSERT INTO skills (name, category) VALUES ?
           ON DUPLICATE KEY UPDATE category = VALUES(category)`,
          [skillRows]
        );

        // 2. Fetch skill IDs
        const skillNames = skills.map((s) => s.name);
        const [rows] = await connection.query(
          `SELECT id, name FROM skills WHERE name IN (?)`,
          [skillNames]
        );

        const skillMap = new Map(rows.map((r) => [r.name, r.id]));

        // 3. Batch insert job_skills associations
        const links = [];
        for (const s of skills) {
          const skillId = skillMap.get(s.name);
          if (skillId) {
            links.push([
              jobId,
              skillId,
              s.priority || (s.required ? "HIGH" : "MEDIUM"),
              s.required ? 1 : 0,
              s.evidence || null,
            ]);
          }
        }

        if (links.length > 0) {
          await connection.query(
            `INSERT INTO job_skills (job_id, skill_id, priority, required, evidence) VALUES ?
             ON DUPLICATE KEY UPDATE priority = VALUES(priority), required = VALUES(required), evidence = VALUES(evidence)`,
            [links]
          );
        }
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Retrieves saved extracted skills for a saved job description.
   *
   * @param {number} jobId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async getJobSkills(jobId, userId) {
    if (!jobId || !userId) {
      const err = new Error("Job ID and User ID are required.");
      err.status = 400;
      throw err;
    }

    // Verify ownership
    const [jobs] = await db.query(
      `SELECT id, user_id, title FROM jobs WHERE id = ? AND user_id = ? LIMIT 1`,
      [jobId, userId]
    );

    if (!jobs || jobs.length === 0) {
      const err = new Error("Job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    const [rows] = await db.query(
      `SELECT s.id, s.name, s.category, js.priority, js.required, js.evidence, js.created_at
       FROM job_skills js
       JOIN skills s ON js.skill_id = s.id
       WHERE js.job_id = ?
       ORDER BY js.required DESC, js.priority DESC, s.name ASC`,
      [jobId]
    );

    const skills = (rows || []).map((r) => {
      const norm = normalizeSkillName(r.name, { categoryHint: r.category });
      return {
        name: r.name,
        normalizedName: norm?.normalizedName || r.name.toLowerCase(),
        category: r.category,
        required: Boolean(r.required),
        priority: r.priority,
        confidence: 0.95,
        evidence: r.evidence || "",
      };
    });

    return {
      sourceType: "JOB_DESCRIPTION",
      sourceId: jobId,
      skills,
      extractionMetadata: {
        status: "COMPLETED",
        extractorVersion: EXTRACTOR_VERSION,
        totalCount: skills.length,
        warnings: [],
      },
    };
  }
}

module.exports = SkillExtractionService;
