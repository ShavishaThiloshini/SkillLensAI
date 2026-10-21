const express = require("express");
const router = express.Router();

const {
  createJobDescription,
  uploadJobDescription,
  getJobDescriptions,
  getJobDescriptionById,
  extractRequirementsForJob,
  getJobRequirements,
} = require("../controllers/jobController");
const authenticateToken = require("../middleware/authMiddleware");
const {
  jobUploadMiddleware,
  handleJobUploadError,
} = require("../middleware/jobUploadMiddleware");

// All job description routes require authentication
router.use(authenticateToken);

// Create a job description from pasted text
router.post("/", createJobDescription);

// Upload a PDF or DOCX, extract text, and save the job description
router.post("/upload", jobUploadMiddleware, handleJobUploadError, uploadJobDescription);

// List all job descriptions belonging to the authenticated user
router.get("/", getJobDescriptions);

// Retrieve a single job description owned by the authenticated user
router.get("/:id", getJobDescriptionById);

// Extract requirements for a saved job description
router.post("/:id/extract-requirements", extractRequirementsForJob);

// Retrieve saved extracted requirements for a job description
router.get("/:id/requirements", getJobRequirements);

module.exports = router;
