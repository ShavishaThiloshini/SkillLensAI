/**
 * SkillLens AI — Report Generation Controller
 * Day 31: AI Resume Skill Gap Report Endpoints
 *
 * Exposes:
 * - GET /api/reports/:analysisId/preview: Retrieves structured preview data for an analysis report
 * - GET /api/reports/:analysisId/download: Streams the generated PDF report
 */

const ReportGenerationService = require("../services/reportGenerationService");

/**
 * GET /api/reports/:analysisId/preview
 * Returns structured JSON report data for frontend preview before downloading.
 */
async function getReportPreview(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to preview analysis reports.",
    });
  }

  const analysisId = Number(req.params.analysisId);

  if (!analysisId || Number.isNaN(analysisId) || analysisId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid positive integer analysisId is required.",
    });
  }

  try {
    const reportData = await ReportGenerationService.getReportData(analysisId, userId);

    return res.status(200).json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    console.error("[ReportController] Preview error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to generate report preview.",
    });
  }
}

/**
 * GET /api/reports/:analysisId/download
 * Generates and streams the formal A4 PDF report for download.
 */
async function downloadReportPdf(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to download analysis reports.",
    });
  }

  const analysisId = Number(req.params.analysisId);

  if (!analysisId || Number.isNaN(analysisId) || analysisId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid positive integer analysisId is required.",
    });
  }

  try {
    const { buffer, filename } = await ReportGenerationService.generatePdfReport(analysisId, userId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);

    return res.end(buffer);
  } catch (error) {
    console.error("[ReportController] Download error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to generate PDF report.",
    });
  }
}

module.exports = {
  getReportPreview,
  downloadReportPdf,
};

