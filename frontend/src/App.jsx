import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import UIShowcase from './components/layout/Showcase'
import Login from './pages/Login'
import Register from './pages/Register'
import { ProtectedRoute, PublicOnlyRoute } from './components/common/ProtectedRoute'
import { useAuth } from './context/useAuth'

/**
 * SkillLens AI — App Router
 *
 * Day 08: Authentication UI & State Management.
 * Routes:
 *  /           → dynamic redirect (/dashboard if authenticated, else /login)
 *  /login      → public only (redirects to /dashboard if logged in)
 *  /register   → public only (redirects to /dashboard if logged in)
 *  /showcase   → UI component showcase (development only)
 *  /dashboard  → protected via ProtectedRoute + AppLayout
 *  /resumes    → protected via ProtectedRoute + AppLayout
 *  /jobs       → protected via ProtectedRoute + AppLayout
 *  /history    → protected via ProtectedRoute + AppLayout
 *  /roadmap    → protected via ProtectedRoute + AppLayout
 *  /profile    → protected via ProtectedRoute + AppLayout
 *  /settings   → protected via ProtectedRoute + AppLayout
 */
function RootRedirect() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

function PlaceholderPage({ title }) {
  const { user } = useAuth()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40vh',
      gap: 'var(--space-3)',
      color: 'var(--color-text-secondary)',
      textAlign: 'center',
    }}>
      <h2 style={{ color: 'var(--color-text-primary)', margin: 0 }}>{title}</h2>
      {user && (
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-indigo)' }}>
          Welcome back, {user.full_name}!
        </p>
      )}
      <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
        This page will be implemented in a future development day.
      </p>
    </div>
  )
}

function App() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Guest-only Authentication routes */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />

      {/* UI Showcase — public preview wrapped in AppLayout */}
      <Route
        path="/showcase"
        element={
          <AppLayout>
            <UIShowcase />
          </AppLayout>
        }
      />

      {/* Protected application pages */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Dashboard" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/resumes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="My Resumes" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Job Descriptions" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Analysis History" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/roadmap"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Learning Roadmap" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Profile" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Settings" />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

export default App
