import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import UIShowcase from './components/layout/Showcase'

/**
 * SkillLens AI — App Router
 *
 * Day 07: UI Foundation only.
 * Authentication, dashboard and feature pages will be added in future days.
 *
 * Current routes:
 *  /           → redirects to /showcase (temporary)
 *  /showcase   → UI component showcase (development only)
 *  /dashboard  → placeholder via AppLayout
 *  /resumes    → placeholder via AppLayout
 *  /jobs       → placeholder via AppLayout
 *  /history    → placeholder via AppLayout
 *  /roadmap    → placeholder via AppLayout
 *  /profile    → placeholder via AppLayout
 *  /settings   → placeholder via AppLayout
 */
function PlaceholderPage({ title }) {
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
      <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
        This page will be implemented in a future development day.
      </p>
    </div>
  )
}

function App() {
  return (
    <Routes>
      {/* Temporary root redirect to showcase */}
      <Route path="/" element={<Navigate to="/showcase" replace />} />

      {/* UI Showcase — wrapped in AppLayout to demo nav components */}
      <Route
        path="/showcase"
        element={
          <AppLayout>
            <UIShowcase />
          </AppLayout>
        }
      />

      {/* Future application pages — placeholder until implemented */}
      <Route path="/dashboard" element={<AppLayout><PlaceholderPage title="Dashboard" /></AppLayout>} />
      <Route path="/resumes"   element={<AppLayout><PlaceholderPage title="My Resumes" /></AppLayout>} />
      <Route path="/jobs"      element={<AppLayout><PlaceholderPage title="Job Descriptions" /></AppLayout>} />
      <Route path="/history"   element={<AppLayout><PlaceholderPage title="Analysis History" /></AppLayout>} />
      <Route path="/roadmap"   element={<AppLayout><PlaceholderPage title="Learning Roadmap" /></AppLayout>} />
      <Route path="/profile"   element={<AppLayout><PlaceholderPage title="Profile" /></AppLayout>} />
      <Route path="/settings"  element={<AppLayout><PlaceholderPage title="Settings" /></AppLayout>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/showcase" replace />} />
    </Routes>
  )
}

export default App
