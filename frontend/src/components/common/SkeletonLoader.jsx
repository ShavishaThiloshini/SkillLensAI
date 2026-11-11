import styles from './SkeletonLoader.module.css'

/**
 * SkillLens AI — SkeletonLoader component
 *
 * Animated skeleton loading placeholders.
 *
 * Variants: text | title | avatar | card | paragraph
 */
function SkeletonLoader({
  variant = 'text',
  width,
  height,
  count = 1,
  className = '',
}) {
  const customStyle = {}
  if (width) customStyle.width = width
  if (height) customStyle.height = height

  /* ── Paragraph: multiple lines ── */
  if (variant === 'paragraph') {
    return (
      <div
        className={[styles.paragraph, className].filter(Boolean).join(' ')}
        role="status"
        aria-label="Loading content"
      >
        <span className="sr-only">Loading…</span>
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={[
              styles.paragraphLine,
              i === count - 1 && count > 1 ? styles.paragraphLineLast : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          />
        ))}
      </div>
    )
  }

  /* ── Card variant ── */
  if (variant === 'card') {
    return (
      <div
        className={[styles.card, className].filter(Boolean).join(' ')}
        style={customStyle}
        role="status"
        aria-label="Loading content"
      >
        <span className="sr-only">Loading…</span>
        <span className={[styles.cardLine, styles.cardTitle].join(' ')} aria-hidden="true" />
        <span className={[styles.cardLine, styles.cardText].join(' ')} aria-hidden="true" />
        <span className={[styles.cardLine, styles.cardText].join(' ')} aria-hidden="true" />
        <span className={[styles.cardLine, styles.cardTextShort].join(' ')} aria-hidden="true" />
        <span className={[styles.cardLine, styles.cardButton].join(' ')} aria-hidden="true" />
      </div>
    )
  }

  /* ── Single shape: text | title | avatar ── */
  const variantClass = {
    text: styles.text,
    title: styles.titleVariant,
    avatar: styles.avatar,
  }[variant]

  return (
    <span
      className={[styles.skeleton, variantClass, className]
        .filter(Boolean)
        .join(' ')}
      style={customStyle}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading…</span>
    </span>
  )
}

/**
 * SkeletonCard — convenience wrapper that renders a card-shaped skeleton
 * with a title line, 3 text lines, and a button line.
 */
function SkeletonCard({ className = '' }) {
  return <SkeletonLoader variant="card" className={className} />
}

export { SkeletonCard }
export default SkeletonLoader
