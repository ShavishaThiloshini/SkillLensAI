/**
 * SkillLens AI — Skill Matching Controller
 * Day 20: Skill Matching Engine API Endpoints
 *
 * Exposes:
 * - POST /api/matching/run: Runs deterministic matching between saved resume and job description
 * - GET /api/matching/:resumeId/:jobDescriptionId: Retrieves persisted match results
 */

const SkillMatchingService = require("../services/skillMatchingService");

/**
 * POST /api/matching/run
 * Authenticates user, verifies ownership, and executes matching engine.
 */
async function runMatching(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to perform skill matching.",
    });
  }

  // Support both jobDescriptionId and jobId in payload
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
    const result = await SkillMatchingService.runMatching(numResumeId, numJobId, userId, {
      forceFallback,
    });

    return res.status(200).json({
      success: true,
      message: "Skill matching completed successfully.",
      data: result,
    });
  } catch (error) {
    console.error("[MatchingController] Matching error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to execute skill matching.",
    });
  }
}

/**
 * GET /api/matching/:resumeId/:jobDescriptionId
 * Retrieves saved match analysis and skill comparison results.
 */
async function getSavedMatching(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const resumeId = Number(req.params.resumeId);
  const jobId = Number(req.params.jobDescriptionId);

  if (!resumeId || !jobId || Number.isNaN(resumeId) || Number.isNaN(jobId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid resume ID or job description ID.",
    });
  }

  try {
    const result = await SkillMatchingService.getSavedMatching(resumeId, jobId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No saved skill matching results found for this resume and job description.",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[MatchingController] Retrieve error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve matching results.",
    });
  }
}

module.exports = {
  runMatching,
  getSavedMatching,
};
