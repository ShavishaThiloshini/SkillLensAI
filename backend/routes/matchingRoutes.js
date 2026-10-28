const express = require("express");
const router = express.Router();

const { runMatching, getSavedMatching } = require("../controllers/matchingController");
const authenticateToken = require("../middleware/authMiddleware");

// All matching routes require authentication
router.use(authenticateToken);

// Run deterministic skill matching between a resume and a job description
router.post("/run", runMatching);

// Retrieve previously saved matching results
router.get("/:resumeId/:jobDescriptionId", getSavedMatching);

module.exports = router;
