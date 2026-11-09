import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  Sparkles,
  BookOpen,
  History,
  RefreshCw,
  Copy,
  Check,
  Target,
  AlertTriangle,
  FileText,
  Briefcase,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  Layers,
  Wand2,
  Info,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'
import { getResumes } from '../services/resumeService'
import { getJobDescriptions } from '../services/jobService'
import {
  getResumeImprovements,
  generateResumeImprovements,
} from '../services/improvementService'
import styles from './ResumeImprovements.module.css'

export default function ResumeImprovements() {
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

  // Navigation tab & filters
  const [activeTab, setActiveTab] = useState('ALL') // 'ALL' | 'SUMMARY' | 'PROJECTS' | 'KEYWORDS' | 'DESCRIPTIONS' | 'SKILLS'
  const [keywordFilter, setKeywordFilter] = useState('REQUIRED') // 'REQUIRED' | 'PREFERRED' | 'BETTER_PRESENTATION' | 'PRESENT'
  const [copiedId, setCopiedId] = useState(null)

  // Copy helper
  const handleCopy = (text, id) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2500)
    }).catch(() => {
      // Fallback
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2500)
    })
  }

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
        console.error('Failed to load selection lists:', err)
      }
    }
    loadSelectables()
    return () => { mounted = false }
  }, [])

  // Sync selected resume & job with search parameters
  useEffect(() => {
    if (selectedResumeId && selectedJobId) {
      setSearchParams({
        resumeId: selectedResumeId,
        jobId: selectedJobId,
        ...(analysisIdParam ? { analysisId: analysisIdParam } : {}),
      }, { replace: true })
    }
  }, [selectedResumeId, selectedJobId, setSearchParams, analysisIdParam])

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!selectedResumeId || !selectedJobId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await getResumeImprovements(selectedResumeId, selectedJobId)
      setData(res.data)
    } catch (err) {
      console.error('Failed to fetch resume improvements:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load resume improvements.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedResumeId, selectedJobId])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  // Re-generate suggestions
  const handleRegenerate = async () => {
    if (!selectedResumeId || !selectedJobId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await generateResumeImprovements({
        resumeId: selectedResumeId,
        jobId: selectedJobId,
      })
      setData(res.data)
    } catch (err) {
      console.error('Regenerate failed:', err)
      setError(err.response?.data?.message || err.message || 'Failed to generate suggestions.')
    } finally {
      setGenerating(false)
    }
  }

  // Active counts for tab badges
  const counts = useMemo(() => {
    if (!data) return { summary: 0, projects: 0, keywords: 0, weak: 0, skills: 0, total: 0 }
    const summaryCount = data.summary ? 1 : 0
    const projectsCount = data.projects?.length || 0
    const keywordsCount = (data.keywords?.requiredMissing?.length || 0) + (data.keywords?.preferredMissing?.length || 0)
    const weakCount = data.weakDescriptions?.length || 0
    const skillsCount = (data.skillPresentation?.deduplicatedSkills?.length || 0) + (data.skillPresentation?.missingFromSkillsSection?.length || 0)
    return {
      summary: summaryCount,
      projects: projectsCount,
      keywords: keywordsCount,
      weak: weakCount,
      skills: skillsCount,
      total: summaryCount + projectsCount + keywordsCount + weakCount + skillsCount,
    }
  }, [data])

  return (
    <div className={styles.page}>
      {/* ── Top Header ── */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AI-Powered Resume Optimization</p>
          <h1 className={styles.title}>Resume Improvement Suggestions</h1>
          <p className={styles.subtitle}>
            Targeted, truthful recommendations to enhance your professional summary, bullet points, job-relevant keywords, and technical presentation without fabricating qualifications.
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
            <BookOpen size={15} /> Skill Gap Roadmap
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
            <label htmlFor="job-select" className={styles.selectLabel}>Target Job Description</label>
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

      {/* ── Factual Integrity Disclaimer Banner ── */}
      <aside className={styles.disclaimerBanner} role="note">
        <Info size={20} />
        <div className={styles.disclaimerText}>
          <strong>Factual Integrity & Ethical Recommendation Standard</strong>
          <p>
            Suggestions are designed to refine clarity and emphasize your real competencies. Never adopt a suggestion or insert keywords for technologies, metrics, or responsibilities you have not personally performed.
          </p>
        </div>
      </aside>

      {/* ── Loading / Error / Empty States ── */}
      {loading && (
        <div className={styles.emptyState}>
          <Spinner size="lg" />
          <p>Analyzing resume and generating improvement recommendations…</p>
        </div>
      )}

      {error && !loading && (
        <div className={styles.emptyState}>
          <AlertTriangle size={32} color="var(--color-amber)" />
          <h2 className={styles.emptyTitle}>Unable to Load Improvements</h2>
          <p className={styles.emptyDesc}>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchSuggestions}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      )}

      {!loading && !error && !data && (
        <div className={styles.emptyState}>
          <Wand2 size={36} color="var(--color-indigo)" />
          <h2 className={styles.emptyTitle}>No Improvement Suggestions Available</h2>
          <p className={styles.emptyDesc}>
            Select a resume and job description above to produce personalized improvement suggestions.
          </p>
          <Button variant="primary" size="sm" onClick={handleRegenerate} disabled={generating}>
            Generate Suggestions
          </Button>
        </div>
      )}

      {/* ── Main Suggestions Content ── */}
      {!loading && !error && data && (
        <>
          {/* KPI Banner */}
          <section className={styles.kpiGrid} aria-label="Resume Optimization Readiness Metrics">
            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles['kpiIconBox--indigo']}`}>
                <Sparkles size={22} />
              </div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiValue}>{data.metrics?.totalSuggestions || counts.total}</span>
                <span className={styles.kpiLabel}>Total Suggestions</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles['kpiIconBox--rose']}`}>
                <AlertTriangle size={22} />
              </div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiValue}>{data.metrics?.highPriorityCount || 0}</span>
                <span className={styles.kpiLabel}>High Priority Actions</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles['kpiIconBox--amber']}`}>
                <Target size={22} />
              </div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiValue}>{data.metrics?.missingKeywordsCount || counts.keywords}</span>
                <span className={styles.kpiLabel}>Missing Role Keywords</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles['kpiIconBox--emerald']}`}>
                <TrendingUp size={22} />
              </div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiValue}>{data.metrics?.readinessScore || 75}%</span>
                <span className={styles.kpiLabel}>Resume Alignment Score</span>
              </div>
            </div>
          </section>

          {/* Tab Navigation */}
          <nav className={styles.tabBar} aria-label="Improvement Categories">
            <button
              className={`${styles.tabButton} ${activeTab === 'ALL' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              All Suggestions <span className={styles.tabCount}>{counts.total}</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'SUMMARY' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('SUMMARY')}
            >
              Professional Summary <span className={styles.tabCount}>{counts.summary}</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'PROJECTS' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('PROJECTS')}
            >
              Project Descriptions <span className={styles.tabCount}>{counts.projects}</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'KEYWORDS' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('KEYWORDS')}
            >
              Missing Keywords <span className={styles.tabCount}>{counts.keywords}</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'DESCRIPTIONS' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('DESCRIPTIONS')}
            >
              Weak Descriptions <span className={styles.tabCount}>{counts.weak}</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'SKILLS' ? styles['tabButton--active'] : ''}`}
              onClick={() => setActiveTab('SKILLS')}
            >
              Skill Presentation <span className={styles.tabCount}>{counts.skills}</span>
            </button>
          </nav>

          {/* ── Category 1: Professional Summary ── */}
          {(activeTab === 'ALL' || activeTab === 'SUMMARY') && data.summary && (
            <article className={styles.sectionCard} id="summary-section">
              <header className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <FileText size={20} color="var(--color-indigo)" />
                    1. Professional Summary Enhancement
                  </h2>
                  <p className={styles.sectionDesc}>
                    Compare your current summary with an improved version aligned with {data.jobTitle}.
                  </p>
                </div>
                <span className={`${styles.priorityBadge} ${styles[`priorityBadge--${data.summary.priority || 'MEDIUM'}`]}`}>
                  {data.summary.priority || 'MEDIUM'} PRIORITY
                </span>
              </header>

              <div className={styles.diffContainer}>
                {/* Original */}
                <div className={styles.diffBox}>
                  <div className={styles.diffHeader}>
                    <span className={`${styles.diffBadge} ${styles['diffBadge--original']}`}>
                      Original Resume Summary
                    </span>
                  </div>
                  <p className={styles.diffText}>
                    {data.summary.originalSummary || 'No summary identified in the uploaded resume.'}
                  </p>
                  {data.summary.identifiedProblems?.length > 0 && (
                    <div className={styles.diffMeta}>
                      <div className={styles.diffMetaItem}>
                        <XCircle size={14} color="#e11d48" />
                        <div>
                          <strong>Identified Opportunities:</strong>
                          <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                            {data.summary.identifiedProblems.map((p, idx) => (
                              <li key={idx}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Improved */}
                <div className={`${styles.diffBox} ${styles['diffBox--improved']}`}>
                  <div className={styles.diffHeader}>
                    <span className={`${styles.diffBadge} ${styles['diffBadge--improved']}`}>
                      Recommended Rewrite
                    </span>
                    <button
                      className={`${styles.copyButton} ${copiedId === 'summary' ? styles['copyButton--copied'] : ''}`}
                      onClick={() => handleCopy(data.summary.suggestedSummary, 'summary')}
                      title="Copy improved summary"
                    >
                      {copiedId === 'summary' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === 'summary' ? 'Copied!' : 'Copy Suggestion'}
                    </button>
                  </div>
                  <p className={styles.diffText}>
                    {data.summary.suggestedSummary}
                  </p>
                  <div className={styles.diffMeta}>
                    <div className={styles.diffMetaItem}>
                      <CheckCircle2 size={14} color="var(--color-emerald)" />
                      <div>
                        <strong>Why this improves your resume:</strong> {data.summary.reason}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* ── Category 2: Project Descriptions ── */}
          {(activeTab === 'ALL' || activeTab === 'PROJECTS') && (
            <article className={styles.sectionCard} id="projects-section">
              <header className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <Layers size={20} color="var(--color-indigo)" />
                    2. Stronger Project Descriptions
                  </h2>
                  <p className={styles.sectionDesc}>
                    Restructured using: <strong>Action Verb + Implementation Detail + Technology Used + Measurable Result</strong>.
                  </p>
                </div>
              </header>

              <div className={styles.projectList}>
                {(!data.projects || data.projects.length === 0) ? (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    No project entries found in resume. Consider creating a technical projects section highlighting your core applications.
                  </p>
                ) : (
                  data.projects.map((proj, idx) => (
                    <div key={idx} className={styles.projectCard}>
                      <div className={styles.projectCardTop}>
                        <h3 className={styles.projectName}>{proj.projectName}</h3>
                        <div className={styles.tagList}>
                          {proj.technologiesEmphasized?.map((t, tIdx) => (
                            <span key={tIdx} className={styles.techTag}>{t}</span>
                          ))}
                          <span className={`${styles.priorityBadge} ${styles[`priorityBadge--${proj.priority || 'MEDIUM'}`]}`}>
                            {proj.priority || 'MEDIUM'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.diffContainer}>
                        {/* Original */}
                        <div className={styles.diffBox}>
                          <div className={styles.diffHeader}>
                            <span className={`${styles.diffBadge} ${styles['diffBadge--original']}`}>Original</span>
                          </div>
                          <p className={styles.diffText}>{proj.originalBullet}</p>
                        </div>

                        {/* Improved */}
                        <div className={`${styles.diffBox} ${styles['diffBox--improved']}`}>
                          <div className={styles.diffHeader}>
                            <span className={`${styles.diffBadge} ${styles['diffBadge--improved']}`}>
                              Action-Oriented Rewrite
                            </span>
                            <button
                              className={`${styles.copyButton} ${copiedId === `proj-${idx}` ? styles['copyButton--copied'] : ''}`}
                              onClick={() => handleCopy(proj.improvedBullet, `proj-${idx}`)}
                              title="Copy project bullet"
                            >
                              {copiedId === `proj-${idx}` ? <Check size={12} /> : <Copy size={12} />}
                              {copiedId === `proj-${idx}` ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <p className={styles.diffText}>{proj.improvedBullet}</p>
                          <div className={styles.diffMeta}>
                            <div className={styles.diffMetaItem}>
                              <CheckCircle2 size={14} color="var(--color-emerald)" />
                              <span>{proj.improvementExplanation}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          )}

          {/* ── Category 3: Missing Job-Relevant Keywords ── */}
          {(activeTab === 'ALL' || activeTab === 'KEYWORDS') && (
            <article className={styles.sectionCard} id="keywords-section">
              <header className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <Target size={20} color="var(--color-indigo)" />
                    3. Missing Job-Relevant Keywords
                  </h2>
                  <p className={styles.sectionDesc}>
                    Essential keywords extracted from the target job posting to maximize ATS visibility.
                  </p>
                </div>
              </header>

              {/* Sub-tabs for Keywords */}
              <div className={styles.keywordSubTabs}>
                <button
                  className={`${styles.subTabButton} ${keywordFilter === 'REQUIRED' ? styles['subTabButton--active'] : ''}`}
                  onClick={() => setKeywordFilter('REQUIRED')}
                >
                  Required Missing ({data.keywords?.requiredMissing?.length || 0})
                </button>
                <button
                  className={`${styles.subTabButton} ${keywordFilter === 'PREFERRED' ? styles['subTabButton--active'] : ''}`}
                  onClick={() => setKeywordFilter('PREFERRED')}
                >
                  Preferred Missing ({data.keywords?.preferredMissing?.length || 0})
                </button>
                <button
                  className={`${styles.subTabButton} ${keywordFilter === 'BETTER_PRESENTATION' ? styles['subTabButton--active'] : ''}`}
                  onClick={() => setKeywordFilter('BETTER_PRESENTATION')}
                >
                  Needs Better Presentation ({data.keywords?.needsBetterPresentation?.length || 0})
                </button>
                <button
                  className={`${styles.subTabButton} ${keywordFilter === 'PRESENT' ? styles['subTabButton--active'] : ''}`}
                  onClick={() => setKeywordFilter('PRESENT')}
                >
                  Already Present ({data.keywords?.alreadyPresent?.length || 0})
                </button>
              </div>

              {/* Keyword List */}
              <div className={styles.keywordGrid}>
                {keywordFilter === 'REQUIRED' && (
                  data.keywords?.requiredMissing?.length ? (
                    data.keywords.requiredMissing.map((kw, idx) => (
                      <div key={idx} className={styles.keywordCard}>
                        <div className={styles.keywordCardTop}>
                          <span className={styles.keywordName}>{kw.keyword}</span>
                          <span className={`${styles.priorityBadge} ${styles['priorityBadge--HIGH']}`}>REQUIRED</span>
                        </div>
                        <p className={styles.keywordWhy}>{kw.whyItMatters}</p>
                        <p className={styles.keywordPlacement}>
                          <strong>Natural Placement:</strong> {kw.suggestedPlacement}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                      Great job! All core required keywords from the job description are present in your resume.
                    </p>
                  )
                )}

                {keywordFilter === 'PREFERRED' && (
                  data.keywords?.preferredMissing?.length ? (
                    data.keywords.preferredMissing.map((kw, idx) => (
                      <div key={idx} className={styles.keywordCard}>
                        <div className={styles.keywordCardTop}>
                          <span className={styles.keywordName}>{kw.keyword}</span>
                          <span className={`${styles.priorityBadge} ${styles['priorityBadge--MEDIUM']}`}>PREFERRED</span>
                        </div>
                        <p className={styles.keywordWhy}>{kw.whyItMatters}</p>
                        <p className={styles.keywordPlacement}>
                          <strong>Suggested Placement:</strong> {kw.suggestedPlacement}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                      No missing preferred keywords detected.
                    </p>
                  )
                )}

                {keywordFilter === 'BETTER_PRESENTATION' && (
                  data.keywords?.needsBetterPresentation?.length ? (
                    data.keywords.needsBetterPresentation.map((kw, idx) => (
                      <div key={idx} className={styles.keywordCard}>
                        <div className={styles.keywordCardTop}>
                          <span className={styles.keywordName}>{kw.keyword}</span>
                          <span className={`${styles.priorityBadge} ${styles['priorityBadge--MEDIUM']}`}>IN TEXT</span>
                        </div>
                        <p className={styles.keywordWhy}>{kw.whyItMatters}</p>
                        <p className={styles.keywordPlacement}>
                          <strong>Recommended Fix:</strong> {kw.suggestedPlacement}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                      All identified skills in your experience are properly featured in your skills section.
                    </p>
                  )
                )}

                {keywordFilter === 'PRESENT' && (
                  data.keywords?.alreadyPresent?.length ? (
                    data.keywords.alreadyPresent.map((kw, idx) => (
                      <div key={idx} className={styles.keywordCard}>
                        <div className={styles.keywordCardTop}>
                          <span className={styles.keywordName}>{kw.keyword}</span>
                          <span className={`${styles.priorityBadge} ${styles['priorityBadge--LOW']}`}>VERIFIED</span>
                        </div>
                        <p className={styles.keywordWhy}>{kw.whyItMatters}</p>
                        <p className={styles.keywordPlacement}>
                          <strong>Placement Status:</strong> {kw.suggestedPlacement}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                      No matching keywords detected.
                    </p>
                  )
                )}
              </div>

              {/* Skill Gap Roadmap Notice */}
              <div className={styles.roadmapNotice}>
                <span>
                  Missing skills you don't yet possess? Follow our step-by-step roadmap to acquire them.
                </span>
                <Link to={`/roadmap?resumeId=${selectedResumeId}&jobId=${selectedJobId}`}>
                  Open Skill Gap Roadmap <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </Link>
              </div>
            </article>
          )}

          {/* ── Category 4: Weak or Unclear Descriptions ── */}
          {(activeTab === 'ALL' || activeTab === 'DESCRIPTIONS') && (
            <article className={styles.sectionCard} id="weak-section">
              <header className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <Wand2 size={20} color="var(--color-indigo)" />
                    4. Weak or Unclear Descriptions
                  </h2>
                  <p className={styles.sectionDesc}>
                    Transform passive duty-based statements and clichés into high-impact accomplishments.
                  </p>
                </div>
              </header>

              <div className={styles.weakList}>
                {(!data.weakDescriptions || data.weakDescriptions.length === 0) ? (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    No weak phrases or clichés detected. Your resume uses active, professional language.
                  </p>
                ) : (
                  data.weakDescriptions.map((item, idx) => (
                    <div key={idx} className={styles.weakCard}>
                      <div className={styles.weakCardTop}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={styles.weakSectionTag}>{item.section}</span>
                          <span className={styles.weakProblemTag}>{item.identifiedProblem}</span>
                        </div>
                        <span className={`${styles.priorityBadge} ${styles[`priorityBadge--${item.priority || 'MEDIUM'}`]}`}>
                          {item.priority || 'MEDIUM'} PRIORITY
                        </span>
                      </div>

                      <div className={styles.diffContainer}>
                        {/* Original */}
                        <div className={styles.diffBox}>
                          <div className={styles.diffHeader}>
                            <span className={`${styles.diffBadge} ${styles['diffBadge--original']}`}>Original</span>
                          </div>
                          <p className={styles.diffText}>{item.originalText}</p>
                          <div className={styles.diffMeta}>
                            <div className={styles.diffMetaItem}>
                              <XCircle size={14} color="#e11d48" />
                              <span>{item.whyToImprove}</span>
                            </div>
                          </div>
                        </div>

                        {/* Improved */}
                        <div className={`${styles.diffBox} ${styles['diffBox--improved']}`}>
                          <div className={styles.diffHeader}>
                            <span className={`${styles.diffBadge} ${styles['diffBadge--improved']}`}>
                              High-Impact Rewrite
                            </span>
                            <button
                              className={`${styles.copyButton} ${copiedId === `weak-${idx}` ? styles['copyButton--copied'] : ''}`}
                              onClick={() => handleCopy(item.suggestedRewrite, `weak-${idx}`)}
                              title="Copy rewrite"
                            >
                              {copiedId === `weak-${idx}` ? <Check size={12} /> : <Copy size={12} />}
                              {copiedId === `weak-${idx}` ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <p className={styles.diffText}>{item.suggestedRewrite}</p>
                          {item.recommendedVerbs?.length > 0 && (
                            <div className={styles.diffMeta}>
                              <div className={styles.diffMetaItem}>
                                <CheckCircle2 size={14} color="var(--color-emerald)" />
                                <span><strong>Recommended Action Verbs:</strong> {item.recommendedVerbs.join(', ')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          )}

          {/* ── Category 5: Skill Presentation Improvements ── */}
          {(activeTab === 'ALL' || activeTab === 'SKILLS') && (
            <article className={styles.sectionCard} id="skills-section">
              <header className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    <Layers size={20} color="var(--color-indigo)" />
                    5. Skill Presentation Improvements
                  </h2>
                  <p className={styles.sectionDesc}>
                    Logical categorization, duplicate alias elimination, and target job role prioritization.
                  </p>
                </div>
              </header>

              {/* Deduplication Box (if duplicates exist) */}
              {data.skillPresentation?.deduplicatedSkills?.length > 0 && (
                <div className={styles.dedupBox}>
                  <h3 className={styles.dedupTitle}>
                    <AlertTriangle size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                    Duplicate or Redundant Skill Aliases Detected
                  </h3>
                  <ul className={styles.dedupList}>
                    {data.skillPresentation.deduplicatedSkills.map((d, idx) => (
                      <li key={idx}>{d.action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Categories */}
              <div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-navy)', marginBottom: 'var(--space-3)' }}>
                  Recommended Categorized Layout (Job-Matching Skills Prioritized First)
                </h3>
                <div className={styles.skillCategoriesGrid}>
                  {Object.entries(data.skillPresentation?.recommendedCategories || {}).map(([categoryName, skillsList]) => (
                    <div key={categoryName} className={styles.skillCategoryBox}>
                      <h4 className={styles.skillCategoryTitle}>
                        <CheckCircle2 size={16} color="var(--color-indigo)" />
                        {categoryName}
                      </h4>
                      <div className={styles.skillChips}>
                        {skillsList.map((skill, sIdx) => {
                          const isPrioritized = sIdx < 2
                          return (
                            <span
                              key={sIdx}
                              className={`${styles.skillChip} ${isPrioritized ? styles['skillChip--prioritized'] : ''}`}
                            >
                              {skill}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing from Skills section */}
              {data.skillPresentation?.missingFromSkillsSection?.length > 0 && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-navy)' }}>
                    Skills Mentioned in Experience but Missing from Skills Section:
                  </h4>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                    {data.skillPresentation.missingFromSkillsSection.map((m, idx) => (
                      <li key={idx}>{m.recommendation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          )}
        </>
      )}
    </div>
  )
}

