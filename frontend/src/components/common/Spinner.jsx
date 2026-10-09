import styles from './Spinner.module.css'

/**
 * SkillLens AI — Spinner component
 *
 * Sizes:  sm | md | lg | xl
 * Color:  'primary' | 'white' | 'inherit'
 */
function Spinner({ size = 'md', color = 'primary', label = 'Loading…' }) {
  return (
    <span
      className={[styles.spinner, styles[`spinner--${size}`], styles[`spinner--${color}`]]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label={label}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={styles.track}
        />
        <path
          d="M12 2 A10 10 0 0 1 22 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={styles.arc}
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * Page-level loading overlay
 */
export function PageLoader({ message = 'Loading…' }) {
  return (
    <div className={styles.pageLoader} role="status" aria-live="polite">
      <Spinner size="xl" />
      <p className={styles.pageLoaderText}>{message}</p>
    </div>
  )
}

export default Spinner
