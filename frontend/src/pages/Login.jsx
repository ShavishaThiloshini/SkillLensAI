import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Scan, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import styles from './Auth.module.css'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  // Where to redirect after login (default /dashboard)
  const from = location.state?.from?.pathname || '/dashboard'

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
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
    const trimmedEmail = formData.email.trim()

    if (!trimmedEmail) {
      errors.email = 'Email address is required.'
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.'
    }

    if (!formData.password) {
      errors.password = 'Password is required.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Prevent duplicate submissions
    if (submitting) return

    setServerError('')

    if (!validate()) {
      return
    }

    setSubmitting(true)

    try {
      await login({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      })

      // Redirect to target or dashboard
      navigate(from, { replace: true })
    } catch (err) {
      setServerError(
        err.message || 'Unable to sign in. Please verify your credentials and try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

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
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>
              Sign in to access your resumes, benchmark skills, and track learning roadmaps.
            </p>
          </header>

          {/* Error Banner */}
          {serverError && (
            <div className={`${styles.alert} ${styles['alert--error']}`} role="alert">
              <AlertCircle size={18} className={styles.alertIcon} aria-hidden="true" />
              <div className={styles.alertContent}>{serverError}</div>
            </div>
          )}

          {/* Login Form */}
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
              autoFocus
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
              autoComplete="current-password"
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={submitting}
            >
              Sign In
            </Button>
          </form>

          {/* Footer Navigation */}
          <footer className={styles.footerText}>
            Don't have an account?
            <Link to="/register" className={styles.footerLink}>
              Create an account
            </Link>
          </footer>
        </div>

        {/* Security & Trust note */}
        <div className={styles.trustBadge}>
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Protected with industry-standard 256-bit encryption.</span>
        </div>
      </div>
    </div>
  )
}

export default Login
