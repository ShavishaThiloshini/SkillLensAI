import styles from './StatusBadge.module.css'

/**
 * SkillLens AI — StatusBadge component
 *
 * Small colored badge/pill for status indicators.
 *
 * Statuses: success | warning | danger | info | neutral | processing
 * Sizes:    sm | md
 */
function StatusBadge({
  status,
  label,
  size = 'sm',
  icon: Icon,
  dot = false,
  className = '',
}) {
  const iconSize = size === 'sm' ? 12 : 14

  return (
    <span
      className={[
        styles.badge,
        styles[size],
        styles[status],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
    >
      {dot && !Icon && (
        <span className={styles.dot} aria-hidden="true" />
      )}
      {Icon && !dot && (
        <span className={styles.icon} aria-hidden="true">
          <Icon size={iconSize} />
        </span>
      )}
      {label}
    </span>
  )
}

export default StatusBadge
