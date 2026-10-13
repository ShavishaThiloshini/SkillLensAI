import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

/**
 * SkillLens AI — Central Axios Client
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// Attach stored JWT token to every request if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('skilllens_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for consistent error normalization
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if network error or server down
    if (!error.response) {
      const networkError = new Error(
        'Unable to reach SkillLens AI service. Please verify your connection or try again later.'
      )
      networkError.isNetworkError = true
      return Promise.reject(networkError)
    }

    // Server responded with an error status
    const message =
      error.response.data?.message ||
      (error.response.status === 401
        ? 'Authentication required or session expired.'
        : error.response.status === 403
        ? 'Access forbidden.'
        : error.response.status === 404
        ? 'Requested resource was not found.'
        : error.response.status >= 500
        ? 'SkillLens AI service error. Please try again shortly.'
        : 'An unexpected error occurred. Please check your inputs.')

    const normalizedError = new Error(message)
    normalizedError.status = error.response.status
    normalizedError.data = error.response.data

    return Promise.reject(normalizedError)
  }
)

export default api
