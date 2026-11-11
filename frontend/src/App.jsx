import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import UIShowcase from './components/layout/Showcase'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ResumeDashboard from './pages/ResumeDashboard'
import JobDescriptions from './pages/JobDescriptions'
import JobAnalysis from './pages/JobAnalysis'
import SkillMatching from './pages/SkillMatching'
import AnalysisResults from './pages/AnalysisResults'
import AnalysisHistory from './pages/AnalysisHistory'
import Roadmap from './pages/Roadmap'
import Recommendations from './pages/Recommendations'
import ResumeImprovements from './pages/ResumeImprovements'
import CareerInsights from './pages/CareerInsights'
import ReportGeneration from './pages/ReportGeneration'
import Settings from './pages/Settings'
import { ProtectedRoute, PublicOnlyRoute } from './components/common/ProtectedRoute'
import PageHeader from './components/common/PageHeader'
import EmptyState from './components/common/EmptyState'
import { useAuth } from './context/useAuth'

/**
 * SkillLens AI — App Router
 *
 * Day 17: Job Analysis UI added.
 * Routes:
 *  /                    → dynamic redirect (/dashboard if authenticated, else /login)
 *  /login               → public only (redirects to /dashboard if logged in)
 *  /register            → public only (redirects to /dashboard if logged in)
 *  /showcase            → UI component showcase (development only)
 *  /dashboard           → protected via ProtectedRoute + AppLayout
 *  /resumes             → protected via ProtectedRoute + AppLayout
 *  /jobs                → protected via ProtectedRoute + AppLayout
 *  /jobs/:id/analysis   → protected via ProtectedRoute + AppLayout (Day 17)
 *  /history             → protected via ProtectedRoute + AppLayout
 *  /roadmap             → protected via ProtectedRoute + AppLayout
 *  /profile             → protected via ProtectedRoute + AppLayout
 *  /settings            → protected via ProtectedRoute + AppLayout
 */
function RootRedirect() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

function PlaceholderPage({ title }) {
  const { user } = useAuth()

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '640px', margin: '0 auto', paddingTop: 'var(--space-6)' }}>
      <PageHeader
        eyebrow="Account"
        title={title}
        subtitle={user ? `Signed in as ${user.full_name} (${user.email})` : 'User profile settings'}
      />
      <EmptyState
        title={`${title} is coming soon`}
        description="We're actively polishing and expanding this section. Check back in an upcoming update."
      />
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
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/resumes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ResumeDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedRoute>
            <AppLayout>
              <JobDescriptions />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:id/analysis"
        element={
          <ProtectedRoute>
            <AppLayout>
              <JobAnalysis />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/matching"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SkillMatching />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analysis-results"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AnalysisResults />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AnalysisHistory />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/roadmap"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Roadmap />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recommendations"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Recommendations />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/improvements"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ResumeImprovements />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/career-insights"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CareerInsights />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/insights"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CareerInsights />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ReportGeneration />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/:analysisId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ReportGeneration />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/report"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ReportGeneration />
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
              <Settings />
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
