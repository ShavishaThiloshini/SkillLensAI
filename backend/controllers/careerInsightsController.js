/**
 * SkillLens AI — Career Insights Controller
 * Day 30: Career Insights & Readiness API Endpoints
 *
 * Exposes:
 * - GET /api/career-insights/:resumeId/:jobId: Retrieves saved career insights or generates them
 * - POST /api/career-insights/generate: Generates fresh career insights across all 5 sections
 * - GET /api/career-insights/readiness/:resumeId/:jobId: Retrieves career readiness assessment
 */

const CareerInsightsService = require("../services/careerInsightsService");

/**
 * GET /api/career-insights/:resumeId/:jobId
 * Retrieves saved career insights for the authenticated user's resume and job pair.
 */
async function getCareerInsights(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to access career insights.",
    });
  }

  const resumeId = Number(req.params.resumeId);
  const jobId = Number(req.params.jobId);

  if (!resumeId || !jobId || Number.isNaN(resumeId) || Number.isNaN(jobId) || resumeId <= 0 || jobId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid positive integers are required for resumeId and jobId.",
    });
  }

  try {
    const result = await CareerInsightsService.getCareerInsights(resumeId, jobId, userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[CareerInsightsController] Get error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve career insights.",
    });
  }
}

/**
 * POST /api/career-insights/generate
 * Generates fresh career insights.
 */
async function generateCareerInsights(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to generate career insights.",
    });
  }

  const resumeId = req.body?.resumeId;
  const jobId = req.body?.jobId || req.body?.jobDescriptionId;
  const forceFallback = req.body?.forceFallback === true;

  if (!resumeId || !jobId) {
    return res.status(400).json({
      success: false,
      message: "Both resumeId and jobId are required.",
    });
  }

  const numResumeId = Number(resumeId);
  const numJobId = Number(jobId);

  if (Number.isNaN(numResumeId) || Number.isNaN(numJobId) || numResumeId <= 0 || numJobId <= 0) {
    return res.status(400).json({
      success: false,
      message: "resumeId and jobId must be positive integers.",
    });
  }

  try {
    const result = await CareerInsightsService.generateCareerInsights(numResumeId, numJobId, userId, {
      forceFallback,
    });

    return res.status(200).json({
      success: true,
      message: "Career insights generated successfully.",
      data: result,
    });
  } catch (error) {
    console.error("[CareerInsightsController] Generate error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to generate career insights.",
    });
  }
}

/**
 * GET /api/career-insights/readiness/:resumeId/:jobId
 * Retrieves standalone career readiness score and dimensional breakdown.
 */
async function getReadiness(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to access career readiness assessment.",
    });
  }

  const resumeId = Number(req.params.resumeId);
  const jobId = Number(req.params.jobId);

  if (!resumeId || !jobId || Number.isNaN(resumeId) || Number.isNaN(jobId) || resumeId <= 0 || jobId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid positive integers are required for resumeId and jobId.",
    });
  }

  try {
    const result = await CareerInsightsService.getCareerInsights(resumeId, jobId, userId);

    return res.status(200).json({
      success: true,
      data: {
        analysisId: result.analysisId,
        careerReadiness: result.careerReadiness,
      },
    });
  } catch (error) {
    console.error("[CareerInsightsController] Readiness error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve career readiness assessment.",
    });
  }
}

module.exports = {
  getCareerInsights,
  generateCareerInsights,
  getReadiness,
};

