import { forwardRef } from 'react'
import Spinner from './Spinner'
import styles from './Button.module.css'

/**
 * SkillLens AI — Button component
 *
 * Variants: primary | secondary | outline | ghost | danger
 * Sizes:    sm | md | lg
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    fullWidth = false,
    type = 'button',
    className = '',
    onClick,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      className={[
        styles.btn,
        styles[`btn--${variant}`],
        styles[`btn--${size}`],
        fullWidth ? styles['btn--full'] : '',
        loading ? styles['btn--loading'] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      onClick={!isDisabled ? onClick : undefined}
      {...rest}
    >
      {loading && (
        <span className={styles.spinner} aria-hidden="true">
          <Spinner size="sm" color="inherit" />
        </span>
      )}
      {!loading && Icon && iconPosition === 'left' && (
        <span className={styles.icon} aria-hidden="true">
          <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
        </span>
      )}
      {children && <span className={styles.label}>{children}</span>}
      {!loading && Icon && iconPosition === 'right' && (
        <span className={styles.icon} aria-hidden="true">
          <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
        </span>
      )}
    </button>
  )
})

export default Button
