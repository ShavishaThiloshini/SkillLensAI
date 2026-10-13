import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Scan, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import styles from './Auth.module.css'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  // Form field states
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Clear field-specific error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
    if (serverError) {
      setServerError('')
    }
  }

  const validate = () => {
    const errors = {}
    const trimmedName = formData.fullName.trim()
    const trimmedEmail = formData.email.trim()

    if (!trimmedName) {
      errors.fullName = 'Full name is required.'
    }

    if (!trimmedEmail) {
      errors.email = 'Email address is required.'
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.'
    }

    if (!formData.password) {
      errors.password = 'Password is required.'
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.'
    } else if (!/[a-zA-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      errors.password = 'Password must include at least one letter and one number.'
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.'
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Prevent duplicate submissions
    if (submitting) return

    setServerError('')
    setSuccessMessage('')

    if (!validate()) {
      return
    }

    setSubmitting(true)

    try {
      const response = await register({
        full_name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      })

      setSuccessMessage(response?.message || 'Account created successfully! Redirecting…')

      // Short delay to let user see success message before redirect
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 700)
    } catch (err) {
      setServerError(
        err.message || 'Unable to complete registration. Please check your details and try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Live password strength hints
  const hasMinLength = formData.password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(formData.password)
  const hasNumber = /[0-9]/.test(formData.password)

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCardWrapper}>
        <div className={styles.authCard}>
          {/* Header & Brand */}
          <header className={styles.header}>
            <Link to="/" className={styles.brandLink} aria-label="SkillLens AI Home">
              <span className={styles.brandIcon} aria-hidden="true">
                <Scan size={22} strokeWidth={2.2} />
              </span>
              <span className={styles.brandName}>
                SkillLens <span className={styles.brandAi}>AI</span>
              </span>
            </Link>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>
              Start analyzing resumes, identifying skill gaps, and accelerating your career.
            </p>
          </header>

          {/* Error Banner */}
          {serverError && (
            <div className={`${styles.alert} ${styles['alert--error']}`} role="alert">
              <AlertCircle size={18} className={styles.alertIcon} aria-hidden="true" />
              <div className={styles.alertContent}>{serverError}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className={`${styles.alert} ${styles['alert--success']}`} role="status">
              <CheckCircle2 size={18} className={styles.alertIcon} aria-hidden="true" />
              <div className={styles.alertContent}>{successMessage}</div>
            </div>
          )}

          {/* Registration Form */}
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <Input
              id="fullName"
              name="fullName"
              label="Full Name"
              type="text"
              placeholder="e.g. Jane Doe"
              required
              value={formData.fullName}
              onChange={handleChange}
              errorText={fieldErrors.fullName}
              disabled={submitting}
              autoComplete="name"
            />

            <Input
              id="email"
              name="email"
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              required
              value={formData.email}
              onChange={handleChange}
              errorText={fieldErrors.email}
              disabled={submitting}
              autoComplete="email"
            />

            <Input
              id="password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={handleChange}
              errorText={fieldErrors.password}
              disabled={submitting}
              autoComplete="new-password"
              rightAction={
                <button
                  type="button"
                  className={styles.togglePasswordBtn}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            {/* Password checklist criteria */}
            <div className={styles.passwordChecklist} aria-label="Password requirements">
              <div
                className={`${styles.checkItem} ${
                  hasMinLength ? styles['checkItem--valid'] : ''
                }`}
              >
                <span>{hasMinLength ? '✓' : '•'} At least 8 characters</span>
              </div>
              <div
                className={`${styles.checkItem} ${
                  hasLetter && hasNumber ? styles['checkItem--valid'] : ''
                }`}
              >
                <span>{hasLetter && hasNumber ? '✓' : '•'} Letters and numbers</span>
              </div>
            </div>

            <Input
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              errorText={fieldErrors.confirmPassword}
              disabled={submitting}
              autoComplete="new-password"
              rightAction={
                <button
                  type="button"
                  className={styles.togglePasswordBtn}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  tabIndex={0}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={submitting}
            >
              Create Account
            </Button>
          </form>

          {/* Footer Navigation */}
          <footer className={styles.footerText}>
            Already have an account?
            <Link to="/login" className={styles.footerLink}>
              Sign In
            </Link>
          </footer>
        </div>

        {/* Security & Trust note */}
        <div className={styles.trustBadge}>
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Your credentials and resume data are securely encrypted.</span>
        </div>
      </div>
    </div>
  )
}

export default Register
