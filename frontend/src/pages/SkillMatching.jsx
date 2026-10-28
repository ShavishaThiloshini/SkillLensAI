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
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'
import { getResumes } from '../services/resumeService'
import { getJobDescriptions } from '../services/jobService'
import { runSkillMatching, getSavedSkillMatching } from '../services/matchingService'
import styles from './SkillMatching.module.css'

/**
 * SkillLens AI — Day 20: Skill Matching Engine UI
 *
 * Provides resume-to-job skill comparison:
 * - Select saved resume and saved job description
 * - Execute deterministic skill matching
 * - Display Strong Match (Green), Partial Match (Yellow), and Missing (Red)
 * - Preserve Required vs Preferred classifications
 * - View evidenced resume snippets and explainable rationale
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

  // Matching results
  const [matchData, setMatchData] = useState(null)

  // Filter & search states
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

      // If both were specified in query params, attempt to load saved results
      if (initialResume && initialJob) {
        try {
          const savedResult = await getSavedSkillMatching(initialResume, initialJob)
          if (savedResult?.data) {
            setMatchData(savedResult.data)
          }
        } catch (_) {
          // No saved result yet, user can click "Run Matching"
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
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set('jobId', val)
      else next.delete('jobId')
      return next
    })
  }

  // 2. Trigger skill matching
  const handleRunMatching = async () => {
    if (!selectedResumeId || !selectedJobId) {
      setValidationWarning('Please select both a resume and a job description to compare.')
      return
    }

    setValidationWarning(null)
    setIsMatching(true)
    setErrorMessage(null)

    try {
      const response = await runSkillMatching({
        resumeId: selectedResumeId,
        jobDescriptionId: selectedJobId,
      })

      if (response?.data) {
        setMatchData(response.data)
      } else {
        throw new Error('Unexpected response format from skill matching service.')
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to execute skill matching comparison.')
    } finally {
      setIsMatching(false)
    }
  }

  // 3. Filtered & searched results
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
            Skill Matching Engine
          </h1>
          <p className={styles.subtitle}>
            Compare technical skills from your resume with requirements extracted from target job descriptions.
          </p>
        </div>

        <div className={styles.stateContainer}>
          <div className={`${styles.stateIcon} ${styles.stateIconAmber}`}>
            <Layers size={32} />
          </div>
          <h2 className={styles.stateTitle}>Prerequisites Required</h2>
          <p className={styles.stateMessage}>
            To run the skill matching engine, you need at least one saved resume and one saved job description.
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

  const summary = matchData?.summary || {
    totalJobSkills: 0,
    strongMatches: 0,
    partialMatches: 0,
    missingSkills: 0,
    requiredSkills: 0,
    preferredSkills: 0,
    requiredMatches: { strong: 0, partial: 0, missing: 0 },
    preferredMatches: { strong: 0, partial: 0, missing: 0 },
  }

  return (
    <div className={styles.page}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span className={styles.titleIcon}>
              <Sparkles size={22} />
            </span>
            Skill Matching Engine
          </h1>
          {matchData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunMatching}
              disabled={isMatching}
            >
              <RefreshCw size={14} className={isMatching ? 'spin' : ''} />
              Re-run Matching
            </Button>
          )}
        </div>
        <p className={styles.subtitle}>
          Evaluates actual extracted resume skills against target job description requirements,
          categorizing every skill into Strong Match, Partial Match, or Missing.
        </p>
      </div>

      {/* ── A. Selection Card ── */}
      <section className={styles.selectionCard} aria-labelledby="selection-title">
        <div className={styles.selectionCardHeader}>
          <h2 className={styles.selectionCardTitle} id="selection-title">
            <Layers size={18} className="text-indigo" />
            Comparison Target Selection
          </h2>
          <span className={styles.fieldHelper}>Step 1: Select Records → Step 2: Compare</span>
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
            onClick={handleRunMatching}
            disabled={isMatching || !selectedResumeId || !selectedJobId}
          >
            {isMatching ? (
              <>
                <Spinner size="sm" />
                Comparing Skills...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Run Skill Matching
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
          <h2 className={styles.stateTitle}>Matching Comparison Failed</h2>
          <p className={styles.stateMessage}>{errorMessage}</p>
          <div className={styles.stateActions}>
            <Button variant="primary" onClick={handleRunMatching}>
              <RefreshCw size={14} />
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* ── Loading State ── */}
      {isMatching && !matchData && (
        <div className={styles.stateContainer}>
          <Spinner size="lg" />
          <h2 className={styles.stateTitle}>Analyzing Skill Overlap</h2>
          <p className={styles.stateMessage}>
            Extracting and normalizing technical skills, resolving known technology aliases,
            and evaluating evidence against job requirements...
          </p>
        </div>
      )}

      {/* ── B & C: Matching Results ── */}
      {matchData && !isMatching && (
        <>
          {/* B. Summary Cards */}
          <div className={styles.summaryGrid}>
            {/* Total Job Skills */}
            <div className={`${styles.summaryCard} ${styles.summaryCardTotal}`}>
              <div className={styles.summaryCardHeader}>
                <span className={styles.summaryCardLabel}>Evaluated Skills</span>
                <span className={`${styles.summaryCardIconBox} ${styles.iconTotal}`}>
                  <Layers size={18} />
                </span>
              </div>
              <p className={styles.summaryCardValue}>{summary.totalJobSkills}</p>
              <p className={styles.summaryCardSubtext}>
                {summary.requiredSkills} Required • {summary.preferredSkills} Preferred
              </p>
            </div>

            {/* Strong Matches */}
            <div className={`${styles.summaryCard} ${styles.summaryCardStrong}`}>
              <div className={styles.summaryCardHeader}>
                <span className={styles.summaryCardLabel}>Strong Match</span>
                <span className={`${styles.summaryCardIconBox} ${styles.iconStrong}`}>
                  <CheckCircle2 size={18} />
                </span>
              </div>
              <p className={styles.summaryCardValue}>{summary.strongMatches}</p>
              <p className={styles.summaryCardSubtext}>
                {summary.requiredMatches?.strong || 0} req • {summary.preferredMatches?.strong || 0} pref
              </p>
            </div>

            {/* Partial Matches */}
            <div className={`${styles.summaryCard} ${styles.summaryCardPartial}`}>
              <div className={styles.summaryCardHeader}>
                <span className={styles.summaryCardLabel}>Partial Match</span>
                <span className={`${styles.summaryCardIconBox} ${styles.iconPartial}`}>
                  <AlertTriangle size={18} />
                </span>
              </div>
              <p className={styles.summaryCardValue}>{summary.partialMatches}</p>
              <p className={styles.summaryCardSubtext}>
                {summary.requiredMatches?.partial || 0} req • {summary.preferredMatches?.partial || 0} pref
              </p>
            </div>

            {/* Missing Skills */}
            <div className={`${styles.summaryCard} ${styles.summaryCardMissing}`}>
              <div className={styles.summaryCardHeader}>
                <span className={styles.summaryCardLabel}>Missing Skills</span>
                <span className={`${styles.summaryCardIconBox} ${styles.iconMissing}`}>
                  <XCircle size={18} />
                </span>
              </div>
              <p className={styles.summaryCardValue}>{summary.missingSkills}</p>
              <p className={styles.summaryCardSubtext}>
                {summary.requiredMatches?.missing || 0} req • {summary.preferredMatches?.missing || 0} pref
              </p>
            </div>
          </div>

          {/* Requirement Breakdown Bar */}
          <div className={styles.breakdownBar}>
            <div className={styles.breakdownGroup}>
              <span className={styles.breakdownTitle}>Required Skills:</span>
              <span className={`${styles.breakdownPill} ${styles.breakdownPillStrong}`}>
                <CheckCircle2 size={12} /> {summary.requiredMatches?.strong || 0} Strong
              </span>
              <span className={`${styles.breakdownPill} ${styles.breakdownPillPartial}`}>
                <AlertTriangle size={12} /> {summary.requiredMatches?.partial || 0} Partial
              </span>
              <span className={`${styles.breakdownPill} ${styles.breakdownPillMissing}`}>
                <XCircle size={12} /> {summary.requiredMatches?.missing || 0} Missing
              </span>
            </div>

            <div className={styles.breakdownGroup}>
              <span className={styles.breakdownTitle}>Preferred Skills:</span>
              <span className={`${styles.breakdownPill} ${styles.breakdownPillStrong}`}>
                <CheckCircle2 size={12} /> {summary.preferredMatches?.strong || 0} Strong
              </span>
              <span className={`${styles.breakdownPill} ${styles.breakdownPillPartial}`}>
                <AlertTriangle size={12} /> {summary.preferredMatches?.partial || 0} Partial
              </span>
              <span className={`${styles.breakdownPill} ${styles.breakdownPillMissing}`}>
                <XCircle size={12} /> {summary.preferredMatches?.missing || 0} Missing
              </span>
            </div>
          </div>

          {/* Filter & Search Controls */}
          <div className={styles.controlsRow}>
            <div className={styles.tabsList} role="tablist" aria-label="Filter skill matches">
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
                className={`${styles.tabBtn} ${activeTab === 'STRONG' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('STRONG')}
              >
                Strong Match
                <span className={styles.tabBadge}>{tabCounts.strong}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'PARTIAL'}
                className={`${styles.tabBtn} ${activeTab === 'PARTIAL' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('PARTIAL')}
              >
                Partial Match
                <span className={styles.tabBadge}>{tabCounts.partial}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'MISSING'}
                className={`${styles.tabBtn} ${activeTab === 'MISSING' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('MISSING')}
              >
                Missing
                <span className={styles.tabBadge}>{tabCounts.missing}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'REQUIRED'}
                className={`${styles.tabBtn} ${activeTab === 'REQUIRED' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('REQUIRED')}
              >
                Required Only
                <span className={styles.tabBadge}>{tabCounts.required}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'PREFERRED'}
                className={`${styles.tabBtn} ${activeTab === 'PREFERRED' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('PREFERRED')}
              >
                Preferred Only
                <span className={styles.tabBadge}>{tabCounts.preferred}</span>
              </button>
            </div>

            <div className={styles.searchBox}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search evaluated skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search skills"
              />
            </div>
          </div>

          {/* C. Match Results List */}
          {filteredResults.length === 0 ? (
            <div className={styles.stateContainer}>
              <HelpCircle size={28} className="text-muted" />
              <p className={styles.stateMessage}>
                No skills match the active filter or search query.
              </p>
            </div>
          ) : (
            <div className={styles.resultsList}>
              {filteredResults.map((item, idx) => {
                const isStrong = item.category === 'STRONG_MATCH'
                const isPartial = item.category === 'PARTIAL_MATCH'
                const isMissing = item.category === 'MISSING'

                const cardClass = isStrong
                  ? styles.matchCardStrong
                  : isPartial
                  ? styles.matchCardPartial
                  : styles.matchCardMissing

                const badgeCategoryClass = isStrong
                  ? styles.badgeStrong
                  : isPartial
                  ? styles.badgePartial
                  : styles.badgeMissing

                const isRequired = item.requirementType === 'REQUIRED'
                const isPreferred = item.requirementType === 'PREFERRED'

                return (
                  <div key={`${item.jobSkill}-${idx}`} className={`${styles.matchCard} ${cardClass}`}>
                    <div className={styles.matchCardHeader}>
                      <div className={styles.matchCardTitleBox}>
                        <h3 className={styles.skillName}>{item.jobSkill}</h3>

                        {/* Category Badge with Color & Icon */}
                        <span className={`${styles.badgeCategory} ${badgeCategoryClass}`}>
                          {isStrong && <CheckCircle2 size={13} aria-hidden="true" />}
                          {isPartial && <AlertTriangle size={13} aria-hidden="true" />}
                          {isMissing && <XCircle size={13} aria-hidden="true" />}
                          <span>
                            {isStrong && 'Strong Match'}
                            {isPartial && 'Partial Match'}
                            {isMissing && 'Missing'}
                          </span>
                        </span>

                        {/* Requirement Classification Badge */}
                        <span
                          className={`${styles.badgeRequirement} ${
                            isRequired
                              ? styles.badgeReqRequired
                              : isPreferred
                              ? styles.badgeReqPreferred
                              : styles.badgeReqUnspecified
                          }`}
                        >
                          {isRequired ? 'Required' : isPreferred ? 'Preferred' : 'Unspecified'}
                        </span>
                      </div>
                    </div>

                    {/* Explanation */}
                    {item.explanation && (
                      <p className={styles.explanationBox}>{item.explanation}</p>
                    )}

                    {/* Resume Evidence */}
                    {item.resumeEvidence && item.resumeEvidence.length > 0 && (
                      <div className={styles.evidenceSection}>
                        <span className={styles.evidenceLabel}>
                          <ShieldCheck size={12} />
                          Resume Evidence:
                        </span>
                        {item.resumeEvidence.map((ev, i) => (
                          <p key={i} className={styles.evidenceText}>
                            "{ev}"
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Meta Footer */}
          <div className={styles.metaFooter}>
            <span className={styles.metaItem}>
              Candidate Resume: <strong>{matchData.resumeFilename || 'Selected Resume'}</strong>
            </span>
            <span className={styles.metaItem}>
              Target Job: <strong>{matchData.jobTitle || 'Selected Job'}</strong>
            </span>
            <span className={styles.metaItem}>
              Algorithm: v{matchData.matchingMetadata?.algorithmVersion || '1.0'}
            </span>
            <span className={styles.metaItem}>
              Matched At: {new Date(matchData.matchingMetadata?.matchedAt || Date.now()).toLocaleTimeString()}
            </span>
          </div>
        </>
      )}

      {/* Initial state guide before match is run */}
      {!matchData && !isMatching && !errorMessage && (
        <div className={styles.stateContainer}>
          <div className={`${styles.stateIcon} ${styles.stateIconIndigo}`}>
            <ArrowRight size={28} />
          </div>
          <h2 className={styles.stateTitle}>Ready to Run Skill Comparison</h2>
          <p className={styles.stateMessage}>
            Select a candidate resume and target job description above, then click <strong>Run Skill Matching</strong> to
            evaluate technical skills, detect skill gaps, and view evidenced matches.
          </p>
        </div>
      )}
    </div>
  )
}

export default SkillMatching
