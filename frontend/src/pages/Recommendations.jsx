import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Sparkles,
  BookOpen,
  History,
  RefreshCw,
  Search,
  X,
  Target,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Briefcase,
  ListTodo,
  CheckSquare,
  Square,
  Award,
  Layers,
} from 'lucide-react'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'
import { getResumes } from '../services/resumeService'
import { getJobDescriptions } from '../services/jobService'
import {
  getRecommendations,
  generateRecommendations,
  updateRecommendationStatus,
} from '../services/recommendationService'
import styles from './Recommendations.module.css'

export default function Recommendations() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const resumeIdParam = searchParams.get('resumeId')
  const jobIdParam = searchParams.get('jobId')

  // Selection states
  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
  const [selectedResumeId, setSelectedResumeId] = useState(resumeIdParam || '')
  const [selectedJobId, setSelectedJobId] = useState(jobIdParam || '')

  // Data states
  const [recData, setRecData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [updatingItemId, setUpdatingItemId] = useState(null)
  const [error, setError] = useState(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('ALL') // 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  const [reqFilter, setReqFilter] = useState('ALL') // 'ALL' | 'REQUIRED' | 'PREFERRED'
  const [expandedCards, setExpandedCards] = useState(new Set())

  // 1. Load user resumes and jobs
  useEffect(() => {
    let isMounted = true
    async function loadOptions() {
      try {
        const [resumesRes, jobsRes] = await Promise.all([
          getResumes().catch(() => ({ resumes: [] })),
          getJobDescriptions().catch(() => ({ jobs: [] })),
        ])

        if (!isMounted) return

        const userResumes = resumesRes.resumes || []
        const userJobs = jobsRes.jobs || []
        setResumes(userResumes)
        setJobs(userJobs)

        setSelectedResumeId((curr) => {
          if (curr) return curr
          if (userResumes.length === 0) return ''
          return userResumes.some((r) => String(r.id) === String(resumeIdParam))
            ? String(resumeIdParam)
            : String(userResumes[0].id)
        })

        setSelectedJobId((curr) => {
          if (curr) return curr
          if (userJobs.length === 0) return ''
          return userJobs.some((j) => String(j.id) === String(jobIdParam))
            ? String(jobIdParam)
            : String(userJobs[0].id)
        })
      } catch (err) {
        console.error('Failed to load options:', err)
      }
    }
    loadOptions()
    return () => { isMounted = false }
  }, [resumeIdParam, jobIdParam])

  // 2. Fetch or generate recommendations
  const loadRecs = useCallback(async (rId, jId) => {
    if (!rId || !jId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      let data = null
      try {
        const res = await getRecommendations(rId, jId)
        if (res?.data) {
          data = res.data
        }
      } catch (fetchErr) {
        if (fetchErr.response?.status !== 404) {
          console.warn('Saved recommendations fetch error:', fetchErr.message)
        }
      }

      if (!data) {
        const genRes = await generateRecommendations({ resumeId: rId, jobDescriptionId: jId })
        data = genRes.data
      }

      setRecData(data)

      // Auto-expand the first recommendation by default
      if (data?.recommendations?.length > 0) {
        setExpandedCards(new Set([data.recommendations[0].id || 0]))
      }
    } catch (err) {
      console.error('Recommendations load error:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load learning recommendations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedResumeId && selectedJobId) {
      loadRecs(selectedResumeId, selectedJobId)
    }
  }, [selectedResumeId, selectedJobId, loadRecs])

  // Handle dropdown change
  const handleSelectionChange = (rId, jId) => {
    setSelectedResumeId(rId)
    setSelectedJobId(jId)
    setSearchParams({ resumeId: rId, jobId: jId }, { replace: true })
  }

  // Handle manual regenerate
  const handleRegenerate = async () => {
    if (!selectedResumeId || !selectedJobId) return
    setGenerating(true)
    setError(null)
    try {
      const genRes = await generateRecommendations({
        resumeId: selectedResumeId,
        jobDescriptionId: selectedJobId,
      })
      setRecData(genRes.data)
      if (genRes.data?.recommendations?.length > 0) {
        setExpandedCards(new Set([genRes.data.recommendations[0].id || 0]))
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to re-generate recommendations.')
    } finally {
      setGenerating(false)
    }
  }

  // Toggle card expansion
  const toggleCardExpand = (id) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExpandAll = () => {
    if (!recData?.recommendations) return
    setExpandedCards(new Set(recData.recommendations.map((r, i) => r.id || i)))
  }

  const handleCollapseAll = () => {
    setExpandedCards(new Set())
  }

  // Toggle item status
  const handleToggleItemStatus = async (item, e) => {
    e.stopPropagation()
    const nextStatus = item.status === 'NOT_STARTED' ? 'IN_PROGRESS' : item.status === 'IN_PROGRESS' ? 'COMPLETED' : 'NOT_STARTED'

    setUpdatingItemId(item.id)
    try {
      await updateRecommendationStatus(item.id, { status: nextStatus })

      setRecData((prev) => {
        if (!prev) return prev
        const updatedList = prev.recommendations.map((r) => {
          if (r.id === item.id) {
            return { ...r, status: nextStatus }
          }
          return r
        })

        const completedCount = updatedList.filter((r) => r.status === 'COMPLETED').length
        const total = updatedList.length
        const completionPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 100

        return {
          ...prev,
          overview: {
            ...prev.overview,
            completionPercentage,
            completedCount,
          },
          recommendations: updatedList,
        }
      })
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setUpdatingItemId(null)
    }
  }

  // Toggle step status
  const handleToggleStepStatus = async (item, stepIndex, currentStepStatus, e) => {
    e.stopPropagation()
    const nextStepStatus = currentStepStatus === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED'

    setUpdatingItemId(item.id)
    try {
      const res = await updateRecommendationStatus(item.id, {
        stepIndex,
        stepStatus: nextStepStatus,
      })

      setRecData((prev) => {
        if (!prev) return prev
        const updatedList = prev.recommendations.map((r) => {
          if (r.id === item.id) {
            return {
              ...r,
              status: res.data?.status || r.status,
              learningSteps: res.data?.learningSteps || r.learningSteps,
            }
          }
          return r
        })

        const completedCount = updatedList.filter((r) => r.status === 'COMPLETED').length
        const total = updatedList.length
        const completionPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 100

        return {
          ...prev,
          overview: {
            ...prev.overview,
            completionPercentage,
            completedCount,
          },
          recommendations: updatedList,
        }
      })
    } catch (err) {
      console.error('Failed to update step status:', err)
    } finally {
      setUpdatingItemId(null)
    }
  }

  // Filtered recommendations
  const filteredRecs = useMemo(() => {
    if (!recData?.recommendations) return []
    const q = searchQuery.toLowerCase().trim()

    return recData.recommendations.filter((item) => {
      // Priority filter
      if (priorityFilter !== 'ALL' && item.priorityLevel !== priorityFilter) {
        return false
      }
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false
      }
      // Requirement type filter
      if (reqFilter !== 'ALL' && item.requirementType !== reqFilter) {
        return false
      }
      // Search query (skill name, topics, why it matters)
      if (q) {
        const inName = item.skillName.toLowerCase().includes(q)
        const inTopics = item.recommendedTopics?.some((t) => t.toLowerCase().includes(q))
        const inWhy = item.whyItMatters?.toLowerCase().includes(q)
        if (!inName && !inTopics && !inWhy) return false
      }
      return true
    })
  }, [recData, priorityFilter, statusFilter, reqFilter, searchQuery])

  const overview = recData?.overview

  return (
    <main className={styles.page}>
      {/* ── Top Header ── */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Personalized Skill Development</p>
          <h1 className={styles.title}>Learning Recommendations</h1>
          <p className={styles.subtitle}>
            Targeted learning guidance for every missing and partially matched skill, grounded in your target job requirements.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/history')}
          >
            <History size={15} /> History
          </Button>

          {selectedResumeId && selectedJobId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/roadmap?resumeId=${selectedResumeId}&jobId=${selectedJobId}`)}
            >
              <BookOpen size={15} /> View Roadmap
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={generating || !selectedResumeId || !selectedJobId}
          >
            {generating ? <Spinner size="sm" /> : <RefreshCw size={15} />}
            {generating ? 'Re-generating…' : 'Re-calculate Recommendations'}
          </Button>
        </div>
      </header>

      {/* ── Selector Bar ── */}
      <section className={styles.selectorBar} aria-label="Resume and Job Description Selector">
        <div className={styles.selectorGrid}>
          <div className={styles.selectGroup}>
            <label htmlFor="resume-select" className={styles.selectLabel}>
              Selected Resume
            </label>
            <select
              id="resume-select"
              className={styles.selectInput}
              value={selectedResumeId}
              onChange={(e) => handleSelectionChange(e.target.value, selectedJobId)}
            >
              {resumes.length === 0 && <option value="">No resumes found</option>}
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.original_filename || `Resume #${r.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.selectGroup}>
            <label htmlFor="job-select" className={styles.selectLabel}>
              Target Job Description
            </label>
            <select
              id="job-select"
              className={styles.selectInput}
              value={selectedJobId}
              onChange={(e) => handleSelectionChange(selectedResumeId, e.target.value)}
            >
              {jobs.length === 0 && <option value="">No job descriptions found</option>}
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} {j.company ? `(${j.company})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Loading & Error States ── */}
      {loading && (
        <div className={styles.state}>
          <Spinner size="lg" />
          <p>Generating personalized learning recommendations…</p>
        </div>
      )}

      {error && !loading && (
        <div className={styles.state}>
          <AlertTriangle size={36} className={styles.stateIcon} />
          <h2 className={styles.emptyStateTitle}>Unable to load recommendations</h2>
          <p className={styles.emptyStateDesc}>{error}</p>
          <Button onClick={() => loadRecs(selectedResumeId, selectedJobId)}>Try again</Button>
        </div>
      )}

      {!loading && !error && !recData && (
        <div className={styles.state}>
          <Target size={36} className={styles.stateIcon} />
          <h2 className={styles.emptyStateTitle}>Select a Resume and Job Description</h2>
          <p className={styles.emptyStateDesc}>
            Choose a resume and job description above to generate personalized learning guidance.
          </p>
        </div>
      )}

      {/* ── Main Content ── */}
      {!loading && !error && recData && (
        <>
          {/* Warnings Banner if any */}
          {recData.warnings?.length > 0 && (
            <div className={styles.warningBanner} role="status">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>{recData.warnings.join(' ')}</div>
            </div>
          )}

          {/* KPI Summary Cards */}
          <section className={styles.kpiGrid} aria-label="Recommendation Summary Statistics">
            {/* Total Skill Gaps */}
            <article className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span>Skill Gaps</span>
                <Target size={16} />
              </div>
              <div className={styles.kpiValue}>{overview?.totalGaps ?? 0}</div>
              <div className={styles.kpiSubtext}>Identified for {overview?.jobTitle || 'Selected Role'}</div>
            </article>

            {/* High Priority Gaps */}
            <article className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span>High Priority</span>
                <AlertTriangle size={16} style={{ color: 'var(--color-red)' }} />
              </div>
              <div className={styles.kpiValue} style={{ color: 'var(--color-red-dark)' }}>
                {overview?.highPriorityCount ?? 0}
              </div>
              <div className={styles.kpiSubtext}>Core required gaps to address first</div>
            </article>

            {/* In Progress */}
            <article className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span>In Progress</span>
                <Clock size={16} style={{ color: '#1D4ED8' }} />
              </div>
              <div className={styles.kpiValue} style={{ color: '#1D4ED8' }}>
                {overview?.inProgressCount ?? 0}
              </div>
              <div className={styles.kpiSubtext}>Skills actively being developed</div>
            </article>

            {/* Progress Percentage */}
            <article className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span>Overall Completion</span>
                <CheckCircle2 size={16} style={{ color: 'var(--color-emerald)' }} />
              </div>
              <div className={styles.kpiValue} style={{ color: 'var(--color-emerald)' }}>
                {overview?.completionPercentage ?? 0}%
              </div>
              <div className={styles.progressBarContainer}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${overview?.completionPercentage ?? 0}%` }}
                />
              </div>
            </article>
          </section>

          {/* Controls Bar: Search & Multi-Filters */}
          <section className={styles.controlsBar} aria-label="Search and Filter Recommendations">
            <div className={styles.searchRow}>
              <div className={styles.searchWrapper}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search by skill name, topic, or keyword…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search recommendations"
                />
                {searchQuery && (
                  <button
                    className={styles.clearSearchBtn}
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" size="sm" onClick={handleExpandAll}>
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCollapseAll}>
                  Collapse All
                </Button>
              </div>
            </div>

            <div className={styles.filterRow}>
              {/* Priority Filter */}
              <div className={styles.filterPillGroup}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)' }}>
                  Priority:
                </span>
                <button
                  className={`${styles.filterPill} ${priorityFilter === 'ALL' ? styles.filterPillActive : ''}`}
                  onClick={() => setPriorityFilter('ALL')}
                >
                  All Tiers
                </button>
                <button
                  className={`${styles.filterPill} ${priorityFilter === 'HIGH' ? styles.filterPillActive : ''}`}
                  onClick={() => setPriorityFilter('HIGH')}
                >
                  High
                </button>
                <button
                  className={`${styles.filterPill} ${priorityFilter === 'MEDIUM' ? styles.filterPillActive : ''}`}
                  onClick={() => setPriorityFilter('MEDIUM')}
                >
                  Medium
                </button>
                <button
                  className={`${styles.filterPill} ${priorityFilter === 'LOW' ? styles.filterPillActive : ''}`}
                  onClick={() => setPriorityFilter('LOW')}
                >
                  Low
                </button>
              </div>

              {/* Status Filter */}
              <div className={styles.filterPillGroup}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)' }}>
                  Status:
                </span>
                <button
                  className={`${styles.filterPill} ${statusFilter === 'ALL' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('ALL')}
                >
                  All
                </button>
                <button
                  className={`${styles.filterPill} ${statusFilter === 'NOT_STARTED' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('NOT_STARTED')}
                >
                  Not Started
                </button>
                <button
                  className={`${styles.filterPill} ${statusFilter === 'IN_PROGRESS' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('IN_PROGRESS')}
                >
                  In Progress
                </button>
                <button
                  className={`${styles.filterPill} ${statusFilter === 'COMPLETED' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('COMPLETED')}
                >
                  Completed
                </button>
              </div>

              {/* Requirement Type Filter */}
              <div className={styles.filterPillGroup}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)' }}>
                  Type:
                </span>
                <button
                  className={`${styles.filterPill} ${reqFilter === 'ALL' ? styles.filterPillActive : ''}`}
                  onClick={() => setReqFilter('ALL')}
                >
                  All
                </button>
                <button
                  className={`${styles.filterPill} ${reqFilter === 'REQUIRED' ? styles.filterPillActive : ''}`}
                  onClick={() => setReqFilter('REQUIRED')}
                >
                  Required
                </button>
                <button
                  className={`${styles.filterPill} ${reqFilter === 'PREFERRED' ? styles.filterPillActive : ''}`}
                  onClick={() => setReqFilter('PREFERRED')}
                >
                  Preferred
                </button>
              </div>
            </div>
          </section>

          {/* Empty Recommendations State */}
          {filteredRecs.length === 0 && (
            <div className={styles.state}>
              <CheckCircle2 size={40} style={{ color: 'var(--color-emerald)' }} />
              <h3 className={styles.emptyStateTitle}>
                {recData.recommendations?.length === 0
                  ? 'No Skill Gaps Identified!'
                  : 'No recommendations match your selected filters.'}
              </h3>
              <p className={styles.emptyStateDesc}>
                {recData.recommendations?.length === 0
                  ? 'Your resume strongly evidences all required and preferred technical skills for this role. You are well prepared!'
                  : 'Try adjusting your search query, priority tier, or status filters above.'}
              </p>
            </div>
          )}

          {/* Recommendations Cards List */}
          <div className={styles.recommendationsList}>
            {filteredRecs.map((item, index) => {
              const isExpanded = expandedCards.has(item.id || index)
              const isHigh = item.priorityLevel === 'HIGH'
              const isMed = item.priorityLevel === 'MEDIUM'
              const cardAccentClass = isHigh ? styles.cardHigh : isMed ? styles.cardMedium : styles.cardLow
              const numAccentClass = isHigh ? styles.priorityNumHigh : isMed ? styles.priorityNumMedium : styles.priorityNumLow
              const pBadgeClass = isHigh ? styles.badgeHigh : isMed ? styles.badgeMedium : styles.badgeLow

              const isCompleted = item.status === 'COMPLETED'
              const isInProgress = item.status === 'IN_PROGRESS'

              return (
                <article
                  key={item.id || item.skillName || index}
                  className={`${styles.recommendationCard} ${cardAccentClass}`}
                >
                  {/* ── Card Header ── */}
                  <div
                    className={styles.cardHeader}
                    onClick={() => toggleCardExpand(item.id || index)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') toggleCardExpand(item.id || index)
                    }}
                  >
                    <div className={styles.cardHeaderLeft}>
                      {/* Priority Order Number */}
                      <div className={`${styles.priorityBadgeNumber} ${numAccentClass}`}>
                        {String(item.stepOrder || index + 1).padStart(2, '0')}
                      </div>

                      <div className={styles.cardHeaderMeta}>
                        <div className={styles.skillTitleRow}>
                          <h3 className={styles.skillTitle}>{item.skillName}</h3>

                          {/* Priority Badge */}
                          <span className={`${styles.badgeHigh} ${pBadgeClass}`}>
                            {item.priorityLevel} Priority
                          </span>

                          {/* Requirement Type */}
                          <span
                            className={
                              item.requirementType === 'REQUIRED'
                                ? styles.tagRequired
                                : styles.tagPreferred
                            }
                          >
                            {item.requirementType === 'REQUIRED' ? 'Required' : 'Preferred'}
                          </span>

                          {/* Matching Status */}
                          {item.matchingStatus === 'PARTIAL_MATCH' && (
                            <span className={styles.tagPartial}>
                              Partial Match ({item.relatedResumeSkill || 'Transferable'})
                            </span>
                          )}

                          {item.difficulty && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              · {item.difficulty} · {item.estimatedDuration}
                            </span>
                          )}
                        </div>

                        {/* Collapsed Snippet */}
                        {!isExpanded && (
                          <p className={styles.whySnippet}>{item.whyItMatters}</p>
                        )}
                      </div>
                    </div>

                    {/* Header Right: Status Switcher & Expand Chevron */}
                    <div className={styles.cardHeaderRight}>
                      <button
                        className={`${styles.statusSelector} ${
                          isCompleted
                            ? styles.statusCompleted
                            : isInProgress
                            ? styles.statusInProgress
                            : styles.statusNotStarted
                        }`}
                        onClick={(e) => handleToggleItemStatus(item, e)}
                        title="Click to change learning status"
                      >
                        {updatingItemId === item.id ? (
                          <Spinner size="sm" />
                        ) : isCompleted ? (
                          <CheckCircle2 size={14} />
                        ) : isInProgress ? (
                          <Clock size={14} />
                        ) : (
                          <Circle size={14} />
                        )}
                        <span>
                          {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started'}
                        </span>
                      </button>

                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={isExpanded ? 'Collapse recommendation' : 'Expand recommendation'}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </Button>
                    </div>
                  </div>

                  {/* ── Card Body / Expanded Details ── */}
                  {isExpanded && (
                    <div className={styles.cardBody}>
                      {/* 1. Why This Skill? */}
                      <section className={styles.whySection}>
                        <Sparkles size={20} className={styles.whyIcon} />
                        <div>
                          <h4 className={styles.whyTitle}>Why This Skill Matters</h4>
                          <p className={styles.whyText}>{item.whyItMatters}</p>
                          <div className={styles.priorityRationale}>
                            <Award size={14} />
                            <strong>Priority Decision:</strong> {item.priorityReason}
                          </div>
                        </div>
                      </section>

                      {/* 2. Recommended Topics */}
                      {item.recommendedTopics?.length > 0 && (
                        <section className={styles.topicsSection}>
                          <h4 className={styles.sectionHeading}>
                            <Layers size={15} style={{ color: 'var(--color-indigo)' }} />
                            Recommended Topics & Concepts to Learn
                          </h4>
                          <div className={styles.topicsChips}>
                            {item.recommendedTopics.map((topic, i) => (
                              <span key={i} className={styles.topicChip}>
                                {topic}
                              </span>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* 3. Learning Steps Checklist */}
                      {item.learningSteps?.length > 0 && (
                        <section className={styles.stepsContainer}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h4 className={styles.sectionHeading}>
                              <ListTodo size={15} style={{ color: 'var(--color-navy)' }} />
                              Step-by-Step Learning Sequence
                            </h4>
                            <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
                              Estimated: {item.estimatedDuration} · {item.difficulty}
                            </small>
                          </div>

                          {item.learningSteps.map((step) => {
                            const stepDone = step.status === 'COMPLETED'
                            return (
                              <div
                                key={step.stepIndex}
                                className={`${styles.stepCard} ${stepDone ? styles.stepCardCompleted : ''}`}
                              >
                                <button
                                  className={`${styles.stepCheckboxBtn} ${stepDone ? styles.stepCheckboxBtnCompleted : ''}`}
                                  onClick={(e) => handleToggleStepStatus(item, step.stepIndex, step.status, e)}
                                  title={stepDone ? 'Mark as Not Completed' : 'Mark as Completed'}
                                >
                                  {stepDone ? <CheckSquare size={18} /> : <Square size={18} />}
                                </button>

                                <div className={styles.stepContent}>
                                  <h5 className={`${styles.stepTitle} ${stepDone ? styles.stepTitleCompleted : ''}`}>
                                    Stage {step.stepIndex}: {step.title}
                                  </h5>
                                  <p className={styles.stepExplanation}>
                                    {step.explanation || step.description}
                                  </p>

                                  <div className={styles.stepCallouts}>
                                    {step.learningObjective && (
                                      <span className={styles.stepObjectiveCallout}>
                                        <strong>Objective:</strong> {step.learningObjective}
                                      </span>
                                    )}
                                    {step.practicalActivity && (
                                      <span className={styles.stepActivityCallout}>
                                        <strong>Activity:</strong> {step.practicalActivity}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </section>
                      )}

                      {/* 4. Practical Activities & Mini Project */}
                      <div className={styles.subGrid}>
                        {/* Practical Exercises */}
                        <article className={styles.subCard}>
                          <div className={styles.subCardHeader}>
                            <ListTodo size={16} style={{ color: 'var(--color-cyan)' }} />
                            <span>Practical Hands-on Exercises</span>
                          </div>
                          <ul className={styles.activityList}>
                            {item.practicalExercises?.map((ex, i) => (
                              <li key={i}>{ex}</li>
                            ))}
                          </ul>
                        </article>

                        {/* Mini Project */}
                        {item.miniProject && (
                          <article className={styles.subCard}>
                            <div className={styles.subCardHeader}>
                              <Briefcase size={16} style={{ color: 'var(--color-amber)' }} />
                              <span>Demonstration Mini Project</span>
                            </div>
                            <div className={styles.miniProjectBody}>
                              <div className={styles.miniProjectTitle}>{item.miniProject.title}</div>
                              <p style={{ margin: 0 }}>{item.miniProject.description}</p>
                              {(item.miniProject.expectedOutcome || item.miniProject.demonstrates) && (
                                <div className={styles.miniProjectOutcome}>
                                  <strong>Expected Outcome:</strong>{' '}
                                  {item.miniProject.expectedOutcome || item.miniProject.demonstrates}
                                </div>
                              )}
                            </div>
                          </article>
                        )}
                      </div>

                      {/* 5. Expected Learning Outcomes */}
                      {item.expectedOutcomes?.length > 0 && (
                        <section className={styles.outcomesCard}>
                          <div className={styles.outcomesHeader}>
                            <CheckCircle2 size={16} />
                            <span>Expected Measurable Outcomes</span>
                          </div>
                          <ul className={styles.outcomesList}>
                            {item.expectedOutcomes.map((crit, idx) => (
                              <li key={idx}>{crit}</li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}
