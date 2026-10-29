import api from './api'

/**
 * SkillLens AI — Skill Matching API Service
 * Day 20: Communicates with the backend skill matching engine.
 */

/**
 * Runs skill matching between a saved resume and a saved job description.
 *
 * @param {Object} params
 * @param {number|string} params.resumeId - ID of user's saved resume
 * @param {number|string} params.jobDescriptionId - ID of user's saved job description
 * @param {boolean} [params.forceFallback] - Force deterministic fallback without AI
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function runSkillMatching({ resumeId, jobDescriptionId, forceFallback = false }) {
  const response = await api.post('/matching/run', {
    resumeId: Number(resumeId),
    jobDescriptionId: Number(jobDescriptionId),
    forceFallback,
  })
  return response.data
}

/**
 * Retrieves previously saved matching results for a resume and job description.
 *
 * @param {number|string} resumeId
 * @param {number|string} jobDescriptionId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getSavedSkillMatching(resumeId, jobDescriptionId) {
  const response = await api.get(`/matching/${resumeId}/${jobDescriptionId}`)
  return response.data
}

/**
 * Calculates match score (skills, experience, education, overall) between a resume and job description.
 * Day 21 Match Score API.
 *
 * @param {Object} params
 * @param {number|string} params.resumeId
 * @param {number|string} params.jobDescriptionId
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function calculateMatchScore({ resumeId, jobDescriptionId }) {
  const response = await api.post('/matching/score', {
    resumeId: Number(resumeId),
    jobDescriptionId: Number(jobDescriptionId),
  })
  return response.data
}

/**
 * Retrieves previously saved match score for a resume and job description.
 *
 * @param {number|string} resumeId
 * @param {number|string} jobDescriptionId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getSavedMatchScore(resumeId, jobDescriptionId) {
  const response = await api.get(`/matching/score/${resumeId}/${jobDescriptionId}`)
  return response.data
}

export default {
  runSkillMatching,
  getSavedSkillMatching,
  calculateMatchScore,
  getSavedMatchScore,
}
