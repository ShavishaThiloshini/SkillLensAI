const express = require("express");
const router = express.Router();

const {
  getCareerInsights,
  generateCareerInsights,
  getReadiness,
} = require("../controllers/careerInsightsController");
const authenticateToken = require("../middleware/authMiddleware");

// All career insights routes require JWT authentication
router.use(authenticateToken);

// Day 30: Career Insights API Endpoints
router.post("/generate", generateCareerInsights);
router.get("/readiness/:resumeId/:jobId", getReadiness);
router.get("/:resumeId/:jobId", getCareerInsights);

module.exports = router;

