import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Sparkles,
  BarChart3,
  BookOpen,
  User,
  Settings,
  X,
  Scan,
  ChevronRight,
  LogOut,
  LogIn,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  {
    group: 'Main',
    items: [
      { label: 'Dashboard',        icon: LayoutDashboard, to: '/dashboard' },
      { label: 'My Resumes',       icon: FileText,        to: '/resumes' },
      { label: 'Job Descriptions', icon: Briefcase,       to: '/jobs' },
      { label: 'Skill Matching',   icon: Sparkles,        to: '/matching' },
      { label: 'Analysis History', icon: BarChart3,       to: '/history' },
      { label: 'Learning Roadmap', icon: BookOpen,        to: '/roadmap' },
    ],
  },
  {
    group: 'Account',
    items: [
      { label: 'Profile',  icon: User,     to: '/profile' },
      { label: 'Settings', icon: Settings, to: '/settings' },
    ],
  },
]

/**
 * SkillLens AI — Application Sidebar
 *
 * Collapsible on mobile, fixed on desktop.
 * isOpen / onClose controlled by parent (AppLayout).
 * Displays user profile and logout action when authenticated.
 */
function Sidebar({ isOpen, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const handleLogout = async () => {
    onClose?.()
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {/* Backdrop (mobile only) */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={[styles.sidebar, isOpen ? styles['sidebar--open'] : '']
          .filter(Boolean)
          .join(' ')}
        aria-label="Application navigation"
      >
        {/* ── Sidebar header ── */}
        <div className={styles.sidebarHeader}>
          <Link to="/" className={styles.brand} onClick={onClose} aria-label="SkillLens AI home">
            <span className={styles.brandIcon} aria-hidden="true">
              <Scan size={20} strokeWidth={2.2} />
            </span>
            <span className={styles.brandName}>
              SkillLens <span className={styles.brandAi}>AI</span>
            </span>
          </Link>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className={styles.nav} aria-label="Sidebar navigation">
          {isAuthenticated ? (
            NAV_ITEMS.map((group) => (
              <div key={group.group} className={styles.navGroup}>
                <span className={styles.groupLabel} aria-hidden="true">
                  {group.group}
                </span>
                <ul className={styles.navList} role="list">
                  {group.items.map(({ label, icon: Icon, to }) => {
                    const active = isActive(to)
                    return (
                      <li key={to}>
                        <Link
                          to={to}
                          onClick={onClose}
                          className={[
                            styles.navLink,
                            active ? styles['navLink--active'] : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-current={active ? 'page' : undefined}
                        >
                          <span className={styles.navIcon} aria-hidden="true">
                            <Icon size={18} strokeWidth={1.8} />
                          </span>
                          <span className={styles.navLabel}>{label}</span>
                          {active && (
                            <ChevronRight size={14} className={styles.activeChevron} aria-hidden="true" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          ) : (
            <div className={styles.navGroup}>
              <span className={styles.groupLabel} aria-hidden="true">
                Account
              </span>
              <ul className={styles.navList} role="list">
                <li>
                  <Link to="/login" onClick={onClose} className={styles.navLink}>
                    <span className={styles.navIcon} aria-hidden="true">
                      <LogIn size={18} strokeWidth={1.8} />
                    </span>
                    <span className={styles.navLabel}>Sign In</span>
                  </Link>
                </li>
                <li>
                  <Link to="/register" onClick={onClose} className={styles.navLink}>
                    <span className={styles.navIcon} aria-hidden="true">
                      <UserPlus size={18} strokeWidth={1.8} />
                    </span>
                    <span className={styles.navLabel}>Create Account</span>
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </nav>

        {/* ── Footer ── */}
        <div className={styles.sidebarFooter}>
          {isAuthenticated && (
            <>
              <div className={styles.userSection}>
                <span className={styles.userName}>{user?.full_name || 'SkillLens User'}</span>
                <span className={styles.userEmail}>{user?.email || ''}</span>
              </div>
              <button
                type="button"
                className={styles.logoutBtn}
                onClick={handleLogout}
                aria-label="Log out of application"
              >
                <LogOut size={16} aria-hidden="true" />
                <span>Log Out</span>
              </button>
            </>
          )}
          <p className={styles.footerTagline}>See your skills. Find your gaps.</p>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
