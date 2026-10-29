const express = require("express");
const router = express.Router();

const {
  runMatching,
  getSavedMatching,
  calculateMatchScore,
  getSavedMatchScore,
} = require("../controllers/matchingController");
const authenticateToken = require("../middleware/authMiddleware");

// All matching routes require authentication
router.use(authenticateToken);

// Day 20: Deterministic skill matching between a resume and a job description
router.post("/run", runMatching);
router.get("/:resumeId/:jobDescriptionId", getSavedMatching);

// Day 21: Match score calculation & retrieval
router.post("/score", calculateMatchScore);
router.get("/score/:resumeId/:jobDescriptionId", getSavedMatchScore);

module.exports = router;
