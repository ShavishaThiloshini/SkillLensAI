import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  XCircle,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Target,
  Layers,
  Award,
  Briefcase,
  HelpCircle,
  RotateCcw,
  ListTodo,
  CheckSquare,
  Square,
  ShieldCheck,
  TrendingUp,
  History,
  GraduationCap,
} from 'lucide-react'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'
import { getResumes } from '../services/resumeService'
import { getJobDescriptions } from '../services/jobService'
import {
  generateRoadmap,
  getSavedRoadmap,
  updateRoadmapItemStatus,
  resetRoadmapProgress,
} from '../services/roadmapService'
import styles from './Roadmap.module.css'

export default function Roadmap() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const resumeIdParam = searchParams.get('resumeId')
  const jobIdParam = searchParams.get('jobId')

  // Available selections
  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
  const [selectedResumeId, setSelectedResumeId] = useState(resumeIdParam || '')
  const [selectedJobId, setSelectedJobId] = useState(jobIdParam || '')

  // Data states
  const [roadmapData, setRoadmapData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [updatingItemId, setUpdatingItemId] = useState(null)
  const [error, setError] = useState(null)

  // View & Filter states
  const [activeTab, setActiveTab] = useState('ROADMAP') // 'ROADMAP' | 'CURRENT' | 'GAPS'
  const [priorityFilter, setPriorityFilter] = useState('ALL') // 'ALL' | '1' | '2' | '3'
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  const [expandedItems, setExpandedItems] = useState(new Set())

  // 1. Initial load of saved resumes and job descriptions
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

        // Auto-select first resume / job if none selected in params
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

  // 2. Fetch or generate roadmap when selection is set
  const loadRoadmap = useCallback(async (rId, jId) => {
    if (!rId || !jId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // First try to fetch saved roadmap
      let data = null
      try {
        const savedRes = await getSavedRoadmap(rId, jId)
        if (savedRes?.data) {
          data = savedRes.data
        }
      } catch (fetchErr) {
        // If 404, we will generate it below
        if (fetchErr.response?.status !== 404) {
          console.warn('Saved roadmap fetch error:', fetchErr.message)
        }
      }

      // If no saved roadmap exists, generate one
      if (!data) {
        const genRes = await generateRoadmap({ resumeId: rId, jobDescriptionId: jId })
        data = genRes.data
      }

      setRoadmapData(data)

      // Auto-expand the first item by default
      if (data?.roadmap?.length > 0) {
        setExpandedItems(new Set([data.roadmap[0].id || 0]))
      }
    } catch (err) {
      console.error('Failed to load roadmap:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load skill gap roadmap.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedResumeId && selectedJobId) {
      loadRoadmap(selectedResumeId, selectedJobId)
    } else {
      setLoading(false)
    }
  }, [selectedResumeId, selectedJobId, loadRoadmap])

  // Sync query params when selection changes
  const handleSelectionChange = (rId, jId) => {
    setSelectedResumeId(rId)
    setSelectedJobId(jId)
    setSearchParams({ resumeId: rId, jobId: jId })
  }

  // Handle re-generate
  const handleRegenerate = async () => {
    if (!selectedResumeId || !selectedJobId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await generateRoadmap({
        resumeId: selectedResumeId,
        jobDescriptionId: selectedJobId,
      })
      setRoadmapData(res.data)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to re-generate roadmap.')
    } finally {
      setGenerating(false)
    }
  }

  // Toggle item expanded state
  const toggleItemExpand = (itemId) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  // Toggle status of an item (Not Started -> In Progress -> Completed)
  const handleToggleItemStatus = async (item, e) => {
    e.stopPropagation()
    const validTransitions = {
      NOT_STARTED: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
      COMPLETED: 'NOT_STARTED',
    }
    const nextStatus = validTransitions[item.status] || 'IN_PROGRESS'

    setUpdatingItemId(item.id)
    try {
      await updateRoadmapItemStatus(item.id, { status: nextStatus })

      // Optimistic local state update
      setRoadmapData((prev) => {
        if (!prev) return prev
        const updatedList = prev.roadmap.map((i) => {
          if (i.id === item.id) {
            const updatedSteps = (i.learningSteps || []).map((step) => ({
              ...step,
              status: nextStatus === 'COMPLETED' ? 'COMPLETED' : nextStatus === 'NOT_STARTED' ? 'NOT_STARTED' : step.status,
            }))
            return { ...i, status: nextStatus, learningSteps: updatedSteps }
          }
          return i
        })

        const completedCount = updatedList.filter((i) => i.status === 'COMPLETED').length
        const total = updatedList.length
        const completionPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 100

        return {
          ...prev,
          overview: {
            ...prev.overview,
            completionPercentage,
            completedItemsCount: completedCount,
          },
          roadmap: updatedList,
        }
      })
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setUpdatingItemId(null)
    }
  }

  // Toggle status of a specific step in a roadmap item
  const handleToggleStepStatus = async (item, stepIndex, currentStepStatus, e) => {
    e.stopPropagation()
    const nextStepStatus = currentStepStatus === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED'

    setUpdatingItemId(item.id)
    try {
      const res = await updateRoadmapItemStatus(item.id, {
        stepIndex,
        stepStatus: nextStepStatus,
      })

      // Update local state with returned updated item
      setRoadmapData((prev) => {
        if (!prev) return prev
        const updatedList = prev.roadmap.map((i) => {
          if (i.id === item.id) {
            return {
              ...i,
              status: res.data?.status || i.status,
              learningSteps: res.data?.learningSteps || i.learningSteps,
            }
          }
          return i
        })

        const completedCount = updatedList.filter((i) => i.status === 'COMPLETED').length
        const total = updatedList.length
        const completionPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 100

        return {
          ...prev,
          overview: {
            ...prev.overview,
            completionPercentage,
            completedItemsCount: completedCount,
          },
          roadmap: updatedList,
        }
      })
    } catch (err) {
      console.error('Failed to update step status:', err)
    } finally {
      setUpdatingItemId(null)
    }
  }

  // Reset entire roadmap progress
  const handleResetProgress = async () => {
    if (!roadmapData?.overview?.analysisId) return
    const confirmed = window.confirm('Are you sure you want to reset all learning progress back to Not Started?')
    if (!confirmed) return

    setLoading(true)
    try {
      await resetRoadmapProgress(roadmapData.overview.analysisId)
      // Reload roadmap data to reflect clean reset
      await loadRoadmap(selectedResumeId, selectedJobId)
    } catch {
      setError('Failed to reset roadmap progress.')
      setLoading(false)
    }
  }

  // Filtered roadmap items
  const filteredRoadmap = useMemo(() => {
    if (!roadmapData?.roadmap) return []
    return roadmapData.roadmap.filter((item) => {
      if (priorityFilter !== 'ALL' && String(item.priorityLevel) !== String(priorityFilter)) {
        return false
      }
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false
      }
      return true
    })
  }, [roadmapData, priorityFilter, statusFilter])

  // Overview numbers
  const overview = roadmapData?.overview
  const currentSkills = roadmapData?.currentSkills
  const missingSkills = roadmapData?.missingSkills

  return (
    <main className={styles.page}>
      {/* ── Top Header ── */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Career Development Plan</p>
          <h1 className={styles.title}>Skill Gap Roadmap</h1>
          <p className={styles.subtitle}>
            Transform your skill gap analysis into an actionable, prioritized learning journey.
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
              onClick={() => navigate(`/recommendations?resumeId=${selectedResumeId}&jobId=${selectedJobId}`)}
            >
              <GraduationCap size={15} /> Recommendations
            </Button>
          )}

          {overview?.resumeId && overview?.jobId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/analysis-results?resumeId=${overview.resumeId}&jobId=${overview.jobId}`)}
            >
              <ArrowLeft size={15} /> Analysis Results
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={generating || !selectedResumeId || !selectedJobId}
          >
            {generating ? <Spinner size="sm" /> : <RefreshCw size={15} />}
            {generating ? 'Re-generating…' : 'Re-calculate Roadmap'}
          </Button>
        </div>
      </header>

      {/* ── Selector Bar ── */}
      <section className={styles.selectorBar} aria-label="Resume and Job Selector">
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
          <p>Generating personalized learning roadmap…</p>
        </div>
      )}

      {error && !loading && (
        <div className={styles.state}>
          <AlertTriangle size={36} className={styles.stateIcon} />
          <h2 className={styles.emptyStateTitle}>Unable to load roadmap</h2>
          <p className={styles.emptyStateDesc}>{error}</p>
          <Button onClick={() => loadRoadmap(selectedResumeId, selectedJobId)}>Try again</Button>
        </div>
      )}

      {!loading && !error && !roadmapData && (
        <div className={styles.state}>
          <Target size={36} className={styles.stateIcon} />
          <h2 className={styles.emptyStateTitle}>Select a Resume and Job Description</h2>
          <p className={styles.emptyStateDesc}>
            Choose a resume and job description above to generate a tailored skill gap roadmap.
          </p>
        </div>
      )}

      {/* ── Content View ── */}
      {!loading && !error && roadmapData && (
        <>
          {/* Warnings Banner if any */}
          {roadmapData.warnings?.length > 0 && (
            <div className={styles.warningBanner} role="status">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>{roadmapData.warnings.join(' ')}</div>
            </div>
          )}

          {/* ── Section 1: Overview KPIs ── */}
          <section className={styles.kpiGrid} aria-label="Roadmap Overview Statistics">
            {/* Overall Match Score */}
            <article className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span>Overall Match</span>
                <Award size={16} />
              </div>
              <div className={styles.kpiValue}>
                {overview?.overallScore !== null ? `${Math.round(overview.overallScore)}%` : 'N/A'}
              </div>
              <div className={styles.kpiSubtext}>Target: {overview?.jobTitle || 'Selected Job'}</div>
            </article>

            {/* Current Resume Skills */}
            <article className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span>Current Skills</span>
                <CheckCircle2 size={16} />
              </div>
              <div className={styles.kpiValue}>{overview?.currentSkillsCount || 0}</div>
              <div className={styles.kpiSubtext}>
                {currentSkills?.matchedWithJobCount || 0} match target requirements
              </div>
            </article>

            {/* Missing Skills */}
            <article className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span>Identified Gaps</span>
                <XCircle size={16} />
              </div>
              <div className={styles.kpiValue}>{overview?.missingSkillsCount || 0}</div>
              <div className={styles.kpiSubtext}>
                {missingSkills?.required?.length || 0} required · {missingSkills?.partial?.length || 0} partial
              </div>
            </article>

            {/* Roadmap Completion Progress */}
            <article className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span>Roadmap Progress</span>
                <TrendingUp size={16} />
              </div>
              <div className={styles.kpiValue}>
                {overview?.completionPercentage || 0}%
              </div>
              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${Math.max(0, Math.min(100, overview?.completionPercentage || 0))}%` }}
                />
              </div>
              <div className={styles.kpiSubtext}>
                {overview?.completedItemsCount || 0} of {overview?.prioritySkillsCount || 0} skills completed
              </div>
            </article>
          </section>

          {/* ── Navigation Tabs ── */}
          <nav className={styles.tabNav} aria-label="Roadmap Views">
            <button
              className={`${styles.tabBtn} ${activeTab === 'ROADMAP' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('ROADMAP')}
            >
              <BookOpen size={16} /> Priority Roadmap
              <span className={styles.badgePill}>{roadmapData.roadmap?.length || 0}</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'CURRENT' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('CURRENT')}
            >
              <CheckCircle2 size={16} /> Current Skills
              <span className={styles.badgePill}>{overview?.currentSkillsCount || 0}</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'GAPS' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('GAPS')}
            >
              <AlertTriangle size={16} /> Missing & Partial Gaps
              <span className={styles.badgePill}>
                {(missingSkills?.totalMissingCount || 0) + (missingSkills?.partial?.length || 0)}
              </span>
            </button>
            <button
              className={styles.tabBtn}
              onClick={() => navigate(`/recommendations?resumeId=${selectedResumeId}&jobId=${selectedJobId}`)}
            >
              <GraduationCap size={16} /> Learning Recommendations
              <span className={styles.badgePill}>{roadmapData.roadmap?.length || 0}</span>
            </button>
          </nav>

          {/* ── TAB 1: PRIORITY ROADMAP ── */}
          {activeTab === 'ROADMAP' && (
            <section className={styles.section} aria-label="Priority Learning Roadmap">
              {/* Sequence Rationale Banner */}
              {roadmapData.learningSequenceRationale && (
                <aside className={styles.sequenceBanner}>
                  <Sparkles size={20} style={{ color: 'var(--color-indigo)', flexShrink: 0, marginTop: '2px' }} />
                  <div>{roadmapData.learningSequenceRationale}</div>
                </aside>
              )}

              {/* Filters & Actions Bar */}
              <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
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
                    className={`${styles.filterPill} ${priorityFilter === '1' ? styles.filterPillActive : ''}`}
                    onClick={() => setPriorityFilter('1')}
                  >
                    Priority 1 (High)
                  </button>
                  <button
                    className={`${styles.filterPill} ${priorityFilter === '2' ? styles.filterPillActive : ''}`}
                    onClick={() => setPriorityFilter('2')}
                  >
                    Priority 2 (Medium)
                  </button>
                  <button
                    className={`${styles.filterPill} ${priorityFilter === '3' ? styles.filterPillActive : ''}`}
                    onClick={() => setPriorityFilter('3')}
                  >
                    Priority 3 (Lower)
                  </button>
                </div>

                <div className={styles.filterGroup}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)' }}>
                    Status:
                  </span>
                  <button
                    className={`${styles.filterPill} ${statusFilter === 'ALL' ? styles.filterPillActive : ''}`}
                    onClick={() => setStatusFilter('ALL')}
                  >
                    All Statuses
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

                  <Button variant="outline" size="sm" onClick={handleResetProgress} title="Reset all progress">
                    <RotateCcw size={14} /> Reset Progress
                  </Button>
                </div>
              </div>

              {/* Empty Roadmap (100% Match or No Filtered Items) */}
              {filteredRoadmap.length === 0 && (
                <div className={styles.state}>
                  <ShieldCheck size={40} style={{ color: 'var(--color-emerald)' }} />
                  <h3 className={styles.emptyStateTitle}>
                    {roadmapData.roadmap?.length === 0
                      ? 'No Skill Gaps Identified!'
                      : 'No skills match the selected filters.'}
                  </h3>
                  <p className={styles.emptyStateDesc}>
                    {roadmapData.roadmap?.length === 0
                      ? 'Your resume strongly evidences all extracted technical skill requirements for this role. You are well prepared!'
                      : 'Try adjusting your priority or status filters above.'}
                  </p>
                </div>
              )}

              {/* Roadmap Timeline Cards */}
              <div className={styles.roadmapList}>
                {filteredRoadmap.map((item, index) => {
                  const isExpanded = expandedItems.has(item.id || index)
                  const pBadgeClass = item.priorityLevel === 1 ? styles.badgeP1 : item.priorityLevel === 3 ? styles.badgeP3 : styles.badgeP2
                  const pStepClass = item.priorityLevel === 1 ? styles.stepNumberP1 : item.priorityLevel === 3 ? styles.stepNumberP3 : styles.stepNumberP2
                  const pBorderClass = item.priorityLevel === 1 ? styles.roadmapItemP1 : item.priorityLevel === 3 ? styles.roadmapItemP3 : styles.roadmapItemP2

                  const isCompleted = item.status === 'COMPLETED'
                  const isInProgress = item.status === 'IN_PROGRESS'

                  return (
                    <article
                      key={item.id || item.title || index}
                      className={`${styles.roadmapItem} ${pBorderClass}`}
                    >
                      {/* Item Header / Click to Expand */}
                      <div
                        className={styles.itemHeader}
                        onClick={() => toggleItemExpand(item.id || index)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleItemExpand(item.id || index) }}
                      >
                        <div className={styles.itemHeaderLeft}>
                          {/* Step Number Badge */}
                          <div className={`${styles.stepNumber} ${pStepClass}`}>
                            {String(item.stepOrder || index + 1).padStart(2, '0')}
                          </div>

                          <div className={styles.itemMeta}>
                            <div className={styles.skillTitleLine}>
                              <h3 className={styles.skillTitle}>{item.title}</h3>

                              {/* Priority Badge */}
                              <span className={`${styles.priorityBadge} ${pBadgeClass}`}>
                                {item.priorityLabel || `Priority ${item.priorityLevel}`}
                              </span>

                              {/* Requirement Type */}
                              <span
                                className={`${styles.tagPill} ${
                                  item.requirementType === 'REQUIRED'
                                    ? styles.tagRequired
                                    : styles.tagPreferred
                                }`}
                              >
                                {item.requirementType === 'REQUIRED' ? 'Required' : 'Preferred'}
                              </span>

                              {/* Matching Status */}
                              {item.matchingStatus === 'PARTIAL_MATCH' && (
                                <span className={`${styles.tagPill} ${styles.tagPartial}`}>
                                  Partial Match ({item.relatedResumeSkill})
                                </span>
                              )}
                            </div>

                            {/* Rationale Text */}
                            <p className={styles.itemRationale}>{item.priorityReason}</p>
                          </div>
                        </div>

                        {/* Right side: Status Switcher & Expand Icon */}
                        <div className={styles.itemHeaderRight}>
                          <button
                            className={`${styles.statusSelector} ${
                              isCompleted
                                ? styles.statusCompleted
                                : isInProgress
                                ? styles.statusInProgress
                                : styles.statusNotStarted
                            }`}
                            onClick={(e) => handleToggleItemStatus(item, e)}
                            title="Click to change progress status"
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
                            aria-label={isExpanded ? 'Collapse learning path' : 'Expand learning path'}
                          >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </Button>
                        </div>
                      </div>

                      {/* Expandable Section: Learning Path Details */}
                      {isExpanded && (
                        <div className={styles.itemDetails}>
                          {/* A. Learning Objective */}
                          <div className={styles.learningObjectiveCard}>
                            <Target size={20} style={{ color: 'var(--color-indigo)', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <strong style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-indigo)' }}>
                                Learning Objective
                              </strong>
                              <p className={styles.objectiveText}>{item.learningObjective}</p>
                            </div>
                          </div>

                          {/* B. Learning Steps Checklist */}
                          <div className={styles.stepsContainer}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-navy)' }}>
                                Step-by-Step Learning Stages
                              </h4>
                              <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
                                Estimated duration: {item.estimatedDuration || '2 weeks'} · {item.difficulty || 'Intermediate'}
                              </small>
                            </div>

                            {item.learningSteps?.map((step) => {
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
                                    <p className={styles.stepDesc}>{step.description}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* C & D: Practical Activities & Mini Project */}
                          <div className={styles.detailGrid}>
                            {/* C. Practical Activities */}
                            <article className={styles.subCard}>
                              <div className={styles.subCardHeader}>
                                <ListTodo size={17} style={{ color: 'var(--color-cyan)' }} />
                                <span>Practical Exercises & Activities</span>
                              </div>
                              <ul className={styles.activityList}>
                                {item.practicalActivities?.map((act, i) => (
                                  <li key={i}>{act}</li>
                                ))}
                              </ul>
                            </article>

                            {/* D. Mini Project */}
                            {item.miniProject && (
                              <article className={styles.subCard}>
                                <div className={styles.subCardHeader}>
                                  <Briefcase size={17} style={{ color: 'var(--color-amber)' }} />
                                  <span>Suggested Mini-Project</span>
                                </div>
                                <div className={styles.miniProjectBody}>
                                  <div className={styles.miniProjectTitle}>{item.miniProject.title}</div>
                                  <p style={{ margin: 0 }}>{item.miniProject.description}</p>
                                  {item.miniProject.demonstrates && (
                                    <div className={styles.demonstratesCallout}>
                                      <strong>Outcome:</strong> {item.miniProject.demonstrates}
                                    </div>
                                  )}
                                </div>
                              </article>
                            )}
                          </div>

                          {/* E. Completion Criteria */}
                          {item.completionCriteria?.length > 0 && (
                            <div className={styles.subCard} style={{ backgroundColor: '#F8FAFC' }}>
                              <div className={styles.subCardHeader}>
                                <CheckCircle2 size={17} style={{ color: 'var(--color-emerald)' }} />
                                <span>Completion & Self-Evaluation Criteria</span>
                              </div>
                              <ul className={styles.activityList}>
                                {item.completionCriteria.map((crit, idx) => (
                                  <li key={idx}>{crit}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── TAB 2: CURRENT SKILLS ── */}
          {activeTab === 'CURRENT' && (
            <section className={styles.section} aria-label="Current Extracted Skills">
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>
                    <CheckCircle2 size={20} style={{ color: 'var(--color-emerald)' }} />
                    Extracted Resume Skills
                  </h3>
                  <p className={styles.subtitle}>
                    Skills identified directly from your resume. Skills with a green badge match requirements for{' '}
                    <strong>{overview?.jobTitle}</strong>.
                  </p>
                </div>
              </div>

              {currentSkills?.groups?.length === 0 ? (
                <div className={styles.state}>
                  <HelpCircle size={32} />
                  <p>No skills were extracted from this resume.</p>
                </div>
              ) : (
                <div className={styles.skillCardsGrid}>
                  {currentSkills?.groups?.map((group) => (
                    <div key={group.category} className={styles.skillCategoryCard}>
                      <div className={styles.categoryTitle}>
                        <span>{group.category}</span>
                        <span className={styles.badgePill}>{group.count}</span>
                      </div>

                      <div className={styles.skillTagList}>
                        {group.skills.map((s) => (
                          <span
                            key={s.id || s.name}
                            className={`${styles.skillTag} ${s.matchesJob ? styles.skillTagMatched : ''}`}
                            title={
                              s.matchesJob
                                ? `Matches Job Requirement: ${s.matchedJobRequirement} (${s.requirementType})`
                                : s.evidence
                                ? `Evidence: ${s.evidence}`
                                : 'Extracted from resume'
                            }
                          >
                            {s.matchesJob && <CheckCircle2 size={12} />}
                            {s.name}
                            {s.proficiency && <small>({s.proficiency.toLowerCase()})</small>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── TAB 3: MISSING & PARTIAL GAPS ── */}
          {activeTab === 'GAPS' && (
            <section className={styles.section} aria-label="Identified Skill Gaps">
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>
                    <AlertTriangle size={20} style={{ color: 'var(--color-amber)' }} />
                    Identified Skill Gaps Breakdown
                  </h3>
                  <p className={styles.subtitle}>
                    Categorized breakdown of missing and partial requirements from{' '}
                    <strong>{overview?.jobTitle}</strong>.
                  </p>
                </div>
              </div>

              <div className={styles.missingGrid}>
                {/* 1. Missing Required Skills */}
                <div className={styles.missingCol}>
                  <div className={styles.missingColHeader}>
                    <div className={styles.missingColTitle}>
                      <XCircle size={16} style={{ color: 'var(--color-red)' }} />
                      <span>Missing Required ({missingSkills?.required?.length || 0})</span>
                    </div>
                  </div>

                  {missingSkills?.required?.length === 0 ? (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                      No missing required skills!
                    </p>
                  ) : (
                    missingSkills?.required?.map((item) => (
                      <div key={item.skillName} className={styles.missingItemCard}>
                        <div className={styles.missingItemTitleLine}>
                          <span className={styles.missingItemName}>{item.skillName}</span>
                          <span className={`${styles.tagPill} ${styles.tagRequired}`}>Required</span>
                        </div>
                        <p className={styles.missingItemReason}>{item.reason}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* 2. Missing Preferred Skills */}
                <div className={styles.missingCol}>
                  <div className={styles.missingColHeader}>
                    <div className={styles.missingColTitle}>
                      <AlertTriangle size={16} style={{ color: '#B45309' }} />
                      <span>Missing Preferred ({missingSkills?.preferred?.length || 0})</span>
                    </div>
                  </div>

                  {missingSkills?.preferred?.length === 0 ? (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                      No missing preferred skills!
                    </p>
                  ) : (
                    missingSkills?.preferred?.map((item) => (
                      <div key={item.skillName} className={styles.missingItemCard}>
                        <div className={styles.missingItemTitleLine}>
                          <span className={styles.missingItemName}>{item.skillName}</span>
                          <span className={`${styles.tagPill} ${styles.tagPreferred}`}>Preferred</span>
                        </div>
                        <p className={styles.missingItemReason}>{item.reason}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* 3. Partial Matches */}
                <div className={styles.missingCol}>
                  <div className={styles.missingColHeader}>
                    <div className={styles.missingColTitle}>
                      <Layers size={16} style={{ color: 'var(--color-indigo)' }} />
                      <span>Partial Matches ({missingSkills?.partial?.length || 0})</span>
                    </div>
                  </div>

                  {missingSkills?.partial?.length === 0 ? (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                      No partial matches.
                    </p>
                  ) : (
                    missingSkills?.partial?.map((item) => (
                      <div key={item.skillName} className={styles.missingItemCard}>
                        <div className={styles.missingItemTitleLine}>
                          <span className={styles.missingItemName}>{item.skillName}</span>
                          <span className={`${styles.tagPill} ${styles.tagPartial}`}>
                            Related: {item.relatedResumeSkill}
                          </span>
                        </div>
                        <p className={styles.missingItemReason}>{item.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
