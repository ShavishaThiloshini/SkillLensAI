import api from './api'

/**
 * SkillLens AI — Resume Improvement Client Service
 * Day 29: Client API calls for AI-powered resume improvement suggestions.
 */

/**
 * Retrieves saved resume improvement suggestions or generates them if needed.
 *
 * @param {number|string} resumeId
 * @param {number|string} jobId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getResumeImprovements(resumeId, jobId) {
  const response = await api.get(`/resume-improvements/${resumeId}/${jobId}`)
  return response.data
}

/**
 * Generates fresh resume improvement suggestions across the 5 categories.
 *
 * @param {Object} params
 * @param {number|string} params.resumeId
 * @param {number|string} params.jobId
 * @param {boolean} [params.forceFallback]
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function generateResumeImprovements({ resumeId, jobId, forceFallback = false }) {
  const response = await api.post('/resume-improvements/generate', {
    resumeId: Number(resumeId),
    jobId: Number(jobId),
    forceFallback,
  })
  return response.data
}

