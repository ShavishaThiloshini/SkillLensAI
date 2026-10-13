import { useState, useEffect, useCallback } from 'react'
import { AuthContext } from './authContextInstance'
import authService from '../services/authService'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore authenticated session on initial mount
  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
      const token = authService.getToken()
      if (!token) {
        if (isMounted) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      try {
        const data = await authService.getCurrentUser()
        if (isMounted && data?.user) {
          setUser(data.user)
        } else if (isMounted) {
          authService.removeToken()
          setUser(null)
        }
      } catch (error) {
        // Token is invalid, expired, or server rejected it
        console.warn('Session verification notice:', error.message)
        authService.removeToken()
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [])

  /**
   * Log in user with credentials
   */
  const login = useCallback(async ({ email, password }) => {
    const data = await authService.login({ email, password })
    if (data?.token && data?.user) {
      authService.setToken(data.token)
      setUser(data.user)
    }
    return data
  }, [])

  /**
   * Register a new user account
   */
  const register = useCallback(async ({ full_name, email, password }) => {
    const data = await authService.register({ full_name, email, password })
    if (data?.token && data?.user) {
      authService.setToken(data.token)
      setUser(data.user)
    }
    return data
  }, [])

  /**
   * Log out user and clear state
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = {
    user,
    isAuthenticated: Boolean(user),
    loading,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext

