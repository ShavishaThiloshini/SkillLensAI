const express = require("express");
const router = express.Router();

const {
  uploadResume,
  getUserResumes,
  getResumeById,
  extractResume,
  parseResume,
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

// Trigger text extraction and structured parsing for a stored resume
router.post("/:id/extract", extractResume);

// Day 12: Trigger structured parsing and validation directly for a stored resume
router.post("/:id/parse", parseResume);

module.exports = router;

