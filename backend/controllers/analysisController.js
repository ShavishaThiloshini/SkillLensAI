/**
 * SkillLens AI — Analysis History Controller
 * Day 27: Analysis History & Snapshot API Endpoints
 *
 * Exposes:
 * - GET /api/analyses/history (or GET /api/analyses): Retrieves paginated, filtered, and sorted history
 * - GET /api/analyses/:id: Retrieves an immutable historical analysis snapshot
 * - DELETE /api/analyses/:id: Deletes an analysis record owned by the authenticated user
 * - POST /api/analyses: Creates a new analysis snapshot
 */

const AnalysisHistoryService = require("../services/analysisHistoryService");

/**
 * GET /api/analyses/history
 * Retrieves the authenticated user's analysis history with search, filtering, and sorting.
 */
async function getAnalysisHistory(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to access analysis history.",
    });
  }

  const {
    search,
    match,
    status,
    dateRange,
    startDate,
    endDate,
    sortBy,
    page,
    limit,
  } = req.query || {};

  try {
    const result = await AnalysisHistoryService.getHistory(userId, {
      search,
      match,
      status,
      dateRange,
      startDate,
      endDate,
      sortBy,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[AnalysisController] History error:", error.message);
    const code = error.status || 500;
    return res.status(code).json({
      success: false,
      message: error.message || "Failed to retrieve analysis history.",
    });
  }
}

/**
 * GET /api/analyses/:id
 * Retrieves one historical analysis snapshot by ID without recalculating scores.
 */
async function getHistoricalAnalysis(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const analysisId = Number(req.params.id);

  if (!analysisId || Number.isNaN(analysisId) || analysisId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid analysis ID is required.",
    });
  }

  try {
    const result = await AnalysisHistoryService.getAnalysisById(analysisId, userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[AnalysisController] Get analysis error:", error.message);
    const code = error.status || 500;
    return res.status(code).json({
      success: false,
      message: error.message || "Failed to retrieve historical analysis.",
    });
  }
}

/**
 * DELETE /api/analyses/:id
 * Deletes an analysis record owned by the authenticated user.
 */
async function deleteAnalysis(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const analysisId = Number(req.params.id);

  if (!analysisId || Number.isNaN(analysisId) || analysisId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid analysis ID is required.",
    });
  }

  try {
    const result = await AnalysisHistoryService.deleteAnalysis(analysisId, userId);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: { deletedId: result.deletedId },
    });
  } catch (error) {
    console.error("[AnalysisController] Delete analysis error:", error.message);
    const code = error.status || 500;
    return res.status(code).json({
      success: false,
      message: error.message || "Failed to delete analysis record.",
    });
  }
}

/**
 * POST /api/analyses
 * Creates a new analysis snapshot.
 */
async function createAnalysis(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to run analysis.",
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
    const result = await AnalysisHistoryService.createAnalysisSnapshot(numResumeId, numJobId, userId, {
      forceFallback,
    });

    return res.status(201).json({
      success: true,
      message: "Analysis completed and saved to history.",
      data: result,
    });
  } catch (error) {
    console.error("[AnalysisController] Create analysis error:", error.message);
    const code = error.status || 500;
    return res.status(code).json({
      success: false,
      message: error.message || "Failed to execute analysis.",
    });
  }
}

module.exports = {
  getAnalysisHistory,
  getHistoricalAnalysis,
  deleteAnalysis,
  createAnalysis,
};

