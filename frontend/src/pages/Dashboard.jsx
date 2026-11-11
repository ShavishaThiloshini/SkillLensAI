import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  Briefcase,
  Sparkles,
  Target,
  ArrowRight,
  Clock,
  Compass,
  FileCheck,
  TrendingUp,
  Award,
  BookOpen,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getResumes } from '../services/resumeService'
import { getJobDescriptions } from '../services/jobService'
import { getAnalysisHistory } from '../services/analysisService'
import PageHeader from '../components/common/PageHeader'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import SkeletonLoader from '../components/common/SkeletonLoader'
import StatusBadge from '../components/common/StatusBadge'
import Button from '../components/common/Button'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    totalResumes: 0,
    totalJobs: 0,
    totalAnalyses: 0,
    latestScore: null,
  })
  const [recentAnalyses, setRecentAnalyses] = useState([])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [resumesRes, jobsRes, historyRes] = await Promise.allSettled([
        getResumes(),
        getJobDescriptions(),
        getAnalysisHistory({ limit: 5 }),
      ])

      let resumeCount = 0
      if (resumesRes.status === 'fulfilled' && resumesRes.value) {
        const resumesData = resumesRes.value.resumes || resumesRes.value.data || resumesRes.value
        resumeCount = Array.isArray(resumesData) ? resumesData.length : 0
      }

      let jobCount = 0
      if (jobsRes.status === 'fulfilled' && jobsRes.value) {
        const jobsData = jobsRes.value.jobs || jobsRes.value.data || jobsRes.value
        jobCount = Array.isArray(jobsData) ? jobsData.length : 0
      }

      let analysesList = []
      let totalAnalysesCount = 0
      let latestMatchScore = null

      if (historyRes.status === 'fulfilled' && historyRes.value) {
        const historyData = historyRes.value.data || historyRes.value
        analysesList = Array.isArray(historyData?.analyses)
          ? historyData.analyses
          : Array.isArray(historyData)
          ? historyData
          : []
        totalAnalysesCount = historyData?.total ?? analysesList.length
        if (analysesList.length > 0 && analysesList[0].overall_score != null) {
          latestMatchScore = Math.round(Number(analysesList[0].overall_score))
        }
      }

      setStats({
        totalResumes: resumeCount,
        totalJobs: jobCount,
        totalAnalyses: totalAnalysesCount,
        latestScore: latestMatchScore,
      })
      setRecentAnalyses(analysesList)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError(err?.message || 'Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const getScoreVariant = (score) => {
    if (score == null) return styles['scoreBadge--medium']
    if (score >= 75) return styles['scoreBadge--high']
    if (score >= 50) return styles['scoreBadge--medium']
    return styles['scoreBadge--low']
  }

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${user?.full_name || 'Professional'}`}
        subtitle="Track your resumes, target jobs, skill matches, and career readiness in one place."
        actions={
          <Button
            variant="primary"
            size="md"
            icon={Sparkles}
            onClick={() => navigate('/matching')}
          >
            New Skill Analysis
          </Button>
        }
      />

      {error ? (
        <ErrorState
          title="Could not load dashboard data"
          message={error}
          onRetry={fetchDashboardData}
        />
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className={styles.statsGrid}>
            <SkeletonLoader variant="card" height="96px" />
            <SkeletonLoader variant="card" height="96px" />
            <SkeletonLoader variant="card" height="96px" />
            <SkeletonLoader variant="card" height="96px" />
          </div>
          <SkeletonLoader variant="paragraph" count={4} />
        </div>
      ) : (
        <>
          {/* ── Key Metrics ── */}
          <section className={styles.statsGrid} aria-label="Quick metrics">
            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles['statIcon--indigo']}`}>
                <FileText size={24} aria-hidden="true" />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Uploaded Resumes</span>
                <span className={styles.statValue}>{stats.totalResumes}</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles['statIcon--cyan']}`}>
                <Briefcase size={24} aria-hidden="true" />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Target Jobs</span>
                <span className={styles.statValue}>{stats.totalJobs}</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles['statIcon--emerald']}`}>
                <Sparkles size={24} aria-hidden="true" />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Analyses Run</span>
                <span className={styles.statValue}>{stats.totalAnalyses}</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles['statIcon--amber']}`}>
                <Target size={24} aria-hidden="true" />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Latest Match</span>
                <span className={styles.statValue}>
                  {stats.latestScore != null ? `${stats.latestScore}%` : '—'}
                </span>
              </div>
            </div>
          </section>

          {/* ── Quick Action Shortcuts ── */}
          <section className={styles.section} aria-label="Quick actions">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Quick Workflows</h2>
            </div>
            <div className={styles.actionsGrid}>
              <Link to="/resumes" className={styles.actionCard}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionIcon}>
                    <FileText size={20} aria-hidden="true" />
                  </div>
                  <ArrowRight size={16} color="var(--color-text-muted)" />
                </div>
                <h3 className={styles.actionTitle}>Manage Resumes</h3>
                <p className={styles.actionDesc}>
                  Upload PDF or DOCX resumes and extract structured skills and experiences.
                </p>
              </Link>

              <Link to="/jobs" className={styles.actionCard}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionIcon}>
                    <Briefcase size={20} aria-hidden="true" />
                  </div>
                  <ArrowRight size={16} color="var(--color-text-muted)" />
                </div>
                <h3 className={styles.actionTitle}>Target Job Roles</h3>
                <p className={styles.actionDesc}>
                  Add target job descriptions to analyze required and preferred qualifications.
                </p>
              </Link>

              <Link to="/matching" className={styles.actionCard}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionIcon}>
                    <Sparkles size={20} aria-hidden="true" />
                  </div>
                  <ArrowRight size={16} color="var(--color-text-muted)" />
                </div>
                <h3 className={styles.actionTitle}>Run Skill Matching</h3>
                <p className={styles.actionDesc}>
                  Calculate match percentages and detect skill gaps against your target role.
                </p>
              </Link>

              <Link to="/career-insights" className={styles.actionCard}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionIcon}>
                    <TrendingUp size={20} aria-hidden="true" />
                  </div>
                  <ArrowRight size={16} color="var(--color-text-muted)" />
                </div>
                <h3 className={styles.actionTitle}>Career Insights</h3>
                <p className={styles.actionDesc}>
                  Review your strengths, weaknesses, readiness score, and career action items.
                </p>
              </Link>

              <Link to="/roadmap" className={styles.actionCard}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionIcon}>
                    <BookOpen size={20} aria-hidden="true" />
                  </div>
                  <ArrowRight size={16} color="var(--color-text-muted)" />
                </div>
                <h3 className={styles.actionTitle}>Learning Roadmap</h3>
                <p className={styles.actionDesc}>
                  Follow step-by-step learning guidance to bridge high-priority missing skills.
                </p>
              </Link>

              <Link to="/reports" className={styles.actionCard}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionIcon}>
                    <Award size={20} aria-hidden="true" />
                  </div>
                  <ArrowRight size={16} color="var(--color-text-muted)" />
                </div>
                <h3 className={styles.actionTitle}>Skill Gap Reports</h3>
                <p className={styles.actionDesc}>
                  Generate, preview, and download polished PDF skill gap analysis reports.
                </p>
              </Link>
            </div>
          </section>

          {/* ── Recent Analyses ── */}
          <section className={styles.section} aria-label="Recent analyses">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Recent Analyses</h2>
              {recentAnalyses.length > 0 && (
                <Link
                  to="/history"
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)',
                    color: 'var(--color-indigo)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  View all history <ArrowRight size={14} />
                </Link>
              )}
            </div>

            {recentAnalyses.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="No analyses yet"
                description="Pair your uploaded resume with a target job description to uncover skill gaps and personalized learning roadmaps."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Sparkles}
                    onClick={() => navigate('/matching')}
                  >
                    Start First Analysis
                  </Button>
                }
              />
            ) : (
              <div className={styles.recentList}>
                {recentAnalyses.map((item) => {
                  const score =
                    item.overall_score != null ? Math.round(Number(item.overall_score)) : null
                  const jobTitle =
                    item.job_title || item.target_role || item.jobDescriptionTitle || 'Target Role'
                  const company = item.company || item.jobCompany || null
                  const resumeName = item.resume_filename || item.resumeTitle || 'Resume'

                  return (
                    <div key={item.id} className={styles.analysisItem}>
                      <div className={styles.analysisInfo}>
                        <h3 className={styles.analysisTitle}>
                          {jobTitle}
                          {company && (
                            <span style={{ fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>
                              {' '}
                              at {company}
                            </span>
                          )}
                        </h3>
                        <div className={styles.analysisMeta}>
                          <span>Resume: {resumeName}</span>
                          <span>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={12} />
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className={styles.analysisScoreGroup}>
                        {score != null ? (
                          <span className={`${styles.scoreBadge} ${getScoreVariant(score)}`}>
                            {score}% Match
                          </span>
                        ) : (
                          <StatusBadge
                            status={
                              item.status === 'COMPLETED'
                                ? 'success'
                                : item.status === 'FAILED'
                                ? 'danger'
                                : 'processing'
                            }
                            label={item.status || 'PENDING'}
                          />
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/reports/${item.id}`)}
                        >
                          View Report
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

