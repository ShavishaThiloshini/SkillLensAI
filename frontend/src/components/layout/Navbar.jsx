import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Scan, Bell, User, Menu, X, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import styles from './Navbar.module.css'

/**
 * SkillLens AI — Top Navbar
 * Provides brand, notification icon, profile menu, and mobile menu toggle.
 * Integrates authentication state for Sign In / Register / Logout.
 */
function Navbar({ onToggleSidebar, sidebarOpen }) {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className={styles.navbar} role="banner">
      <div className={styles.inner}>
        {/* ── Left: hamburger + brand ── */}
        <div className={styles.left}>
          {onToggleSidebar && (
            <button
              type="button"
              className={styles.menuBtn}
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={sidebarOpen}
              aria-controls="app-sidebar"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}

          <Link to="/" className={styles.brand} aria-label="SkillLens AI — Home">
            <span className={styles.brandIcon} aria-hidden="true">
              <Scan size={22} strokeWidth={2.2} />
            </span>
            <span className={styles.brandName}>
              SkillLens <span className={styles.brandAi}>AI</span>
            </span>
          </Link>
        </div>

        {/* ── Right: actions ── */}
        <nav className={styles.actions} aria-label="Account navigation">
          {loading ? (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Checking session…
            </span>
          ) : isAuthenticated ? (
            <>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className={styles.badge} aria-label="2 unread notifications">2</span>
              </button>

              <div className={styles.userMenuWrapper} ref={dropdownRef}>
                <button
                  type="button"
                  className={styles.avatarBtn}
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  aria-label="Open account menu"
                  aria-expanded={dropdownOpen}
                >
                  <span className={styles.avatarInner} aria-hidden="true">
                    <User size={16} />
                  </span>
                </button>

                {dropdownOpen && (
                  <div className={styles.userDropdown} role="menu">
                    <div className={styles.dropdownHeader}>
                      <div className={styles.dropdownName}>
                        {user?.full_name || 'SkillLens User'}
                      </div>
                      <div className={styles.dropdownEmail}>
                        {user?.email || ''}
                      </div>
                    </div>

                    <Link
                      to="/profile"
                      className={styles.dropdownItem}
                      onClick={() => setDropdownOpen(false)}
                      role="menuitem"
                    >
                      <User size={16} />
                      <span>My Profile</span>
                    </Link>

                    <Link
                      to="/settings"
                      className={styles.dropdownItem}
                      onClick={() => setDropdownOpen(false)}
                      role="menuitem"
                    >
                      <SettingsIcon size={16} />
                      <span>Settings</span>
                    </Link>

                    <button
                      type="button"
                      className={`${styles.dropdownItem} ${styles['dropdownItem--danger']}`}
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.unauthActions}>
              <Link to="/login" className={styles.signInLink}>
                Sign In
              </Link>
              <Link to="/register" className={styles.signUpBtn}>
                Get Started
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Navbar
