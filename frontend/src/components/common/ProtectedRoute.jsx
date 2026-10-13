import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { PageLoader } from './Spinner'

/**
 * Route guard that requires authentication.
 * Redirects unauthenticated users to /login with state preservation.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <PageLoader message="Verifying session…" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

/**
 * Route guard for guest-only pages (e.g. /login, /register).
 * Redirects already authenticated users to /dashboard.
 */
export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <PageLoader message="Checking session…" />
  }

  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || '/dashboard'
    return <Navigate to={destination} replace />
  }

  return children
}

export default ProtectedRoute
