const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const { testAiConnection, getAiStatus } = require("../controllers/aiController");

// All AI endpoints require authentication
router.use(authenticateToken);

// Safe status check (returns whether AI provider is configured without exposing secrets)
router.get("/status", getAiStatus);

// Test endpoint for validating connection with the configured AI provider
router.post("/test", testAiConnection);

module.exports = router;
