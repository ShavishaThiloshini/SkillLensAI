import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  RefreshCw,
  Search,
  Briefcase,
  FileText,
  Layers,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  GraduationCap,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  Award,
} from 'lucide-react'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'
import { getResumes } from '../services/resumeService'
import { getJobDescriptions } from '../services/jobService'
import {
  runSkillMatching,
  getSavedSkillMatching,
  calculateMatchScore,
  getSavedMatchScore,
} from '../services/matchingService'
import styles from './SkillMatching.module.css'

/**
 * SkillLens AI — Day 21: Match Score Calculation & Skill Matching Dashboard
 *
 * Workflow:
 * Actual Resume Data + Actual Job Requirements
 * ↓
 * Day 20 Skill Matching Engine
 * ↓
 * Category Score Calculations (Skills, Experience, Education)
 * ↓
 * Overall Match Score with Normalized Weights
 * ↓
 * Match Score Dashboard
 */
function SkillMatching() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Selection states
  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')

  // UI state
  const [initialLoading, setInitialLoading] = useState(true)
  const [isMatching, setIsMatching] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [validationWarning, setValidationWarning] = useState(null)
  const [showMethodology, setShowMethodology] = useState(false)

  // Matching & Scoring results
  const [matchData, setMatchData] = useState(null)
  const [scoreData, setScoreData] = useState(null)

  // Filter & search states for Day 20 skills section
  const [activeTab, setActiveTab] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Load user's saved resumes and job descriptions on mount
  const loadInitialData = useCallback(async () => {
    setInitialLoading(true)
    setErrorMessage(null)

    try {
      const [resumesResponse, jobsResponse] = await Promise.all([
        getResumes().catch(() => ({ resumes: [] })),
        getJobDescriptions().catch(() => ({ jobs: [] })),
      ])

      const userResumes = resumesResponse.resumes || []
      const userJobs = jobsResponse.jobs || []

      setResumes(userResumes)
      setJobs(userJobs)

      // Query param auto-selection
      const paramResumeId = searchParams.get('resumeId')
      const paramJobId = searchParams.get('jobId')

      let initialResume = ''
      if (paramResumeId && userResumes.some((r) => String(r.id) === String(paramResumeId))) {
        initialResume = String(paramResumeId)
      } else if (userResumes.length > 0) {
        initialResume = String(userResumes[0].id)
      }

      let initialJob = ''
      if (paramJobId && userJobs.some((j) => String(j.id) === String(paramJobId))) {
        initialJob = String(paramJobId)
      } else if (userJobs.length > 0) {
        initialJob = String(userJobs[0].id)
      }

      setSelectedResumeId(initialResume)
      setSelectedJobId(initialJob)

      // If both were specified or selected, attempt to load saved results
      if (initialResume && initialJob) {
        try {
          const [savedScore, savedSkills] = await Promise.all([
            getSavedMatchScore(initialResume, initialJob).catch(() => null),
            getSavedSkillMatching(initialResume, initialJob).catch(() => null),
          ])

          if (savedScore?.data) {
            setScoreData(savedScore.data)
          }
          if (savedSkills?.data) {
            setMatchData(savedSkills.data)
          }
        } catch (_) {
          // No saved result yet, user can click "Calculate Match Score"
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load resumes and job descriptions.')
    } finally {
      setInitialLoading(false)
    }
  }, [searchParams])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Update query params when selection changes
  const handleResumeChange = (e) => {
    const val = e.target.value
    setSelectedResumeId(val)
    setValidationWarning(null)
    setScoreData(null)
    setMatchData(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set('resumeId', val)
      else next.delete('resumeId')
      return next
    })
  }

  const handleJobChange = (e) => {
    const val = e.target.value
    setSelectedJobId(val)
    setValidationWarning(null)
    setScoreData(null)
    setMatchData(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set('jobId', val)
      else next.delete('jobId')
      return next
    })
  }

  // 2. Trigger Day 21 Match Score Calculation & Day 20 Skill Matching
  const handleCalculateMatch = async () => {
    if (!selectedResumeId || !selectedJobId) {
      setValidationWarning('Please select both a resume and a job description to calculate match score.')
      return
    }

    setValidationWarning(null)
    setIsMatching(true)
    setErrorMessage(null)

    try {
      // Execute score calculation and skill matching concurrently
      const [scoreResponse, matchingResponse] = await Promise.all([
        calculateMatchScore({
          resumeId: selectedResumeId,
          jobDescriptionId: selectedJobId,
        }),
        runSkillMatching({
          resumeId: selectedResumeId,
          jobDescriptionId: selectedJobId,
        }),
      ])

      if (scoreResponse?.data) {
        setScoreData(scoreResponse.data)
      } else {
        throw new Error('Unexpected response format from match score service.')
      }

      if (matchingResponse?.data) {
        setMatchData(matchingResponse.data)
      }
    } catch (err) {
      console.error('[SkillMatching] Error calculating match:', err)
      setErrorMessage(err.message || 'Failed to calculate match score. Please check requirements.')
    } finally {
      setIsMatching(false)
    }
  }

  // 3. Filtered & searched skills results
  const filteredResults = useMemo(() => {
    if (!matchData?.results) return []

    return matchData.results.filter((item) => {
      // Tab filter
      if (activeTab === 'STRONG' && item.category !== 'STRONG_MATCH') return false
      if (activeTab === 'PARTIAL' && item.category !== 'PARTIAL_MATCH') return false
      if (activeTab === 'MISSING' && item.category !== 'MISSING') return false
      if (activeTab === 'REQUIRED' && item.requirementType !== 'REQUIRED') return false
      if (activeTab === 'PREFERRED' && item.requirementType !== 'PREFERRED') return false

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesSkill = item.jobSkill.toLowerCase().includes(query)
        const matchesMatchedSkill = item.matchedSkill?.toLowerCase().includes(query)
        const matchesExplanation = item.explanation?.toLowerCase().includes(query)
        if (!matchesSkill && !matchesMatchedSkill && !matchesExplanation) {
          return false
        }
      }

      return true
    })
  }, [matchData, activeTab, searchQuery])

  // Category counts for tab badges
  const tabCounts = useMemo(() => {
    const res = matchData?.results || []
    return {
      all: res.length,
      strong: res.filter((r) => r.category === 'STRONG_MATCH').length,
      partial: res.filter((r) => r.category === 'PARTIAL_MATCH').length,
      missing: res.filter((r) => r.category === 'MISSING').length,
      required: res.filter((r) => r.requirementType === 'REQUIRED').length,
      preferred: res.filter((r) => r.requirementType === 'PREFERRED').length,
    }
  }, [matchData])

  // Helper for overall score tier
  const getOverallTier = (score) => {
    if (score === null || score === undefined) return { label: 'Not Available', class: styles.heroBadgeModerate }
    if (score >= 80) return { label: 'Strong Alignment', class: styles.heroBadgeStrong, gaugeClass: styles.gaugeProgressStrong }
    if (score >= 65) return { label: 'Good Match', class: styles.heroBadgeGood, gaugeClass: styles.gaugeProgressGood }
    if (score >= 50) return { label: 'Moderate Match', class: styles.heroBadgeModerate, gaugeClass: styles.gaugeProgressModerate }
    return { label: 'Needs Development', class: styles.heroBadgeNeedsDev, gaugeClass: styles.gaugeProgressNeedsDev }
  }

  // Render Initial Loading
  if (initialLoading) {
    return (
      <div className={styles.stateContainer}>
        <Spinner size="lg" />
        <p className={styles.stateMessage}>Loading saved resumes and job descriptions...</p>
      </div>
    )
  }

  // Render Empty State if no resumes or no jobs uploaded yet
  if (resumes.length === 0 || jobs.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.titleIcon}>
              <Sparkles size={22} />
            </span>
            Match Score & Skill Analyzer
          </h1>
          <p className={styles.subtitle}>
            Calculate deterministic match scores across Skills, Experience, and Education between your resume and target jobs.
          </p>
        </div>

        <div className={styles.stateContainer}>
          <div className={`${styles.stateIcon} ${styles.stateIconAmber}`}>
            <Layers size={32} />
          </div>
          <h2 className={styles.stateTitle}>Prerequisites Required</h2>
          <p className={styles.stateMessage}>
            To calculate match scores, you need at least one saved resume and one saved job description.
          </p>
          <div className={styles.stateActions}>
            {resumes.length === 0 && (
              <Button as={Link} to="/resumes" variant="primary">
                <FileText size={16} />
                Upload Resume First
              </Button>
            )}
            {jobs.length === 0 && (
              <Button as={Link} to="/jobs" variant="secondary">
                <Briefcase size={16} />
                Add Job Description
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const overallScoreVal = scoreData?.overall?.score ?? null
  const overallTier = getOverallTier(overallScoreVal)

  // Circular gauge calculations (radius = 56, circumference = 2 * PI * 56 ≈ 351.86)
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = overallScoreVal !== null
    ? circumference - (overallScoreVal / 100) * circumference
    : circumference

  return (
    <div className={styles.page}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span className={styles.titleIcon}>
              <Sparkles size={22} />
            </span>
            Match Score & Skill Analyzer
          </h1>
          {scoreData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCalculateMatch}
              disabled={isMatching}
            >
              <RefreshCw size={14} className={isMatching ? 'spin' : ''} />
              Re-calculate Score
            </Button>
          )}
        </div>
        <p className={styles.subtitle}>
          Calculates explainable, deterministic alignment scores between candidate resume evidence and job requirements across Skills (50%), Experience (25%), and Education (15%).
        </p>
      </div>

      {/* ── Selection Card ── */}
      <section className={styles.selectionCard} aria-labelledby="selection-title">
        <div className={styles.selectionCardHeader}>
          <h2 className={styles.selectionCardTitle} id="selection-title">
            <Layers size={18} className="text-indigo" />
            Comparison Target Selection
          </h2>
          <span className={styles.fieldHelper}>Step 1: Select Records → Step 2: Calculate Match</span>
        </div>

        <div className={styles.selectionGrid}>
          {/* Resume Selector */}
          <div className={styles.selectionField}>
            <label htmlFor="resume-select" className={styles.fieldLabel}>
              <span>Saved Candidate Resume</span>
              <span className={styles.fieldHelper}>({resumes.length} available)</span>
            </label>
            <select
              id="resume-select"
              className={styles.selectInput}
              value={selectedResumeId}
              onChange={handleResumeChange}
              disabled={isMatching}
            >
              <option value="" disabled>Choose a resume...</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.original_filename} ({r.file_type || 'PDF'}) — Uploaded {new Date(r.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          {/* Job Description Selector */}
          <div className={styles.selectionField}>
            <label htmlFor="job-select" className={styles.fieldLabel}>
              <span>Target Job Description</span>
              <span className={styles.fieldHelper}>({jobs.length} available)</span>
            </label>
            <select
              id="job-select"
              className={styles.selectInput}
              value={selectedJobId}
              onChange={handleJobChange}
              disabled={isMatching}
            >
              <option value="" disabled>Choose a job description...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} {j.company ? `(${j.company})` : ''} — Created {new Date(j.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Validation Warning */}
        {validationWarning && (
          <div className={styles.validationAlert} role="alert">
            <AlertCircle size={16} />
            <span>{validationWarning}</span>
          </div>
        )}

        {/* Action Button */}
        <div className={styles.selectionActions}>
          <Button
            variant="primary"
            size="md"
            onClick={handleCalculateMatch}
            disabled={isMatching || !selectedResumeId || !selectedJobId}
          >
            {isMatching ? (
              <>
                <Spinner size="sm" />
                Calculating Match Scores...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Calculate Match Score
              </>
            )}
          </Button>
        </div>
      </section>

      {/* ── Error State ── */}
      {errorMessage && (
        <div className={styles.stateContainer} role="alert">
          <div className={`${styles.stateIcon} ${styles.stateIconRed}`}>
            <AlertCircle size={32} />
          </div>
          <h2 className={styles.stateTitle}>Calculation Failed</h2>
          <p className={styles.stateMessage}>{errorMessage}</p>
          <div className={styles.stateActions}>
            <Button variant="primary" onClick={handleCalculateMatch}>
              <RefreshCw size={14} />
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* ── Loading State ── */}
      {isMatching && !scoreData && (
        <div className={styles.stateContainer}>
          <Spinner size="lg" />
          <h2 className={styles.stateTitle}>Analyzing Resume & Job Alignment</h2>
          <p className={styles.stateMessage}>
            Evaluating technical skills, merging non-overlapping work experience intervals,
            comparing degree qualifications, and normalizing category weights...
          </p>
        </div>
      )}

      {/* ── DAY 21: MATCH SCORE DASHBOARD ── */}
      {scoreData && !isMatching && (
        <div className={styles.matchScoreSection}>
          {/* A. Overall Match Hero */}
          <div className={styles.matchScoreHero} role="region" aria-label="Overall Match Score">
            <div className={styles.heroContent}>
              <div className={styles.heroHeaderRow}>
                <span className={`${styles.heroBadge} ${overallTier.class}`}>
                  {overallTier.label}
                </span>
                <span className={styles.fieldHelper} style={{ color: '#94A3B8' }}>
                  Algorithm v{scoreData.metadata?.algorithmVersion || '1.0'}
                </span>
              </div>

              <h2 className={styles.heroTitle}>
                Overall Match: {overallScoreVal !== null ? `${overallScoreVal}%` : 'Unavailable'}
              </h2>

              <p className={styles.heroSubtitle}>
                {scoreData.overall?.explanation || 'Overall match calculated from applicable scoring categories.'}
              </p>

              <div className={styles.heroMetadata}>
                <span>Target: <strong>{scoreData.jobTitle || 'Job Role'}</strong></span>
                {scoreData.company && <span>Company: <strong>{scoreData.company}</strong></span>}
                <span>Resume: <strong>{scoreData.resumeFilename}</strong></span>
              </div>
            </div>

            {/* Circular Gauge */}
            <div className={styles.heroGaugeBox} aria-label={`Overall compatibility score gauge: ${overallScoreVal !== null ? overallScoreVal + '%' : 'Unavailable'}`}>
              <div className={styles.gaugeCircle}>
                <svg className={styles.gaugeSvg} viewBox="0 0 140 140">
                  <circle
                    className={styles.gaugeBackground}
                    cx="70"
                    cy="70"
                    r={radius}
                  />
                  <circle
                    className={`${styles.gaugeProgress} ${overallTier.gaugeClass || ''}`}
                    cx="70"
                    cy="70"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <div className={styles.gaugeTextContainer}>
                  <span className={styles.gaugeValue}>
                    {overallScoreVal !== null ? `${overallScoreVal}%` : '—'}
                  </span>
                  <span className={styles.gaugeLabel}>Overall</span>
                </div>
              </div>
            </div>
          </div>

          {/* B. Category Breakdown Cards */}
          <div className={styles.breakdownSection} role="region" aria-label="Category Breakdown">
            <div className={styles.breakdownTitleRow}>
              <h3 className={styles.breakdownTitle}>
                <ShieldCheck size={20} className="text-indigo" />
                Category Score Breakdown
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMethodology(!showMethodology)}
                aria-expanded={showMethodology}
              >
                <Info size={14} />
                {showMethodology ? 'Hide Methodology' : 'View Methodology'}
                {showMethodology ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>
            </div>

            <div className={styles.breakdownGrid}>
              {/* 1. Skills Match Card */}
              <div className={styles.scoreCard}>
                <div className={styles.scoreCardHeader}>
                  <div className={styles.scoreCardTitleBox}>
                    <div className={`${styles.scoreCardIcon} ${styles.iconSkills}`}>
                      <Sparkles size={18} />
                    </div>
                    <h4 className={styles.scoreCardName}>Skills Match</h4>
                  </div>
                  <span className={`${styles.scoreBadge} ${scoreData.scores.skills.status === 'AVAILABLE' ? styles.scoreBadgeAvailable : styles.scoreBadgeNa}`}>
                    {scoreData.scores.skills.status === 'AVAILABLE' ? 'Available' : 'Not Applicable'}
                  </span>
                </div>

                <div className={styles.scoreCardNumberRow}>
                  <div className={styles.scoreCardScore}>
                    {scoreData.scores.skills.score !== null ? `${scoreData.scores.skills.score}%` : 'N/A'}
                  </div>
                  <div className={styles.scoreCardWeight}>
                    Weight: {Math.round((scoreData.scores.skills.normalizedWeight || scoreData.scores.skills.weight) * 100)}%
                  </div>
                </div>

                <div className={styles.scoreProgressBar} aria-hidden="true">
                  <div
                    className={`${styles.scoreProgressFill} ${styles.fillSkills}`}
                    style={{ width: `${scoreData.scores.skills.score || 0}%` }}
                  />
                </div>

                <p className={styles.scoreCardExplanation}>
                  {scoreData.scores.skills.explanation}
                </p>
              </div>

              {/* 2. Experience Match Card */}
              <div className={styles.scoreCard}>
                <div className={styles.scoreCardHeader}>
                  <div className={styles.scoreCardTitleBox}>
                    <div className={`${styles.scoreCardIcon} ${styles.iconExp}`}>
                      <Clock size={18} />
                    </div>
                    <h4 className={styles.scoreCardName}>Experience Match</h4>
                  </div>
                  <span className={`${styles.scoreBadge} ${
                    scoreData.scores.experience.status === 'AVAILABLE'
                      ? styles.scoreBadgeAvailable
                      : scoreData.scores.experience.status === 'INSUFFICIENT_DATA'
                      ? styles.scoreBadgeInsufficient
                      : styles.scoreBadgeNa
                  }`}>
                    {scoreData.scores.experience.status === 'AVAILABLE'
                      ? 'Available'
                      : scoreData.scores.experience.status === 'INSUFFICIENT_DATA'
                      ? 'Insufficient Data'
                      : 'Not Specified'}
                  </span>
                </div>

                <div className={styles.scoreCardNumberRow}>
                  <div className={scoreData.scores.experience.score !== null ? styles.scoreCardScore : styles.scoreCardScoreNa}>
                    {scoreData.scores.experience.score !== null
                      ? `${scoreData.scores.experience.score}%`
                      : scoreData.scores.experience.status === 'INSUFFICIENT_DATA'
                      ? 'Unavailable'
                      : 'Not Specified'}
                  </div>
                  <div className={styles.scoreCardWeight}>
                    {scoreData.scores.experience.normalizedWeight !== null
                      ? `Weight: ${Math.round(scoreData.scores.experience.normalizedWeight * 100)}%`
                      : 'Weight: Redistributed'}
                  </div>
                </div>

                <div className={styles.scoreProgressBar} aria-hidden="true">
                  <div
                    className={`${styles.scoreProgressFill} ${styles.fillExp}`}
                    style={{ width: `${scoreData.scores.experience.score || 0}%` }}
                  />
                </div>

                <p className={styles.scoreCardExplanation}>
                  {scoreData.scores.experience.explanation}
                </p>
              </div>

              {/* 3. Education Match Card */}
              <div className={styles.scoreCard}>
                <div className={styles.scoreCardHeader}>
                  <div className={styles.scoreCardTitleBox}>
                    <div className={`${styles.scoreCardIcon} ${styles.iconEdu}`}>
                      <GraduationCap size={18} />
                    </div>
                    <h4 className={styles.scoreCardName}>Education Match</h4>
                  </div>
                  <span className={`${styles.scoreBadge} ${
                    scoreData.scores.education.status === 'AVAILABLE'
                      ? styles.scoreBadgeAvailable
                      : scoreData.scores.education.status === 'INSUFFICIENT_DATA'
                      ? styles.scoreBadgeInsufficient
                      : styles.scoreBadgeNa
                  }`}>
                    {scoreData.scores.education.status === 'AVAILABLE'
                      ? 'Available'
                      : scoreData.scores.education.status === 'INSUFFICIENT_DATA'
                      ? 'Insufficient Data'
                      : 'Not Specified'}
                  </span>
                </div>

                <div className={styles.scoreCardNumberRow}>
                  <div className={scoreData.scores.education.score !== null ? styles.scoreCardScore : styles.scoreCardScoreNa}>
                    {scoreData.scores.education.score !== null
                      ? `${scoreData.scores.education.score}%`
                      : scoreData.scores.education.status === 'INSUFFICIENT_DATA'
                      ? 'Unavailable'
                      : 'Not Specified'}
                  </div>
                  <div className={styles.scoreCardWeight}>
                    {scoreData.scores.education.normalizedWeight !== null
                      ? `Weight: ${Math.round(scoreData.scores.education.normalizedWeight * 100)}%`
                      : 'Weight: Redistributed'}
                  </div>
                </div>

                <div className={styles.scoreProgressBar} aria-hidden="true">
                  <div
                    className={`${styles.scoreProgressFill} ${styles.fillEdu}`}
                    style={{ width: `${scoreData.scores.education.score || 0}%` }}
                  />
                </div>

                <p className={styles.scoreCardExplanation}>
                  {scoreData.scores.education.explanation}
                </p>
              </div>
            </div>
          </div>

          {/* C. Methodology & Transparency Box */}
          {showMethodology && (
            <div className={styles.methodologyCard} role="region" aria-label="Scoring Methodology Details">
              <div className={styles.methodologyTitle}>
                <Award size={18} className="text-indigo" />
                Documented Scoring Methodology & Weight Normalization
              </div>
              <div className={styles.methodologyDetails}>
                <p>
                  Scores are calculated deterministically without artificial fabrication or random numbers.
                  When a job requirement category (such as experience or education) is not specified by the employer,
                  it is marked as <strong>Not Applicable</strong> and its baseline weight is redistributed proportionally across the applicable categories.
                </p>
                <table className={styles.weightsTable}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Base Weight</th>
                      <th>Status</th>
                      <th>Normalized Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Skills Match</td>
                      <td>50%</td>
                      <td>{scoreData.scores.skills.status}</td>
                      <td><strong>{Math.round((scoreData.scores.skills.normalizedWeight || 0.5) * 100)}%</strong></td>
                    </tr>
                    <tr>
                      <td>Experience Match</td>
                      <td>25%</td>
                      <td>{scoreData.scores.experience.status}</td>
                      <td><strong>{scoreData.scores.experience.normalizedWeight ? `${Math.round(scoreData.scores.experience.normalizedWeight * 100)}%` : '0% (Redistributed)'}</strong></td>
                    </tr>
                    <tr>
                      <td>Education Match</td>
                      <td>15%</td>
                      <td>{scoreData.scores.education.status}</td>
                      <td><strong>{scoreData.scores.education.normalizedWeight ? `${Math.round(scoreData.scores.education.normalizedWeight * 100)}%` : '0% (Redistributed)'}</strong></td>
                    </tr>
                    <tr>
                      <td>Certifications / Other</td>
                      <td>10%</td>
                      <td>NOT_APPLICABLE</td>
                      <td><strong>0% (Redistributed)</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* D. Warnings Alert if any */}
          {scoreData.metadata?.warnings && scoreData.metadata.warnings.length > 0 && (
            <div className={styles.warningsCard} role="alert">
              <AlertTriangle size={18} className={styles.warningsCardIcon} />
              <div>
                <strong>Honest Data Notice:</strong>
                <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                  {scoreData.metadata.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DAY 20: DETAILED SKILL BREAKDOWN ── */}
      {matchData && !isMatching && (
        <>
          {/* Section Divider / Title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-6)', marginTop: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} className="text-indigo" />
              Detailed Skill Matching Breakdown
            </h3>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {matchData.results?.length || 0} evaluated skills
            </span>
          </div>

          {/* Filter Tabs & Search */}
          <div className={styles.controlsRow}>
            <div className={styles.tabList} role="tablist" aria-label="Filter skills by match type">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'ALL'}
                className={`${styles.tabBtn} ${activeTab === 'ALL' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('ALL')}
              >
                All Skills
                <span className={styles.tabBadge}>{tabCounts.all}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'STRONG'}
                className={`${styles.tabBtn} ${styles.tabBtnStrong} ${activeTab === 'STRONG' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('STRONG')}
              >
                <CheckCircle2 size={14} />
                Strong
                <span className={styles.tabBadge}>{tabCounts.strong}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'PARTIAL'}
                className={`${styles.tabBtn} ${styles.tabBtnPartial} ${activeTab === 'PARTIAL' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('PARTIAL')}
              >
                <AlertTriangle size={14} />
                Partial
                <span className={styles.tabBadge}>{tabCounts.partial}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'MISSING'}
                className={`${styles.tabBtn} ${styles.tabBtnMissing} ${activeTab === 'MISSING' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('MISSING')}
              >
                <XCircle size={14} />
                Missing
                <span className={styles.tabBadge}>{tabCounts.missing}</span>
              </button>
            </div>

            {/* Search Input */}
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search skills or explanation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search evaluated skills"
              />
            </div>
          </div>

          {/* Results List */}
          {filteredResults.length === 0 ? (
            <div className={styles.emptyFilteredState}>
              <p>No skills match your active filter and search criteria.</p>
              <Button variant="ghost" size="sm" onClick={() => { setActiveTab('ALL'); setSearchQuery('') }}>
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className={styles.skillsList} role="feed" aria-label="Matched skills list">
              {filteredResults.map((item, idx) => {
                const isStrong = item.category === 'STRONG_MATCH'
                const isPartial = item.category === 'PARTIAL_MATCH'
                const isMissing = item.category === 'MISSING'
                const isRequired = item.requirementType === 'REQUIRED'

                return (
                  <article
                    key={`${item.jobSkill}-${idx}`}
                    className={`${styles.skillMatchCard} ${
                      isStrong
                        ? styles.cardStrong
                        : isPartial
                        ? styles.cardPartial
                        : styles.cardMissing
                    }`}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.skillTitleGroup}>
                        <h4 className={styles.skillName}>{item.jobSkill}</h4>
                        {item.matchedSkill && item.matchedSkill !== item.jobSkill && (
                          <span className={styles.matchedVia}>
                            (matched via {item.matchedSkill})
                          </span>
                        )}
                      </div>

                      <div className={styles.badgesGroup}>
                        {/* Requirement Type Badge */}
                        <span
                          className={`${styles.badgeRequirement} ${
                            isRequired
                              ? styles.badgeReqRequired
                              : item.requirementType === 'PREFERRED'
                              ? styles.badgeReqPreferred
                              : styles.badgeReqUnspecified
                          }`}
                        >
                          {item.requirementType || 'UNSPECIFIED'}
                        </span>

                        {/* Match Category Badge */}
                        <span
                          className={`${styles.badgeCategory} ${
                            isStrong
                              ? styles.badgeStrong
                              : isPartial
                              ? styles.badgePartial
                              : styles.badgeMissing
                          }`}
                        >
                          {isStrong ? (
                            <>
                              <CheckCircle2 size={12} />
                              Strong Match
                            </>
                          ) : isPartial ? (
                            <>
                              <AlertTriangle size={12} />
                              Partial Match
                            </>
                          ) : (
                            <>
                              <XCircle size={12} />
                              Missing
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Explanation */}
                    <p className={styles.explanationBox}>{item.explanation}</p>

                    {/* Evidence Snippet */}
                    {item.resumeEvidence && item.resumeEvidence.length > 0 && (
                      <div className={styles.evidenceSection}>
                        <span className={styles.evidenceLabel}>
                          <ShieldCheck size={12} />
                          Resume Evidence
                        </span>
                        {item.resumeEvidence.map((ev, evIdx) => (
                          <p key={evIdx} className={styles.evidenceText}>
                            "{ev}"
                          </p>
                        ))}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          {/* Meta Footer */}
          <div className={styles.metaFooter}>
            <div className={styles.metaItem}>
              <ShieldCheck size={14} className="text-emerald" />
              <span>Deterministic algorithm v{matchData.matchingMetadata?.algorithmVersion || '1.0'}</span>
            </div>
            {matchData.matchingMetadata?.matchedAt && (
              <div className={styles.metaItem}>
                <Clock size={14} />
                <span>Calculated on {new Date(matchData.matchingMetadata.matchedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default SkillMatching
