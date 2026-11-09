const express = require("express");
const router = express.Router();

const {
  getSuggestions,
  generateSuggestions,
} = require("../controllers/resumeImprovementController");
const authenticateToken = require("../middleware/authMiddleware");

// All resume improvement routes require JWT authentication
router.use(authenticateToken);

// Day 29: Resume Improvement Suggestions Endpoints
router.post("/generate", generateSuggestions);
router.get("/:resumeId/:jobId", getSuggestions);

module.exports = router;

