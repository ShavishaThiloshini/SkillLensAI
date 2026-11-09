import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  Compass,
  Sparkles,
  BookOpen,
  History,
  RefreshCw,
  Target,
  AlertTriangle,
  FileText,
  Briefcase,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  Award,
  Layers,
  Wand2,
  Info,
  ArrowRight,
  ExternalLink,
  GraduationCap,
  FileEdit,
  Code2,
  FolderGit2,
  Users2,
} from 'lucide-react'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'
import { getResumes } from '../services/resumeService'
import { getJobDescriptions } from '../services/jobService'
import {
  getCareerInsights,
  generateCareerInsights,
} from '../services/careerInsightsService'
import styles from './CareerInsights.module.css'

export default function CareerInsights() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const resumeIdParam = searchParams.get('resumeId')
  const jobIdParam = searchParams.get('jobId')
  const analysisIdParam = searchParams.get('analysisId')

  // Selection state
  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
  const [selectedResumeId, setSelectedResumeId] = useState(resumeIdParam || '')
  const [selectedJobId, setSelectedJobId] = useState(jobIdParam || '')

  // Data state
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  // Tab & subtab filters
  const [activeTab, setActiveTab] = useState('ALL') // 'ALL' | 'STRENGTHS' | 'WEAKNESSES' | 'PRIORITY_SKILLS' | 'IMPROVEMENTS'
  const [improvementSubTab, setImprovementSubTab] = useState('ALL') // 'ALL' | 'TECHNICAL' | 'PROJECTS' | 'RESUME' | 'PROFESSIONAL'

  // Load available resumes and jobs
  useEffect(() => {
    let mounted = true
    async function loadSelectables() {
      try {
        const [resList, jobList] = await Promise.all([
          getResumes(),
          getJobDescriptions(),
        ])
        if (!mounted) return

        const validResumes = resList.resumes || []
        const validJobs = jobList.jobs || []

        setResumes(validResumes)
        setJobs(validJobs)

        if (!selectedResumeId && validResumes.length > 0) {
          setSelectedResumeId(String(validResumes[0].id))
        }
        if (!selectedJobId && validJobs.length > 0) {
          setSelectedJobId(String(validJobs[0].id))
        }
      } catch (err) {
        console.error('Failed to load selectable resumes and jobs:', err)
      }
    }
    loadSelectables()
    return () => { mounted = false }
  }, [])

  // Sync selection with URL search parameters
  useEffect(() => {
    if (selectedResumeId && selectedJobId) {
      setSearchParams({
        resumeId: selectedResumeId,
        jobId: selectedJobId,
        ...(analysisIdParam ? { analysisId: analysisIdParam } : {}),
      }, { replace: true })
    }
  }, [selectedResumeId, selectedJobId, setSearchParams, analysisIdParam])

  // Fetch career insights
  const fetchInsights = useCallback(async () => {
    if (!selectedResumeId || !selectedJobId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await getCareerInsights(selectedResumeId, selectedJobId)
      setData(res.data)
    } catch (err) {
      console.error('Failed to fetch career insights:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load career insights.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedResumeId, selectedJobId])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  // Re-generate insights
  const handleRegenerate = async () => {
    if (!selectedResumeId || !selectedJobId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await generateCareerInsights({
        resumeId: selectedResumeId,
        jobId: selectedJobId,
      })
      setData(res.data)
    } catch (err) {
      console.error('Regenerate failed:', err)
      setError(err.response?.data?.message || err.message || 'Failed to regenerate career insights.')
    } finally {
      setGenerating(false)
    }
  }

  // Count badges
  const counts = useMemo(() => {
    if (!data) return { strengths: 0, weaknesses: 0, priority: 0, improvements: 0 }
    const sCount = data.strengths?.length || 0
    const wCount = data.weaknesses?.length || 0
    const pCount = data.prioritySkills?.length || 0
    const impObj = data.careerImprovements || {}
    const iCount =
      (impObj.technical?.length || 0) +
      (impObj.projects?.length || 0) +
      (impObj.resume?.length || 0) +
      (impObj.professional?.length || 0)
    return { strengths: sCount, weaknesses: wCount, priority: pCount, improvements: iCount }
  }, [data])

  // Readiness color variable
  const readinessTier = data?.careerReadiness?.tier || 'PROGRESSING'
  const readinessColor =
    readinessTier === 'STRONG'
      ? 'var(--color-emerald)'
      : readinessTier === 'PROGRESSING'
      ? 'var(--color-indigo)'
      : readinessTier === 'DEVELOPING'
      ? 'var(--color-amber)'
      : readinessTier === 'NEEDS_DEVELOPMENT'
      ? '#e11d48'
      : '#64748b'

  return (
    <div className={styles.page}>
      {/* ── Top Header ── */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Holistic Career Development</p>
          <h1 className={styles.title}>Career Insights & Readiness Dashboard</h1>
          <p className={styles.subtitle}>
            A comprehensive, evidence-grounded assessment of your career readiness, strengths, development areas, priority skills, and actionable career improvement roadmap.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/analysis-results?resumeId=${selectedResumeId}&jobId=${selectedJobId}`)}
          >
            <History size={15} /> Analysis Results
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/roadmap?resumeId=${selectedResumeId}&jobId=${selectedJobId}`)}
          >
            <BookOpen size={15} /> Learning Roadmap
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/improvements?resumeId=${selectedResumeId}&jobId=${selectedJobId}`)}
          >
            <FileEdit size={15} /> Resume Improvements
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleRegenerate}
            disabled={generating || !selectedResumeId || !selectedJobId}
          >
            {generating ? <Spinner size="sm" /> : <RefreshCw size={15} />}
            {generating ? 'Re-analyzing…' : 'Re-generate'}
          </Button>
        </div>
      </header>

      {/* ── Resume & Job Selector ── */}
      <section className={styles.selectorBar} aria-label="Resume and Target Job Selectors">
        <div className={styles.selectorGrid}>
          <div className={styles.selectGroup}>
            <label htmlFor="resume-select" className={styles.selectLabel}>Selected Resume</label>
            <select
              id="resume-select"
              className={styles.selectInput}
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.original_filename || `Resume #${r.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.selectGroup}>
            <label htmlFor="job-select" className={styles.selectLabel}>Target Career Direction / Job</label>
            <select
              id="job-select"
              className={styles.selectInput}
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} {j.company ? `(${j.company})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Loading / Error / Empty States ── */}
      {loading && (
        <div className={styles.emptyState}>
          <Spinner size="lg" />
          <p>Synthesizing career insights across technical skills, projects, and readiness dimensions…</p>
        </div>
      )}

      {error && !loading && (
        <div className={styles.emptyState}>
          <AlertTriangle size={32} color="var(--color-amber)" />
          <h2 className={styles.emptyTitle}>Unable to Load Career Insights</h2>
          <p className={styles.emptyDesc}>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchInsights}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      )}

      {!loading && !error && !data && (
        <div className={styles.emptyState}>
          <Compass size={36} color="var(--color-indigo)" />
          <h2 className={styles.emptyTitle}>No Career Insights Available Yet</h2>
          <p className={styles.emptyDesc}>
            Select a resume and target job above to generate your comprehensive career readiness evaluation.
          </p>
          <Button variant="primary" size="sm" onClick={handleRegenerate} disabled={generating}>
            Generate Career Insights
          </Button>
        </div>
      )}

      {/* ── Main Insights Content ── */}
      {!loading && !error && data && (
        <>
          {/* 1. Overall Career Readiness Hero */}
          <section
            className={styles.readinessHero}
            aria-labelledby="career-readiness-title"
            style={{
              '--score-pct': data.careerReadiness?.score || 0,
              '--gauge-color': readinessColor,
            }}
          >
            {/* Visual Gauge */}
            <div className={styles.gaugeContainer}>
              <div className={styles.scoreCircle}>
                <div className={styles.scoreCircleInner}>
                  <span className={styles.scoreNumber}>
                    {data.careerReadiness?.score !== null ? `${data.careerReadiness.score}%` : 'N/A'}
                  </span>
                  <span className={styles.scoreUnit}>Readiness</span>
                </div>
              </div>
              <span className={`${styles.levelBadge} ${styles[`levelBadge--${data.careerReadiness?.tier || 'INSUFFICIENT_DATA'}`]}`}>
                {data.careerReadiness?.level || 'Insufficient Data'}
              </span>
            </div>

            {/* Dimensional Breakdown */}
            <div className={styles.readinessDetails}>
              <div className={styles.readinessHeader}>
                <h2 id="career-readiness-title" className={styles.readinessTitle}>
                  Overall Career Readiness Assessment
                </h2>
                <p className={styles.readinessDesc}>
                  {data.careerReadiness?.explanation}
                </p>
              </div>

              {data.careerReadiness?.dimensions?.length > 0 && (
                <div className={styles.dimensionsList} aria-label="Readiness Dimensions">
                  {data.careerReadiness.dimensions.map((dim) => (
                    <div key={dim.key} className={styles.dimensionItem}>
                      <div className={styles.dimensionItemTop}>
                        <span>{dim.name} ({dim.weight}%)</span>
                        <span>{dim.score}%</span>
                      </div>
                      <div className={styles.dimensionBarTrack}>
                        <div
                          className={styles.dimensionBarFill}
                          style={{ width: `${Math.max(0, Math.min(100, dim.score))}%` }}
                        />
                      </div>
                      <p className={styles.dimensionExplanation}>{dim.explanation}</p>
                    </div>
                  ))}
                </div>
              )}

              <p className={styles.readinessDisclaimer}>
                <strong>Note:</strong> {data.careerReadiness?.limitationsDisclaimer}
              </p>
            </div>
          </section>

          {/* 2. Executive Career Synthesis */}
          {data.summary && (
            <aside className={styles.synthesisCard} aria-label="Executive Career Synthesis">
              <h3 className={styles.synthesisTitle}>
                <Sparkles size={18} color="var(--color-indigo)" />
                Executive Career Development Synthesis
              </h3>
              <div className={styles.synthesisGrid}>
                <div className={styles.synthesisBox}>
                  <strong>Key Strengths & Competencies:</strong>
                  <p style={{ margin: 0 }}>{data.summary.keyStrengthsOverview}</p>
                </div>
                <div className={styles.synthesisBox}>
                  <strong>Top Development Priorities:</strong>
                  <p style={{ margin: 0 }}>{data.summary.keyDevelopmentAreasOverview}</p>
                </div>
              </div>

              {data.summary.immediateNextActions?.length > 0 && (
                <div style={{ marginTop: 'var(--space-1)' }}>
                  <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--color-navy)', display: 'block', marginBottom: 'var(--space-2)' }}>
                    Immediate Practical Next Steps:
                  </strong>
                  <ul className={styles.actionChecklist}>
                    {data.summary.immediateNextActions.map((action, idx) => (
                      <li key={idx} className={styles.actionItem}>
                        <span className={styles.actionBadge}>{idx + 1}</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}

          {/* 3. Tab Bar */}
          <nav className={styles.tabBar} aria-label="Career Insights Navigation">
            <button
              className={`${styles.tabButton} ${activeTab === 'ALL' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              All Insights
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'STRENGTHS' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('STRENGTHS')}
            >
              Key Strengths <span className={styles.tabCount}>{counts.strengths}</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'WEAKNESSES' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('WEAKNESSES')}
            >
              Development Areas <span className={styles.tabCount}>{counts.weaknesses}</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'PRIORITY_SKILLS' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('PRIORITY_SKILLS')}
            >
              Priority Skills <span className={styles.tabCount}>{counts.priority}</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'IMPROVEMENTS' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('IMPROVEMENTS')}
            >
              Career Actions <span className={styles.tabCount}>{counts.improvements}</span>
            </button>
          </nav>

          {/* ── Section: Key Strengths ── */}
          {(activeTab === 'ALL' || activeTab === 'STRENGTHS') && (
            <article className={styles.sectionCard} id="strengths-section">
              <header className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <CheckCircle2 size={20} color="var(--color-emerald)" />
                    1. Key Career Strengths
                  </h2>
                  <p className={styles.sectionDesc}>
                    Validated capabilities supported by actual resume evidence and matching job requirements.
                  </p>
                </div>
              </header>

              <div className={styles.strengthsGrid}>
                {(!data.strengths || data.strengths.length === 0) ? (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    No specific strengths identified. Upload a more detailed resume to showcase your competencies.
                  </p>
                ) : (
                  data.strengths.map((str, idx) => (
                    <div key={idx} className={styles.strengthCard}>
                      <div className={styles.strengthCardTop}>
                        <span className={styles.categoryTag}>{str.category}</span>
                        <CheckCircle2 size={16} color="var(--color-emerald)" />
                      </div>
                      <h3 className={styles.strengthTitle}>{str.title}</h3>
                      <p className={styles.strengthExplanation}>{str.explanation}</p>
                      <div className={styles.evidenceBox}>
                        <strong>Supporting Evidence:</strong> {str.supportingEvidence}
                      </div>
                      <div className={styles.valuePropBox}>
                        <strong>Why valuable:</strong> {str.valueProposition}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          )}

          {/* ── Section: Weaknesses & Development Areas ── */}
          {(activeTab === 'ALL' || activeTab === 'WEAKNESSES') && (
            <article className={styles.sectionCard} id="weaknesses-section">
              <header className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <AlertTriangle size={20} color="var(--color-amber)" />
                    2. Weaknesses & Development Areas
                  </h2>
                  <p className={styles.sectionDesc}>
                    Constructive, fair identification of missing demonstration and areas for technical acceleration.
                  </p>
                </div>
              </header>

              <div className={styles.weaknessesGrid}>
                {(!data.weaknesses || data.weaknesses.length === 0) ? (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    No critical weaknesses detected! Your profile strongly satisfies target role requirements.
                  </p>
                ) : (
                  data.weaknesses.map((weak, idx) => (
                    <div key={idx} className={styles.weaknessCard}>
                      <div className={styles.weaknessCardTop}>
                        <span className={styles.categoryTag}>{weak.category}</span>
                        <span className={`${styles.priorityBadge} ${styles[`priorityBadge--${weak.priority || 'MEDIUM'}`]}`}>
                          {weak.priority || 'MEDIUM'} PRIORITY
                        </span>
                      </div>
                      <h3 className={styles.weaknessTitle}>{weak.issue}</h3>
                      <p className={styles.weaknessExplanation}>{weak.explanation}</p>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        <strong>Missing demonstration:</strong> {weak.evidence}
                      </div>
                      <div className={styles.suggestedFixBox}>
                        <strong>Actionable Improvement:</strong> {weak.suggestedImprovement}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          )}

          {/* ── Section: Priority Skills ── */}
          {(activeTab === 'ALL' || activeTab === 'PRIORITY_SKILLS') && (
            <article className={styles.sectionCard} id="priority-skills-section">
              <header className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <Target size={20} color="var(--color-indigo)" />
                    3. Priority Skills to Develop
                  </h2>
                  <p className={styles.sectionDesc}>
                    Ordered by role requirement and impact, synchronized with Day 26 Roadmap and Day 28 Recommendations.
                  </p>
                </div>
              </header>

              <div className={styles.prioritySkillsList}>
                {(!data.prioritySkills || data.prioritySkills.length === 0) ? (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    All target skills are strongly matched! Review learning recommendations for advanced specialization.
                  </p>
                ) : (
                  data.prioritySkills.map((ps, idx) => (
                    <div key={idx} className={styles.prioritySkillCard}>
                      <div className={styles.skillInfoBlock}>
                        <div className={styles.skillNameRow}>
                          <span className={styles.skillNameText}>{ps.skillName}</span>
                          <span className={`${styles.priorityBadge} ${styles[`priorityBadge--${ps.priority}`]}`}>
                            {ps.priority}
                          </span>
                          <span className={styles.categoryTag}>
                            {ps.requirementType} · {ps.matchingStatus === 'PARTIAL_MATCH' ? 'Partial Match' : 'Missing'}
                          </span>
                        </div>
                        <p className={styles.skillReasonText}>{ps.reason}</p>
                        <p style={{ fontSize: '11px', color: 'var(--color-navy)', margin: 0 }}>
                          <strong>Recommended focus:</strong> {ps.suggestedDirection}
                        </p>
                      </div>

                      <div className={styles.skillActionsRow}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(ps.roadmapLink || `/roadmap?resumeId=${selectedResumeId}&jobId=${selectedJobId}`)}
                        >
                          <BookOpen size={14} /> Roadmap
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(ps.recommendationLink || `/recommendations?resumeId=${selectedResumeId}&jobId=${selectedJobId}`)}
                        >
                          <GraduationCap size={14} /> Learning Plan
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          )}

          {/* ── Section: Suggested Career Improvements ── */}
          {(activeTab === 'ALL' || activeTab === 'IMPROVEMENTS') && (
            <article className={styles.sectionCard} id="career-improvements-section">
              <header className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <TrendingUp size={20} color="var(--color-indigo)" />
                    4. Suggested Career Improvements
                  </h2>
                  <p className={styles.sectionDesc}>
                    Practical, achievable next actions categorized across Technical, Project, Resume, and Professional tracks.
                  </p>
                </div>
              </header>

              {/* Sub-tabs for Improvements */}
              <div className={styles.subTabsRow}>
                <button
                  className={`${styles.subTabBtn} ${improvementSubTab === 'ALL' ? styles['subTabBtn--active'] : ''}`}
                  onClick={() => setImprovementSubTab('ALL')}
                >
                  All Actions ({counts.improvements})
                </button>
                <button
                  className={`${styles.subTabBtn} ${improvementSubTab === 'TECHNICAL' ? styles['subTabBtn--active'] : ''}`}
                  onClick={() => setImprovementSubTab('TECHNICAL')}
                >
                  <Code2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Technical ({data.careerImprovements?.technical?.length || 0})
                </button>
                <button
                  className={`${styles.subTabBtn} ${improvementSubTab === 'PROJECTS' ? styles['subTabBtn--active'] : ''}`}
                  onClick={() => setImprovementSubTab('PROJECTS')}
                >
                  <FolderGit2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Projects ({data.careerImprovements?.projects?.length || 0})
                </button>
                <button
                  className={`${styles.subTabBtn} ${improvementSubTab === 'RESUME' ? styles['subTabBtn--active'] : ''}`}
                  onClick={() => setImprovementSubTab('RESUME')}
                >
                  <FileText size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Resume ({data.careerImprovements?.resume?.length || 0})
                </button>
                <button
                  className={`${styles.subTabBtn} ${improvementSubTab === 'PROFESSIONAL' ? styles['subTabBtn--active'] : ''}`}
                  onClick={() => setImprovementSubTab('PROFESSIONAL')}
                >
                  <Users2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Professional ({data.careerImprovements?.professional?.length || 0})
                </button>
              </div>

              {/* Improvements Grid */}
              <div className={styles.improvementGrid}>
                {['technical', 'projects', 'resume', 'professional'].map((catKey) => {
                  const upperKey = catKey.toUpperCase()
                  if (improvementSubTab !== 'ALL' && improvementSubTab !== upperKey) return null
                  const items = data.careerImprovements?.[catKey] || []

                  return items.map((item, idx) => (
                    <div key={`${catKey}-${idx}`} className={styles.improvementCard}>
                      <div className={styles.improvementCardTop}>
                        <span className={styles.categoryTag}>{item.category}</span>
                        <span className={`${styles.priorityBadge} ${styles[`priorityBadge--${item.priority || 'MEDIUM'}`]}`}>
                          {item.priority || 'MEDIUM'} PRIORITY
                        </span>
                      </div>
                      <h3 className={styles.improvementTitle}>{item.title}</h3>
                      <p className={styles.improvementExplanation}>{item.explanation}</p>
                      <div style={{ fontSize: '11px', color: 'var(--color-emerald)', fontWeight: 'var(--font-medium)' }}>
                        <strong>Expected Benefit:</strong> {item.expectedBenefit}
                      </div>
                      <div className={styles.nextStepBox}>
                        <strong>Practical Next Step:</strong> {item.practicalNextStep}
                      </div>
                    </div>
                  ))
                })}
              </div>
            </article>
          )}
        </>
      )}
    </div>
  )
}

