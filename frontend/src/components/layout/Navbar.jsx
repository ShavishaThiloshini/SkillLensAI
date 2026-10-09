import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Scan, Bell, User, Menu, X } from 'lucide-react'
import styles from './Navbar.module.css'

/**
 * SkillLens AI — Top Navbar
 * Provides brand, notification icon, profile icon, and mobile menu toggle.
 */
function Navbar({ onToggleSidebar, sidebarOpen }) {
  const location = useLocation()

  return (
    <header className={styles.navbar} role="banner">
      <div className={styles.inner}>
        {/* ── Left: hamburger + brand ── */}
        <div className={styles.left}>
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
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className={styles.badge} aria-label="2 unread notifications">2</span>
          </button>

          <button
            type="button"
            className={styles.avatarBtn}
            aria-label="Open account menu"
          >
            <span className={styles.avatarInner} aria-hidden="true">
              <User size={16} />
            </span>
          </button>
        </nav>
      </div>
    </header>
  )
}

export default Navbar
