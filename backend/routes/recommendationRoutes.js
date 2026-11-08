const express = require("express");
const router = express.Router();

const {
  getRecommendations,
  generateRecommendations,
  getSkillRecommendation,
  updateRecommendationStatus,
} = require("../controllers/recommendationController");
const authenticateToken = require("../middleware/authMiddleware");

// All recommendation routes require JWT authentication
router.use(authenticateToken);

// Day 28: Learning Recommendations API Endpoints
router.post("/generate", generateRecommendations);
router.get("/skill/:analysisId/:skillName", getSkillRecommendation);
router.patch("/items/:itemId/status", updateRecommendationStatus);
router.get("/:resumeId/:jobDescriptionId", getRecommendations);

module.exports = router;

