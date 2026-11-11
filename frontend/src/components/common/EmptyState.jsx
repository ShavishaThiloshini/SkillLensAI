import styles from './EmptyState.module.css'

/**
 * SkillLens AI — EmptyState component
 *
 * Centered panel for when there is no data to display.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}) {
  return (
    <section
      className={[styles.container, className].filter(Boolean).join(' ')}
      aria-label={title}
    >
      {Icon && (
        <div className={styles.icon} aria-hidden="true">
          <Icon size={40} />
        </div>
      )}

      <h2 className={styles.title}>{title}</h2>

      {description && (
        <p className={styles.description}>{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className={styles.actions}>
          {action}
          {secondaryAction}
        </div>
      )}
    </section>
  )
}

export default EmptyState
