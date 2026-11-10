const express = require("express");
const router = express.Router();

const {
  getReportPreview,
  downloadReportPdf,
} = require("../controllers/reportController");
const authenticateToken = require("../middleware/authMiddleware");

// All report routes require JWT authentication
router.use(authenticateToken);

// Day 31: Report Generation & Preview Endpoints
router.get("/:analysisId/preview", getReportPreview);
router.get("/:analysisId/download", downloadReportPdf);

module.exports = router;

