import api from './api'

/**
 * SkillLens AI — Career Insights Client Service
 * Day 30: Client API calls for career insights, readiness, and development guidance.
 */

/**
 * Retrieves saved career insights for a resume and job description.
 *
 * @param {number|string} resumeId
 * @param {number|string} jobId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getCareerInsights(resumeId, jobId) {
  const response = await api.get(`/career-insights/${resumeId}/${jobId}`)
  return response.data
}

/**
 * Generates fresh career insights across all 5 core sections.
 *
 * @param {Object} params
 * @param {number|string} params.resumeId
 * @param {number|string} params.jobId
 * @param {boolean} [params.forceFallback]
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function generateCareerInsights({ resumeId, jobId, forceFallback = false }) {
  const response = await api.post('/career-insights/generate', {
    resumeId: Number(resumeId),
    jobId: Number(jobId),
    forceFallback,
  })
  return response.data
}

/**
 * Retrieves career readiness assessment and dimensional breakdown.
 *
 * @param {number|string} resumeId
 * @param {number|string} jobId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getCareerReadiness(resumeId, jobId) {
  const response = await api.get(`/career-insights/readiness/${resumeId}/${jobId}`)
  return response.data
}

