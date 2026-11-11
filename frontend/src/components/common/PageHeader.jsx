import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import styles from './PageHeader.module.css'

/**
 * SkillLens AI — PageHeader component
 *
 * Consistent page header with optional eyebrow, subtitle, back link, and actions.
 */
function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  backTo,
  className = '',
}) {
  return (
    <header
      className={[styles.header, className].filter(Boolean).join(' ')}
    >
      <div className={styles.left}>
        {backTo && (
          <Link to={backTo} className={styles.backLink} aria-label="Go back">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back</span>
          </Link>
        )}
        {eyebrow && (
          <span className={styles.eyebrow}>{eyebrow}</span>
        )}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && (
          <p className={styles.subtitle}>{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className={styles.actions} role="group" aria-label="Page actions">
          {actions}
        </div>
      )}
    </header>
  )
}

export default PageHeader
