import { AlertTriangle } from 'lucide-react'
import Button from './Button'
import styles from './ErrorState.module.css'

/**
 * SkillLens AI — ErrorState component
 *
 * Error display panel with optional retry action.
 */
function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  icon: Icon = AlertTriangle,
  className = '',
}) {
  return (
    <section
      className={[styles.container, className].filter(Boolean).join(' ')}
      role="alert"
      aria-label={title}
    >
      <div className={styles.icon} aria-hidden="true">
        <Icon size={40} />
      </div>

      <h2 className={styles.title}>{title}</h2>

      {message && (
        <p className={styles.message}>{message}</p>
      )}

      {onRetry && (
        <div className={styles.retryButton}>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </section>
  )
}

export default ErrorState
