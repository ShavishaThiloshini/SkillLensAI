import { useState, useEffect, useCallback } from 'react'
import {
  Cpu,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  User,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { testAiConnection, getAiStatus } from '../services/aiService'
import Spinner from '../components/common/Spinner'
import styles from './Settings.module.css'

const DEFAULT_PROMPT = 'In two concise sentences, summarize why continuous learning is essential for modern software engineers.'
const MAX_PROMPT_CHARS = 500

/**
 * SkillLens AI — Settings & AI Diagnostics Page
 *
 * Provides system status overview and allows testing live server-side
 * connectivity to the configured AI provider.
 */
export default function Settings() {
  const { user } = useAuth()

  // AI Status state
  const [statusLoading, setStatusLoading] = useState(true)
  const [aiStatus, setAiStatus] = useState(null)

  // AI Test state
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testError, setTestError] = useState(null)

  const fetchAiStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await getAiStatus()
      if (res.success && res.data) {
        setAiStatus(res.data)
      }
    } catch {
      setAiStatus({ configured: false, provider: 'openai', model: 'gpt-4o-mini' })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAiStatus()
  }, [fetchAiStatus])


  const handleRunTest = async () => {
    if (!prompt.trim() || prompt.length > MAX_PROMPT_CHARS) return

    setTesting(true)
    setTestResult(null)
    setTestError(null)

    try {
      const res = await testAiConnection(prompt.trim())
      if (res.success && res.data) {
        setTestResult(res.data)
      } else {
        setTestError('Unexpected response format received from AI service.')
      }
    } catch (err) {
      const errorMsg =
        err.message ||
        'Failed to connect to the AI service. Please ensure the backend server and AI credentials are properly configured.'
      setTestError(errorMsg)
    } finally {
      setTesting(false)
    }
  }

  const handleResetPrompt = () => {
    setPrompt(DEFAULT_PROMPT)
    setTestResult(null)
    setTestError(null)
  }

  const charsLeft = MAX_PROMPT_CHARS - prompt.length
  const isPromptValid = prompt.trim().length > 0 && prompt.length <= MAX_PROMPT_CHARS

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>System Settings & AI Diagnostics</h1>
        <p className={styles.subtitle}>
          Manage application preferences and verify server-side AI provider connectivity.
        </p>
      </div>

      {/* ── Account Summary Card ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <div className={styles.cardIcon}>
              <User size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Account Profile</h2>
              <p className={styles.cardDescription}>Authenticated user credentials and role</p>
            </div>
          </div>
        </div>

        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Full Name</span>
            <span className={styles.metaValue}>{user?.full_name || 'Authenticated User'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Email Address</span>
            <span className={styles.metaValue}>{user?.email || 'N/A'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Environment</span>
            <span className={styles.metaValue}>Vite + Express + MySQL</span>
          </div>
        </div>
      </div>

      {/* ── AI Integration Diagnostics Card ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <div className={styles.cardIcon}>
              <Cpu size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>AI Provider Integration</h2>
              <p className={styles.cardDescription}>
                Server-side LLM service for resume analysis and skill gap extraction
              </p>
            </div>
          </div>

          <div>
            {statusLoading ? (
              <span className={`${styles.statusBadge} ${styles.statusBadgeConfigured}`}>
                <Spinner size="xs" /> Checking status...
              </span>
            ) : aiStatus?.configured ? (
              <span className={`${styles.statusBadge} ${styles.statusBadgeConfigured}`}>
                <span className={styles.statusDot} />
                Configured ({aiStatus?.provider?.toUpperCase()})
              </span>
            ) : (
              <span className={`${styles.statusBadge} ${styles.statusBadgeNotConfigured}`}>
                <span className={styles.statusDot} />
                Not Configured
              </span>
            )}
          </div>
        </div>

        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Provider</span>
            <span className={styles.metaValue}>OpenAI</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Configured Model</span>
            <span className={styles.metaValue}>{aiStatus?.model || 'gpt-4o-mini'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Credential Security</span>
            <span className={styles.metaValue}>Server-Side Only (.env)</span>
          </div>
        </div>

        {/* Prompt Input */}
        <div className={styles.inputGroup}>
          <div className={styles.labelRow}>
            <label htmlFor="ai-test-prompt" className={styles.label}>
              Test Prompt
            </label>
            <span
              className={`${styles.charCount} ${charsLeft < 0 ? styles.charCountOver : ''}`}
            >
              {prompt.length} / {MAX_PROMPT_CHARS} characters
            </span>
          </div>
          <textarea
            id="ai-test-prompt"
            className={styles.textarea}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type a short test prompt to verify AI provider connection..."
            rows={3}
            disabled={testing}
          />
        </div>

        {/* Actions */}
        <div className={styles.actionsRow}>
          <div className={styles.btnGroup}>
            <button
              type="button"
              id="test-ai-connection-btn"
              className={styles.btnPrimary}
              onClick={handleRunTest}
              disabled={testing || !isPromptValid}
            >
              {testing ? (
                <>
                  <Spinner size="xs" color="white" />
                  Generating Response...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Test AI Connection
                </>
              )}
            </button>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleResetPrompt}
              disabled={testing}
            >
              Reset Prompt
            </button>
          </div>
        </div>

        {/* Loading State */}
        {testing && (
          <div className={`${styles.responsePanel} ${styles.responseLoading}`}>
            <Spinner size="md" />
            <span style={{ marginTop: '8px', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              Sending request to backend AI service and awaiting provider response...
            </span>
          </div>
        )}

        {/* Success Panel */}
        {testResult && !testing && (
          <div className={`${styles.responsePanel} ${styles.responseSuccess}`}>
            <div className={styles.responseHeader}>
              <span className={styles.responseTitle}>
                <CheckCircle2 size={18} />
                AI Service Connected Successfully
              </span>
              <span className={styles.modelBadge}>Model: {testResult.model || 'gpt-4o-mini'}</span>
            </div>
            <div className={styles.responseText}>{testResult.response}</div>
          </div>
        )}

        {/* Error Panel */}
        {testError && !testing && (
          <div className={`${styles.responsePanel} ${styles.responseError}`}>
            <div className={styles.responseHeader}>
              <span className={styles.responseTitle}>
                <AlertCircle size={18} />
                AI Connection Test Failed
              </span>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleRunTest}
                style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }}
              >
                <RotateCw size={13} />
                Retry
              </button>
            </div>
            <div className={styles.errorMessage}>{testError}</div>
          </div>
        )}

        {/* Security & Privacy Callout */}
        <div className={styles.securityNote}>
          <ShieldCheck size={20} className={styles.securityIcon} />
          <div>
            <strong>Strict Privacy & Security Guarantee:</strong> API keys and secrets remain
            exclusively on the backend and are never sent to the browser or committed to version control.
            Test requests use synthetic prompts without storing personal data.
          </div>
        </div>
      </div>
    </div>
  )
}
