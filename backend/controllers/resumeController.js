const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const { validateResumeFile } = require("../utils/fileValidator");

/**
 * Helper to safely unlink a temporary/saved file without throwing
 */
function cleanUpFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("[ResumeController] Error cleaning up file:", err.message);
    }
  }
}

/**
 * POST /api/resumes
 * Uploads, validates, stores, and registers a new resume.
 */
async function uploadResume(req, res) {
  const file = req.file;
  const userId = req.user?.id;

  if (!userId) {
    cleanUpFile(file?.path);
    return res.status(401).json({
      success: false,
      message: "Authentication required to upload a resume.",
    });
  }

  if (!file) {
    return res.status(400).json({
      success: false,
      message: "No resume file provided. Please attach a PDF or DOCX file under field 'resume'.",
    });
  }

  const filePath = file.path;
  const originalFilename = file.originalname || "resume";
  const storedFilename = file.filename;

  // 1. Comprehensive content & structure validation (PDF magic bytes, DOCX Open XML structure)
  const validation = validateResumeFile(filePath, originalFilename);
  if (!validation.isValid) {
    cleanUpFile(filePath);
    return res.status(400).json({
      success: false,
      message: validation.message || "File validation failed.",
    });
  }

  // 2. Relative storage path to record in MySQL
  const relativePath = path.posix.join("uploads", "resumes", storedFilename);

  // 3. Insert metadata into MySQL
  try {
    const insertQuery = `
      INSERT INTO resumes (
        user_id,
        original_filename,
        stored_filename,
        file_type,
        file_size,
        file_path,
        processing_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(insertQuery, [
      userId,
      originalFilename,
      storedFilename,
      validation.fileType,
      validation.fileSize,
      relativePath,
      "UPLOADED",
    ]);

    const resumeId = result.insertId;

    return res.status(201).json({
      success: true,
      message: "Resume uploaded successfully and ready for processing.",
      resume: {
        id: resumeId,
        original_filename: originalFilename,
        file_type: validation.fileType,
        file_size: validation.fileSize,
        processing_status: "UPLOADED",
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[ResumeController] Database error:", error.message);
    // Clean up orphaned file on server disk if database operation failed
    cleanUpFile(filePath);

    return res.status(500).json({
      success: false,
      message: "Unable to save resume metadata to database. The file has been removed.",
    });
  }
}

/**
 * GET /api/resumes
 * Lists all resumes owned by the authenticated user.
 */
async function getUserResumes(req, res) {
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
        original_filename,
        file_type,
        file_size,
        processing_status,
        created_at,
        updated_at
      FROM resumes
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      resumes: rows || [],
    });
  } catch (error) {
    console.error("[ResumeController] Failed to retrieve resumes:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve resumes at this time.",
    });
  }
}

/**
 * GET /api/resumes/:id
 * Retrieves metadata for a specific resume owned by the authenticated user.
 */
async function getResumeById(req, res) {
  const userId = req.user?.id;
  const resumeId = Number(req.params.id);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!resumeId || Number.isNaN(resumeId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid resume ID.",
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT
        id,
        original_filename,
        file_type,
        file_size,
        processing_status,
        created_at,
        updated_at
      FROM resumes
      WHERE id = ? AND user_id = ?
      LIMIT 1`,
      [resumeId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Resume not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      resume: rows[0],
    });
  } catch (error) {
    console.error("[ResumeController] Failed to retrieve resume:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve resume details at this time.",
    });
  }
}

module.exports = {
  uploadResume,
  getUserResumes,
  getResumeById,
};
