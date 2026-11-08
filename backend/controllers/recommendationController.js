/**
 * SkillLens AI — Learning Recommendation Controller
 * Day 28: Learning Recommendations API Endpoints
 *
 * Exposes:
 * - GET /api/recommendations/:resumeId/:jobDescriptionId: Retrieves saved learning recommendations
 * - POST /api/recommendations/generate: Generates or updates recommendations
 * - GET /api/recommendations/skill/:analysisId/:skillName: Retrieves recommendation for an individual skill
 * - PATCH /api/recommendations/items/:itemId/status: Updates learning progress status of an item or step
 */

const LearningRecommendationService = require("../services/learningRecommendationService");

/**
 * GET /api/recommendations/:resumeId/:jobDescriptionId
 * Retrieves saved recommendations for the authenticated user's resume and job description.
 */
async function getRecommendations(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to access learning recommendations.",
    });
  }

  const resumeId = Number(req.params.resumeId);
  const jobId = Number(req.params.jobDescriptionId);

  if (!resumeId || !jobId || Number.isNaN(resumeId) || Number.isNaN(jobId) || resumeId <= 0 || jobId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid positive integers are required for resumeId and jobDescriptionId.",
    });
  }

  try {
    const result = await LearningRecommendationService.getRecommendations(resumeId, jobId, userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[RecommendationController] Get error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve learning recommendations.",
    });
  }
}

/**
 * POST /api/recommendations/generate
 * Generates personalized learning recommendations for missing and partially matched skills.
 */
async function generateRecommendations(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to generate learning recommendations.",
    });
  }

  const resumeId = req.body?.resumeId;
  const jobId = req.body?.jobDescriptionId || req.body?.jobId;
  const forceFallback = req.body?.forceFallback === true;

  if (!resumeId || !jobId) {
    return res.status(400).json({
      success: false,
      message: "Both resumeId and jobDescriptionId are required.",
    });
  }

  const numResumeId = Number(resumeId);
  const numJobId = Number(jobId);

  if (Number.isNaN(numResumeId) || Number.isNaN(numJobId) || numResumeId <= 0 || numJobId <= 0) {
    return res.status(400).json({
      success: false,
      message: "resumeId and jobDescriptionId must be positive integers.",
    });
  }

  try {
    const result = await LearningRecommendationService.generateRecommendations(numResumeId, numJobId, userId, {
      forceFallback,
    });

    return res.status(200).json({
      success: true,
      message: "Personalized learning recommendations generated successfully.",
      data: result,
    });
  } catch (error) {
    console.error("[RecommendationController] Generate error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to generate learning recommendations.",
    });
  }
}

/**
 * GET /api/recommendations/skill/:analysisId/:skillName
 * Retrieves the recommendation details for a single skill within an analysis.
 */
async function getSkillRecommendation(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const analysisId = Number(req.params.analysisId);
  const skillName = req.params.skillName ? decodeURIComponent(req.params.skillName) : "";

  if (!analysisId || !skillName || Number.isNaN(analysisId) || analysisId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid analysis ID and skill name are required.",
    });
  }

  try {
    const result = await LearningRecommendationService.getSkillRecommendation(analysisId, skillName, userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[RecommendationController] Skill recommendation error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve skill recommendation.",
    });
  }
}

/**
 * PATCH /api/recommendations/items/:itemId/status
 * Updates learning status of an item or a specific step within an item.
 */
async function updateRecommendationStatus(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const itemId = Number(req.params.itemId);

  if (!itemId || Number.isNaN(itemId) || itemId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid item ID is required.",
    });
  }

  const { status, stepIndex, stepStatus } = req.body || {};

  try {
    const result = await LearningRecommendationService.updateRecommendationItemStatus(
      itemId,
      { status, stepIndex, stepStatus },
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Learning status updated successfully.",
      data: result,
    });
  } catch (error) {
    console.error("[RecommendationController] Update status error:", error.message);
    const code = error.status || 500;
    return res.status(code).json({
      success: false,
      message: error.message || "Failed to update learning status.",
    });
  }
}

module.exports = {
  getRecommendations,
  generateRecommendations,
  getSkillRecommendation,
  updateRecommendationStatus,
};

