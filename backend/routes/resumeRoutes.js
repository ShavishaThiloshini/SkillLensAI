const express = require("express");
const router = express.Router();

const {
  uploadResume,
  getUserResumes,
  getResumeById,
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

// Retrieve metadata for a single resume owned by the user
router.get("/:id", getResumeById);

module.exports = router;
