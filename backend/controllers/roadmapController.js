/**
 * SkillLens AI — Skill Gap Roadmap Controller
 * Day 26: Personalized Roadmap API Endpoints
 *
 * Exposes:
 * - POST /api/roadmap/generate: Generates or updates personalized learning roadmap
 * - GET /api/roadmap/:resumeId/:jobDescriptionId: Retrieves persisted roadmap & progress
 * - PATCH /api/roadmap/items/:itemId/status: Updates progress status of an item or step
 * - POST /api/roadmap/reset/:analysisId: Resets progress tracking for an analysis
 */

const SkillRoadmapService = require("../services/skillRoadmapService");

/**
 * POST /api/roadmap/generate
 * Authenticates user, verifies ownership, and executes roadmap engine.
 */
async function generateRoadmap(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to generate learning roadmap.",
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
    const result = await SkillRoadmapService.generateRoadmap(numResumeId, numJobId, userId, {
      forceFallback,
    });

    return res.status(200).json({
      success: true,
      message: "Personalized skill gap roadmap generated successfully.",
      data: result,
    });
  } catch (error) {
    console.error("[RoadmapController] Generation error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to generate skill gap roadmap.",
    });
  }
}

/**
 * GET /api/roadmap/:resumeId/:jobDescriptionId
 * Retrieves saved roadmap, current skills, and progress tracking.
 */
async function getSavedRoadmap(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const resumeId = Number(req.params.resumeId);
  const jobId = Number(req.params.jobDescriptionId);

  if (!resumeId || !jobId || Number.isNaN(resumeId) || Number.isNaN(jobId) || resumeId <= 0 || jobId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid resume ID or job description ID.",
    });
  }

  try {
    const result = await SkillRoadmapService.getSavedRoadmap(resumeId, jobId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No saved roadmap found for this resume and job description. Please generate one.",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[RoadmapController] Retrieval error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve learning roadmap.",
    });
  }
}

/**
 * PATCH /api/roadmap/items/:itemId/status
 * Updates learning status for a specific roadmap item or step.
 */
async function updateItemStatus(req, res) {
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

  if (!status && stepIndex === undefined) {
    return res.status(400).json({
      success: false,
      message: "Either status or stepIndex with stepStatus must be provided.",
    });
  }

  try {
    const updated = await SkillRoadmapService.updateItemStatus(itemId, userId, {
      status,
      stepIndex,
      stepStatus,
    });

    return res.status(200).json({
      success: true,
      message: "Learning progress updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("[RoadmapController] Status update error:", error.message);
    const code = error.status || 500;
    return res.status(code).json({
      success: false,
      message: error.message || "Failed to update learning progress.",
    });
  }
}

/**
 * POST /api/roadmap/reset/:analysisId
 * Resets learning progress for all items in an analysis back to NOT_STARTED.
 */
async function resetRoadmapProgress(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const analysisId = Number(req.params.analysisId);
  if (!analysisId || Number.isNaN(analysisId) || analysisId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid analysis ID is required.",
    });
  }

  try {
    const result = await SkillRoadmapService.resetRoadmapProgress(analysisId, userId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[RoadmapController] Reset error:", error.message);
    const code = error.status || 500;
    return res.status(code).json({
      success: false,
      message: error.message || "Failed to reset roadmap progress.",
    });
  }
}

module.exports = {
  generateRoadmap,
  getSavedRoadmap,
  updateItemStatus,
  resetRoadmapProgress,
};

