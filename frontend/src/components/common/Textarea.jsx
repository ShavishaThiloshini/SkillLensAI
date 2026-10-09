import { useId } from 'react'
import styles from './Input.module.css'

/**
 * SkillLens AI — Textarea component
 */
function Textarea({
  label,
  id: propId,
  placeholder,
  helperText,
  errorText,
  required = false,
  disabled = false,
  rows = 4,
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
      <textarea
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        aria-invalid={hasError}
        aria-describedby={
          hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined
        }
        className={[
          styles.textarea,
          hasError ? styles['textarea--error'] : '',
          disabled ? styles['textarea--disabled'] : '',
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

export default Textarea
