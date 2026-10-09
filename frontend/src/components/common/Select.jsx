import { useId } from 'react'
import styles from './Input.module.css'

/**
 * SkillLens AI — Select component
 *
 * options: Array<{ value: string, label: string }>
 */
function Select({
  label,
  id: propId,
  options = [],
  placeholder = 'Select an option',
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
      <div className={styles.selectWrapper}>
        <select
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className={[
            styles.select,
            hasError ? styles['select--error'] : '',
            disabled ? styles['select--disabled'] : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
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

export default Select
