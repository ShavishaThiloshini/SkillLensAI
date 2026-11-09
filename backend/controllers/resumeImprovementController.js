/**
 * SkillLens AI — Resume Improvement Controller
 * Day 29: AI-Powered Resume Improvement Suggestions Endpoints
 *
 * Exposes:
 * - GET /api/resume-improvements/:resumeId/:jobId
 * - POST /api/resume-improvements/generate
 */

const ResumeImprovementService = require("../services/resumeImprovementService");

/**
 * GET /api/resume-improvements/:resumeId/:jobId
 * Retrieves saved suggestions or generates them if not yet created.
 */
async function getSuggestions(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to access resume improvement suggestions.",
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
    const result = await ResumeImprovementService.getSuggestions(resumeId, jobId, userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[ResumeImprovementController] Get error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve resume improvement suggestions.",
    });
  }
}

/**
 * POST /api/resume-improvements/generate
 * Generates fresh resume improvement suggestions across the 5 categories.
 */
async function generateSuggestions(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to generate resume improvement suggestions.",
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
    const result = await ResumeImprovementService.generateSuggestions(numResumeId, numJobId, userId, {
      forceFallback,
    });

    return res.status(200).json({
      success: true,
      message: "Resume improvement suggestions generated successfully.",
      data: result,
    });
  } catch (error) {
    console.error("[ResumeImprovementController] Generate error:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to generate resume improvement suggestions.",
    });
  }
}

module.exports = {
  getSuggestions,
  generateSuggestions,
};

