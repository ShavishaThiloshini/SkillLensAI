const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const { validateResumeFile } = require("../utils/fileValidator");
const { extractDocumentText } = require("../utils/documentParser");
const JobRequirementExtractionService = require("../services/jobRequirementExtractionService");

// Maximum allowed pasted text length (characters)
const MAX_DESCRIPTION_LENGTH = 30000;
// Maximum job title length
const MAX_TITLE_LENGTH = 200;
// Maximum company name length
const MAX_COMPANY_LENGTH = 200;

/**
 * Safely removes a file from disk without throwing.
 */
function cleanUpFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("[JobController] Error cleaning up file:", err.message);
    }
  }
}

/**
 * Sanitizes and trims a string input; returns null when blank after trimming.
 */
function sanitizeText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * POST /api/job-descriptions
 * Creates a job description from pasted text.
 */
async function createJobDescription(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const title = sanitizeText(req.body?.title);
  const company = sanitizeText(req.body?.company) || null;
  const description = sanitizeText(req.body?.description);

  if (!title) {
    return res.status(400).json({
      success: false,
      message: "Job title is required.",
    });
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Job title must not exceed ${MAX_TITLE_LENGTH} characters.`,
    });
  }

  if (company && company.length > MAX_COMPANY_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Company name must not exceed ${MAX_COMPANY_LENGTH} characters.`,
    });
  }

  if (!description) {
    return res.status(400).json({
      success: false,
      message: "Job description text is required.",
    });
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Job description must not exceed ${MAX_DESCRIPTION_LENGTH} characters. Current length: ${description.length}.`,
    });
  }

  try {
    const insertQuery = `
      INSERT INTO jobs (user_id, title, company, description, source_type, processing_status)
      VALUES (?, ?, ?, ?, 'PASTED_TEXT', 'COMPLETED')
    `;

    const [result] = await db.query(insertQuery, [userId, title, company, description]);
    const jobId = result.insertId;

    const [rows] = await db.query(
      "SELECT id, title, company, description, source_type, processing_status, created_at FROM jobs WHERE id = ?",
      [jobId]
    );

    return res.status(201).json({
      success: true,
      message: "Job description saved successfully.",
      job: rows[0] || null,
    });
  } catch (error) {
    console.error("[JobController] Database error creating job description:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to save job description to database. Please try again.",
    });
  }
}

/**
 * POST /api/job-descriptions/upload
 * Accepts a PDF or DOCX, extracts its text, and saves the job description.
 * The original file is deleted after successful extraction.
 */
async function uploadJobDescription(req, res) {
  const file = req.file;
  const userId = req.user?.id;

  if (!userId) {
    cleanUpFile(file?.path);
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!file) {
    return res.status(400).json({
      success: false,
      message: "No file provided. Please attach a PDF or DOCX file under field 'jobDescription'.",
    });
  }

  const filePath = file.path;
  const originalFilename = file.originalname || "job_description";

  // Validate file structure (extension, magic bytes, size)
  const validation = validateResumeFile(filePath, originalFilename);
  if (!validation.isValid) {
    cleanUpFile(filePath);
    return res.status(400).json({
      success: false,
      message: validation.message || "File validation failed.",
    });
  }

  // Extract title and optional company from request body
  const title = sanitizeText(req.body?.title);
  const company = sanitizeText(req.body?.company) || null;

  if (!title) {
    cleanUpFile(filePath);
    return res.status(400).json({
      success: false,
      message: "Job title is required even when uploading a file.",
    });
  }

  if (title.length > MAX_TITLE_LENGTH) {
    cleanUpFile(filePath);
    return res.status(400).json({
      success: false,
      message: `Job title must not exceed ${MAX_TITLE_LENGTH} characters.`,
    });
  }

  if (company && company.length > MAX_COMPANY_LENGTH) {
    cleanUpFile(filePath);
    return res.status(400).json({
      success: false,
      message: `Company name must not exceed ${MAX_COMPANY_LENGTH} characters.`,
    });
  }

  // Extract text from the document
  const extractionResult = await extractDocumentText(filePath, validation.fileType);

  // Always clean up the temporary file after extraction attempt
  cleanUpFile(filePath);

  if (!extractionResult.success) {
    return res.status(422).json({
      success: false,
      message:
        extractionResult.error ||
        "Unable to extract text from the uploaded document. It may be a scanned image, encrypted, or corrupted. Please paste the text manually instead.",
    });
  }

  const description = extractionResult.text.trim();

  if (!description || description.length === 0) {
    return res.status(422).json({
      success: false,
      message:
        "The uploaded document contains no readable text. Please paste the job description manually instead.",
    });
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Extracted text exceeds the ${MAX_DESCRIPTION_LENGTH}-character limit. Please use a shorter document or paste the relevant sections manually.`,
    });
  }

  try {
    const insertQuery = `
      INSERT INTO jobs (user_id, title, company, description, source_type, processing_status)
      VALUES (?, ?, ?, ?, 'UPLOADED_FILE', 'COMPLETED')
    `;

    const [result] = await db.query(insertQuery, [
      userId,
      title,
      company,
      description,
    ]);
    const jobId = result.insertId;

    const [rows] = await db.query(
      "SELECT id, title, company, description, source_type, processing_status, created_at FROM jobs WHERE id = ?",
      [jobId]
    );

    return res.status(201).json({
      success: true,
      message: "Job description extracted and saved successfully.",
      job: rows[0] || null,
      extractedCharCount: extractionResult.charCount,
    });
  } catch (error) {
    console.error("[JobController] Database error saving uploaded job description:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to save job description to database. Please try again.",
    });
  }
}

/**
 * GET /api/job-descriptions
 * Lists all job descriptions belonging to the authenticated user.
 */
async function getJobDescriptions(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT
        id,
        title,
        company,
        LEFT(description, 200) AS description_preview,
        source_type,
        processing_status,
        created_at,
        updated_at
      FROM jobs
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      jobs: rows || [],
    });
  } catch (error) {
    console.error("[JobController] Failed to retrieve job descriptions:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve job descriptions at this time.",
    });
  }
}

/**
 * GET /api/job-descriptions/:id
 * Retrieves one job description owned by the authenticated user.
 */
async function getJobDescriptionById(req, res) {
  const userId = req.user?.id;
  const jobId = Number(req.params.id);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!jobId || Number.isNaN(jobId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid job description ID.",
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT
        id,
        title,
        company,
        description,
        source_type,
        processing_status,
        created_at,
        updated_at
      FROM jobs
      WHERE id = ? AND user_id = ?`,
      [jobId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Job description not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      job: rows[0],
    });
  } catch (error) {
    console.error("[JobController] Failed to retrieve job description:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve job description at this time.",
    });
  }
}

/**
 * POST /api/job-descriptions/:id/extract-requirements
 * Extracts structured requirements (skills, experience, education, tools, technologies, certifications)
 * from an existing job description belonging to the authenticated user.
 */
async function extractRequirementsForJob(req, res) {
  const userId = req.user?.id;
  const jobId = Number(req.params.id);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!jobId || Number.isNaN(jobId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid job description ID.",
    });
  }

  try {
    const result = await JobRequirementExtractionService.processJobRequirements(jobId, userId);

    return res.status(200).json({
      success: true,
      message: "Job requirements extracted and saved successfully.",
      jobId: result.jobId,
      jobTitle: result.jobTitle,
      requirements: result.requirements,
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: error.message || "Job description not found or access denied.",
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message || "Invalid request.",
      });
    }

    console.error("[JobController] Error extracting job requirements:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to extract requirements from the job description. Please try again.",
    });
  }
}

/**
 * GET /api/job-descriptions/:id/requirements
 * Retrieves previously saved extracted requirements for a job description owned by the user.
 */
async function getJobRequirements(req, res) {
  const userId = req.user?.id;
  const jobId = Number(req.params.id);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!jobId || Number.isNaN(jobId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid job description ID.",
    });
  }

  try {
    // 1. Verify existence and ownership
    const [jobs] = await db.query(
      `SELECT id, title, company FROM jobs WHERE id = ? AND user_id = ? LIMIT 1`,
      [jobId, userId]
    );

    if (!jobs || jobs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Job description not found or access denied.",
      });
    }

    const job = jobs[0];

    // 2. Fetch saved requirements
    const requirements = await JobRequirementExtractionService.getSavedRequirements(jobId);

    if (!requirements) {
      return res.status(200).json({
        success: true,
        extracted: false,
        message: "No requirements have been extracted for this job description yet.",
        jobId: job.id,
        jobTitle: job.title,
        requirements: null,
      });
    }

    return res.status(200).json({
      success: true,
      extracted: true,
      jobId: job.id,
      jobTitle: job.title,
      requirements,
    });
  } catch (error) {
    console.error("[JobController] Error retrieving job requirements:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve job requirements at this time.",
    });
  }
}

module.exports = {
  createJobDescription,
  uploadJobDescription,
  getJobDescriptions,
  getJobDescriptionById,
  extractRequirementsForJob,
  getJobRequirements,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_COMPANY_LENGTH,
};
