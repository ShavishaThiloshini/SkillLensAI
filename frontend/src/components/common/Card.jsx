import styles from './Card.module.css'

/**
 * SkillLens AI — Card component
 *
 * Variants: default | elevated | outline | flat
 */
function Card({
  children,
  variant = 'default',
  className = '',
  padding = 'md',
  hover = false,
  onClick,
  ...rest
}) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      className={[
        styles.card,
        styles[`card--${variant}`],
        styles[`card--pad-${padding}`],
        hover || onClick ? styles['card--hover'] : '',
        onClick ? styles['card--clickable'] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      type={Tag === 'button' ? 'button' : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}

function CardHeader({ children, className = '' }) {
  return (
    <div className={[styles.cardHeader, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

function CardBody({ children, className = '' }) {
  return (
    <div className={[styles.cardBody, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

function CardFooter({ children, className = '' }) {
  return (
    <div className={[styles.cardFooter, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

function CardTitle({ children, className = '' }) {
  return (
    <h3 className={[styles.cardTitle, className].filter(Boolean).join(' ')}>
      {children}
    </h3>
  )
}

function CardDescription({ children, className = '' }) {
  return (
    <p className={[styles.cardDescription, className].filter(Boolean).join(' ')}>
      {children}
    </p>
  )
}

Card.Header = CardHeader
Card.Body = CardBody
Card.Footer = CardFooter
Card.Title = CardTitle
Card.Description = CardDescription

export default Card
