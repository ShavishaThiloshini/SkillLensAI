import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  BarChart3,
  BookOpen,
  User,
  Settings,
  X,
  Scan,
  ChevronRight,
} from 'lucide-react'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  {
    group: 'Main',
    items: [
      { label: 'Dashboard',        icon: LayoutDashboard, to: '/dashboard' },
      { label: 'My Resumes',       icon: FileText,        to: '/resumes' },
      { label: 'Job Descriptions', icon: Briefcase,       to: '/jobs' },
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
 */
function Sidebar({ isOpen, onClose }) {
  const location = useLocation()

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

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
          {NAV_ITEMS.map((group) => (
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
          ))}
        </nav>

        {/* ── Footer tag ── */}
        <div className={styles.sidebarFooter}>
          <p className={styles.footerTagline}>See your skills. Find your gaps.</p>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
