import { useId } from 'react'
import styles from './Input.module.css'

/**
 * SkillLens AI — Input component
 */
function Input({
  label,
  id: propId,
  type = 'text',
  placeholder,
  helperText,
  errorText,
  required = false,
  disabled = false,
  className = '',
  containerClassName = '',
  ...rest
}) {
  const autoId = useId()
  const id = propId || autoId
  const hasError = Boolean(errorText)

  return (
    <div className={[styles.field, containerClassName].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-label="required">
              *
            </span>
          )}
        </label>
      )}
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={hasError}
        aria-describedby={
          hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined
        }
        className={[
          styles.input,
          hasError ? styles['input--error'] : '',
          disabled ? styles['input--disabled'] : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
      {hasError && (
        <span id={`${id}-error`} className={styles.errorText} role="alert">
          {errorText}
        </span>
      )}
      {!hasError && helperText && (
        <span id={`${id}-helper`} className={styles.helperText}>
          {helperText}
        </span>
      )}
    </div>
  )
}

export default Input
