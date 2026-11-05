import api from './api'

/**
 * SkillLens AI — Skill Gap Roadmap Service
 * Day 26: Client service for generating and tracking personalized learning roadmaps.
 */

/**
 * Generates or recalculates a personalized learning roadmap for a resume and job description.
 *
 * @param {Object} params
 * @param {number|string} params.resumeId
 * @param {number|string} params.jobDescriptionId
 * @param {boolean} [params.forceFallback]
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function generateRoadmap({ resumeId, jobDescriptionId, forceFallback = false }) {
  const response = await api.post('/roadmap/generate', {
    resumeId: Number(resumeId),
    jobDescriptionId: Number(jobDescriptionId),
    forceFallback,
  })
  return response.data
}

/**
 * Retrieves previously generated roadmap and progress.
 *
 * @param {number|string} resumeId
 * @param {number|string} jobDescriptionId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getSavedRoadmap(resumeId, jobDescriptionId) {
  const response = await api.get(`/roadmap/${resumeId}/${jobDescriptionId}`)
  return response.data
}

/**
 * Updates status of a roadmap item or specific learning step.
 *
 * @param {number|string} itemId
 * @param {Object} updateData
 * @param {string} [updateData.status] - 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
 * @param {number} [updateData.stepIndex] - 1-based step index
 * @param {string} [updateData.stepStatus] - 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function updateRoadmapItemStatus(itemId, updateData) {
  const response = await api.patch(`/roadmap/items/${itemId}/status`, updateData)
  return response.data
}

/**
 * Resets learning progress for all items in an analysis back to NOT_STARTED.
 *
 * @param {number|string} analysisId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function resetRoadmapProgress(analysisId) {
  const response = await api.post(`/roadmap/reset/${analysisId}`)
  return response.data
}

