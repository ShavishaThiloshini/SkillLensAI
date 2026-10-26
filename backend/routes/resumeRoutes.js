const express = require("express");
const router = express.Router();

const {
  uploadResume,
  getUserResumes,
  getResumeById,
  extractResume,
  parseResume,
  deleteResume,
  replaceResume,
  extractResumeSkills,
  getResumeSkills,
} = require("../controllers/resumeController");
const authenticateToken = require("../middleware/authMiddleware");
const {
  uploadMiddleware,
  handleUploadError,
} = require("../middleware/uploadMiddleware");

// All resume routes are protected by JWT authentication
router.use(authenticateToken);

// Upload a single resume (field name: 'resume')
router.post("/", uploadMiddleware, handleUploadError, uploadResume);

// List authenticated user's resumes
router.get("/", getUserResumes);

// Retrieve metadata and extracted sections for a single resume owned by the user
router.get("/:id", getResumeById);

// Delete an owned resume and its extracted records and stored document
router.delete("/:id", deleteResume);

// Replace an existing resume file with validation, reset of previous extracts, and old file cleanup
router.put("/:id/file", uploadMiddleware, handleUploadError, replaceResume);

// Trigger text extraction and structured parsing for a stored resume
router.post("/:id/extract", extractResume);

// Day 12: Trigger structured parsing and validation directly for a stored resume
router.post("/:id/parse", parseResume);

// Day 19: Extract technical skills from resume using AI service with deterministic fallback
router.post("/:id/skills/extract", extractResumeSkills);
router.post("/:id/extract-skills", extractResumeSkills);

// Day 19: Retrieve saved extracted skills for a stored resume
router.get("/:id/skills", getResumeSkills);

module.exports = router;

