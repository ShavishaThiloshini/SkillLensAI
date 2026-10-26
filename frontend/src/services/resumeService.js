import api from './api'

/**
 * SkillLens AI — Resume API Service
 * Handles authenticated resume upload and retrieval requests.
 */

/**
 * Uploads a resume file (PDF or DOCX) with optional progress tracking.
 *
 * @param {File} file - The selected resume file
 * @param {Function} [onUploadProgress] - Optional axios progress callback
 * @returns {Promise<{ success: boolean, message: string, resume: Object }>}
 */
export async function uploadResume(file, onUploadProgress) {
  const formData = new FormData()
  // Expected multipart field name is 'resume'
  formData.append('resume', file)

  const response = await api.post('/resumes', formData, {
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        onUploadProgress(percentCompleted)
      }
    },
  })

  return response.data
}

/**
 * Retrieves all resumes uploaded by the current authenticated user.
 *
 * @returns {Promise<{ success: boolean, resumes: Array<Object> }>}
 */
export async function getResumes() {
  const response = await api.get('/resumes')
  return response.data
}

/**
 * Retrieves metadata and extracted structured information for a specific resume.
 *
 * @param {number|string} id - Resume ID
 * @returns {Promise<{ success: boolean, resume: Object }>}
 */
export async function getResumeById(id) {
  const response = await api.get(`/resumes/${id}`)
  return response.data
}

/**
 * Triggers backend text extraction and section parsing for a stored resume.
 *
 * @param {number|string} id - Resume ID
 * @returns {Promise<{ success: boolean, resumeId: number, processing_status: string, message: string, structuredData?: Object, structuredModel?: Object }>}
 */
export async function extractResume(id) {
  const response = await api.post(`/resumes/${id}/extract`)
  return response.data
}

/**
 * Triggers backend structured resume parsing and normalization (Day 12).
 *
 * @param {number|string} id - Resume ID
 * @returns {Promise<{ success: boolean, resumeId: number, processing_status: string, message: string, structuredModel: Object, warnings: string[] }>}
 */
export async function parseResume(id) {
  const response = await api.post(`/resumes/${id}/parse`)
  return response.data
}

/**
 * Deletes a resume owned by the current authenticated user.
 *
 * @param {number|string} id - Resume ID
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function deleteResume(id) {
  const response = await api.delete(`/resumes/${id}`)
  return response.data
}

/**
 * Replaces an existing resume with a newly selected PDF or DOCX file.
 *
 * @param {number|string} id - Resume ID
 * @param {File} file - Replacement file
 * @param {Function} [onUploadProgress] - Optional progress callback
 * @returns {Promise<{ success: boolean, message: string, resume: Object }>}
 */
export async function replaceResume(id, file, onUploadProgress) {
  const formData = new FormData()
  formData.append('resume', file)

  const response = await api.put(`/resumes/${id}/file`, formData, {
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        onUploadProgress(percentCompleted)
      }
    },
  })

  return response.data
}

/**
 * Triggers Day 19 AI-powered skill extraction for a stored resume.
 *
 * @param {number|string} id - Resume ID
 * @param {Object} [options]
 * @param {boolean} [options.forceFallback] - Force deterministic fallback
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function extractResumeSkills(id, options = {}) {
  const response = await api.post(`/resumes/${id}/skills/extract`, options)
  return response.data
}

/**
 * Retrieves saved extracted skills for a stored resume (Day 19).
 *
 * @param {number|string} id - Resume ID
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getResumeSkills(id) {
  const response = await api.get(`/resumes/${id}/skills`)
  return response.data
}

export default {
  uploadResume,
  getResumes,
  getResumeById,
  extractResume,
  parseResume,
  deleteResume,
  replaceResume,
  extractResumeSkills,
  getResumeSkills,
}


