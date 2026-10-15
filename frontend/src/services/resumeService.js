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
 * Retrieves metadata for a specific resume owned by the current authenticated user.
 *
 * @param {number|string} id - Resume ID
 * @returns {Promise<{ success: boolean, resume: Object }>}
 */
export async function getResumeById(id) {
  const response = await api.get(`/resumes/${id}`)
  return response.data
}

export default {
  uploadResume,
  getResumes,
  getResumeById,
}
