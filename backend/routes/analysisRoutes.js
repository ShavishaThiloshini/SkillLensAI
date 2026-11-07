const express = require("express");
const router = express.Router();

const {
  getAnalysisHistory,
  getHistoricalAnalysis,
  deleteAnalysis,
  createAnalysis,
} = require("../controllers/analysisController");
const authenticateToken = require("../middleware/authMiddleware");

// All analysis endpoints require authentication
router.use(authenticateToken);

// Day 27: Analysis History & Snapshot Retrieval
router.get("/history", getAnalysisHistory);
router.get("/", getAnalysisHistory);
router.get("/:id", getHistoricalAnalysis);
router.delete("/:id", deleteAnalysis);
router.post("/", createAnalysis);

module.exports = router;

