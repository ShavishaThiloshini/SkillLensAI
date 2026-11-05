const express = require("express");
const router = express.Router();

const {
  generateRoadmap,
  getSavedRoadmap,
  updateItemStatus,
  resetRoadmapProgress,
} = require("../controllers/roadmapController");
const authenticateToken = require("../middleware/authMiddleware");

// All roadmap routes require authentication
router.use(authenticateToken);

// Day 26: Personalized Skill Gap Roadmap
router.post("/generate", generateRoadmap);
router.get("/:resumeId/:jobDescriptionId", getSavedRoadmap);
router.patch("/items/:itemId/status", updateItemStatus);
router.post("/reset/:analysisId", resetRoadmapProgress);

module.exports = router;

