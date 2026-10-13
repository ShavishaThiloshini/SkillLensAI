import api from './api'

const TOKEN_KEY = 'skilllens_token'

export const authService = {
  /**
   * Register a new user
   */
  async register({ full_name, email, password }) {
    const response = await api.post('/auth/register', {
      full_name,
      email,
      password,
    })
    return response.data
  },

  /**
   * Log in an existing user
   */
  async login({ email, password }) {
    const response = await api.post('/auth/login', {
      email,
      password,
    })
    return response.data
  },

  /**
   * Log out the current session
   */
  async logout() {
    try {
      await api.post('/auth/logout')
    } catch (err) {
      // Even if network fails on logout, client-side session cleanup should proceed
      console.warn('Backend logout notification warning:', err.message)
    } finally {
      authService.removeToken()
    }
  },

  /**
   * Fetch current authenticated user profile
   */
  async getCurrentUser() {
    const response = await api.get('/auth/me')
    return response.data
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    }
  },

  removeToken() {
    localStorage.removeItem(TOKEN_KEY)
  },
}

export default authService
