import { useState } from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import styles from './AppLayout.module.css'

/**
 * SkillLens AI — App Layout Shell
 * Wraps authenticated pages with Navbar + Sidebar + main content area.
 */
function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => setSidebarOpen((prev) => !prev)
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className={styles.layout}>
      <Navbar onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

      <div className={styles.body}>
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        <main
          className={styles.main}
          id="main-content"
          aria-label="Main content"
        >
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
