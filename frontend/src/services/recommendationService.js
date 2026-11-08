import api from './api'

/**
 * SkillLens AI — Learning Recommendation Client Service
 * Day 28: Client API calls for personalized learning recommendations.
 */

/**
 * Retrieves saved learning recommendations for a resume and job description.
 *
 * @param {number|string} resumeId
 * @param {number|string} jobDescriptionId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getRecommendations(resumeId, jobDescriptionId) {
  const response = await api.get(`/recommendations/${resumeId}/${jobDescriptionId}`)
  return response.data
}

/**
 * Generates personalized learning recommendations.
 *
 * @param {Object} params
 * @param {number|string} params.resumeId
 * @param {number|string} params.jobDescriptionId
 * @param {boolean} [params.forceFallback]
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function generateRecommendations({ resumeId, jobDescriptionId, forceFallback = false }) {
  const response = await api.post('/recommendations/generate', {
    resumeId: Number(resumeId),
    jobDescriptionId: Number(jobDescriptionId),
    forceFallback,
  })
  return response.data
}

/**
 * Retrieves recommendation details for an individual skill.
 *
 * @param {number|string} analysisId
 * @param {string} skillName
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getSkillRecommendation(analysisId, skillName) {
  const encoded = encodeURIComponent(skillName)
  const response = await api.get(`/recommendations/skill/${analysisId}/${encoded}`)
  return response.data
}

/**
 * Updates learning status of a recommendation item or specific stage.
 *
 * @param {number|string} itemId
 * @param {Object} updateData
 * @param {string} [updateData.status] - 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
 * @param {number} [updateData.stepIndex] - 1-based step index
 * @param {string} [updateData.stepStatus] - 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function updateRecommendationStatus(itemId, updateData) {
  const response = await api.patch(`/recommendations/items/${itemId}/status`, updateData)
  return response.data
}

