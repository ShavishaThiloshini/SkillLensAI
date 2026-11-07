import api from './api'

/**
 * SkillLens AI — Analysis Service
 * Day 27: Client service for retrieving analysis history, viewing historical snapshots,
 * and managing saved analyses.
 */

/**
 * Retrieves paginated analysis history with search, filtering, and sorting.
 *
 * @param {Object} [params]
 * @param {string} [params.search]
 * @param {string} [params.match] - 'all' | 'high' | 'medium' | 'low'
 * @param {string} [params.status] - 'all' | 'COMPLETED' | 'PROCESSING' | 'FAILED' | 'PENDING'
 * @param {string} [params.dateRange] - 'all' | '7d' | '30d' | '90d'
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @param {string} [params.sortBy] - 'most_recent' | 'oldest' | 'highest_match' | 'lowest_match'
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getAnalysisHistory(params = {}) {
  const response = await api.get('/analyses/history', { params })
  return response.data
}

/**
 * Retrieves an immutable historical analysis snapshot by ID without recalculating.
 *
 * @param {number|string} analysisId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getHistoricalAnalysis(analysisId) {
  const response = await api.get(`/analyses/${analysisId}`)
  return response.data
}

/**
 * Deletes a historical analysis record owned by the authenticated user.
 *
 * @param {number|string} analysisId
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function deleteAnalysis(analysisId) {
  const response = await api.delete(`/analyses/${analysisId}`)
  return response.data
}

/**
 * Creates and runs a new analysis snapshot.
 *
 * @param {Object} payload
 * @param {number|string} payload.resumeId
 * @param {number|string} payload.jobDescriptionId
 * @param {boolean} [payload.forceFallback]
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function createAnalysis(payload) {
  const response = await api.post('/analyses', payload)
  return response.data
}

