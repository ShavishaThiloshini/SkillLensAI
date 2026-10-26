import api from './api'

/**
 * SkillLens AI — Job Description API Service
 * Handles job description creation (pasted text & file upload) and retrieval.
 */

/**
 * Creates a job description from pasted text.
 *
 * @param {Object} params
 * @param {string} params.title - Target job title
 * @param {string} [params.company] - Company name (optional)
 * @param {string} params.description - Full text of the job description
 * @returns {Promise<{ success: boolean, message: string, job: Object }>}
 */
export async function createJobDescription({ title, company, description }) {
  const response = await api.post('/job-descriptions', {
    title,
    company: company || null,
    description,
  })
  return response.data
}

/**
 * Uploads a job description document (PDF or DOCX), extracts its text on the backend,
 * and saves the job description.
 *
 * @param {Object} params
 * @param {string} params.title - Target job title
 * @param {string} [params.company] - Company name (optional)
 * @param {File} params.file - PDF or DOCX file
 * @param {Function} [onUploadProgress] - Optional axios progress callback
 * @returns {Promise<{ success: boolean, message: string, job: Object, extractedCharCount?: number }>}
 */
export async function uploadJobDescription({ title, company, file }, onUploadProgress) {
  const formData = new FormData()
  formData.append('title', title)
  if (company) {
    formData.append('company', company)
  }
  formData.append('jobDescription', file)

  const response = await api.post('/job-descriptions/upload', formData, {
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
 * Retrieves all job descriptions belonging to the current authenticated user.
 *
 * @returns {Promise<{ success: boolean, jobs: Array<Object> }>}
 */
export async function getJobDescriptions() {
  const response = await api.get('/job-descriptions')
  return response.data
}

/**
 * Retrieves a single job description by ID.
 *
 * @param {number|string} id - Job description ID
 * @returns {Promise<{ success: boolean, job: Object }>}
 */
export async function getJobDescriptionById(id) {
  const response = await api.get(`/job-descriptions/${id}`)
  return response.data
}

/**
 * Triggers extraction of structured requirements (skills, experience, education,
 * tools, technologies, certifications) for a saved job description.
 *
 * @param {number|string} id - Job description ID
 * @returns {Promise<{ success: boolean, message: string, jobId: number, jobTitle: string, requirements: Object }>}
 */
export async function extractJobRequirements(id) {
  const response = await api.post(`/job-descriptions/${id}/extract-requirements`)
  return response.data
}

/**
 * Retrieves previously saved extracted requirements for a job description.
 *
 * @param {number|string} id - Job description ID
 * @returns {Promise<{ success: boolean, extracted: boolean, message?: string, jobId: number, jobTitle: string, requirements: Object|null }>}
 */
export async function getJobRequirements(id) {
  const response = await api.get(`/job-descriptions/${id}/requirements`)
  return response.data
}

/**
 * Triggers Day 19 AI-powered skill extraction for a saved job description.
 * Preserves required vs preferred classifications.
 *
 * @param {number|string} id - Job description ID
 * @param {Object} [options]
 * @param {boolean} [options.forceFallback] - Force deterministic fallback
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function extractJobSkills(id, options = {}) {
  const response = await api.post(`/job-descriptions/${id}/skills/extract`, options)
  return response.data
}

/**
 * Retrieves saved extracted skills for a job description (Day 19).
 *
 * @param {number|string} id - Job description ID
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getJobSkills(id) {
  const response = await api.get(`/job-descriptions/${id}/skills`)
  return response.data
}

export default {
  createJobDescription,
  uploadJobDescription,
  getJobDescriptions,
  getJobDescriptionById,
  extractJobRequirements,
  getJobRequirements,
  extractJobSkills,
  getJobSkills,
}

