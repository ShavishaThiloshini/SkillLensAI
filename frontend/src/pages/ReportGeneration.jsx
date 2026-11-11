import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  FileDown,
  FileText,
  History,
  RefreshCw,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  BookOpen,
  ArrowLeft,
  Briefcase,
  Sparkles,
} from 'lucide-react'
import Button from '../components/common/Button'
import PageHeader from '../components/common/PageHeader'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import SkeletonLoader from '../components/common/SkeletonLoader'
import Spinner from '../components/common/Spinner'
import { getAnalysisHistory } from '../services/analysisService'
import { getReportPreview, downloadReportPdf } from '../services/reportService'
import styles from './ReportGeneration.module.css'

export default function ReportGeneration() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const analysisIdParam = searchParams.get('analysisId')

  // Selection & analysis list
  const [analyses, setAnalyses] = useState([])
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(analysisIdParam || '')

  // Data states
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(null)

  // 1. Fetch available analysis history records for selection
  useEffect(() => {
    let mounted = true
    async function loadAnalyses() {
      try {
        const res = await getAnalysisHistory({ limit: 50, sortBy: 'most_recent' })
        if (!mounted) return
        const records = res.data?.records || []
        setAnalyses(records)

        if (!selectedAnalysisId && records.length > 0) {
          setSelectedAnalysisId(String(records[0].id))
        }
      } catch (err) {
        console.error('Failed to load analysis history for reports:', err)
      }
    }
    loadAnalyses()
    return () => { mounted = false }
  }, [])

  // 2. Sync selection with search params
  useEffect(() => {
    if (selectedAnalysisId) {
      setSearchParams({ analysisId: selectedAnalysisId }, { replace: true })
    }
  }, [selectedAnalysisId, setSearchParams])

  // 3. Fetch structured report preview
  const fetchPreview = useCallback(async () => {
    if (!selectedAnalysisId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await getReportPreview(selectedAnalysisId)
      setReportData(res.data)
    } catch (err) {
      console.error('Failed to load report preview:', err)
      setError(err.response?.data?.message || err.message || 'Failed to generate report preview.')
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedAnalysisId])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  // 4. Download PDF handler
  const handleDownload = async () => {
    if (!selectedAnalysisId) return
    setDownloading(true)
    try {
      await downloadReportPdf(selectedAnalysisId)
    } catch (err) {
      console.error('Download PDF failed:', err)
      alert(err.response?.data?.message || 'Failed to download report PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }
  const downloadPdf = handleDownload

  return (
    <div className={styles.page}>
      {/* ── Top Header ── */}
      <PageHeader
        eyebrow="Exportable PDF Documentation"
        title="AI Resume Skill Gap Report"
        subtitle="Generate, preview, and download a publication-ready PDF summary of your resume analysis, matching evidence, skill gaps, personalized recommendations, and learning roadmap."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/history')}
            >
              <History size={15} /> Analysis History
            </Button>
            {selectedAnalysisId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/analysis-results?analysisId=${selectedAnalysisId}`)}
              >
                <TrendingUp size={15} /> Results View
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownload}
              disabled={downloading || !reportData || loading}
            >
              {downloading ? <Spinner size="sm" /> : <FileDown size={15} />}
              {downloading ? 'Generating PDF…' : 'Download PDF Report'}
            </Button>
          </>
        }
      />

      {/* ── Analysis Selector Bar ── */}
      <section className={styles.selectorBar} aria-label="Select Analysis for Report">
        <div className={styles.selectorLeft}>
          <label htmlFor="analysis-select" className={styles.selectLabel}>
            Selected Analysis:
          </label>
          <select
            id="analysis-select"
            className={styles.selectInput}
            value={selectedAnalysisId}
            onChange={(e) => setSelectedAnalysisId(e.target.value)}
          >
            {analyses.length === 0 && <option value="">No completed analyses found</option>}
            {analyses.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} — {a.jobTitle} ({a.company || 'Organization'}) · {a.overallMatch}% Match
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPreview}
          disabled={loading || !selectedAnalysisId}
        >
          <RefreshCw size={14} /> Refresh Preview
        </Button>
      </section>

      {/* ── Loading / Error / Empty States ── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-6) 0' }}>
          <SkeletonLoader variant="paragraph" count={3} />
          <SkeletonLoader variant="card" height="300px" />
        </div>
      )}

      {error && !loading && (
        <ErrorState
          title="Unable to Load Report"
          message={error}
          onRetry={fetchPreview}
        />
      )}

      {!loading && !error && !reportData && (
        <EmptyState
          icon={FileText}
          title="No Analysis Selected"
          description="Please select an existing completed analysis above to preview and download your skill gap report."
          action={
            <Button variant="primary" size="sm" onClick={() => navigate('/history')}>
              Go to Analysis History
            </Button>
          }
        />
      )}

      {/* ── Main Preview Content ── */}
      {!loading && !error && reportData && (
        <>
          {/* Quick KPI Strip */}
          <section className={styles.kpiStrip} aria-label="Report Metrics Overview">
            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles['kpiIconBox--indigo']}`}>
                <Award size={20} />
              </div>
              <div>
                <div className={styles.kpiVal}>{Math.round(reportData.scores.overall || 0)}%</div>
                <div className={styles.kpiLbl}>Overall Match</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles['kpiIconBox--emerald']}`}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className={styles.kpiVal}>{reportData.matchingSkills.totalMatchedCount}</div>
                <div className={styles.kpiLbl}>Matching Skills</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles['kpiIconBox--rose']}`}>
                <XCircle size={20} />
              </div>
              <div>
                <div className={styles.kpiVal}>{reportData.missingSkills.totalMissingCount}</div>
                <div className={styles.kpiLbl}>Identified Gaps</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles['kpiIconBox--amber']}`}>
                <BookOpen size={20} />
              </div>
              <div>
                <div className={styles.kpiVal}>{reportData.roadmap.length}</div>
                <div className={styles.kpiLbl}>Roadmap Steps</div>
              </div>
            </div>
          </section>

          {/* On-screen A4 Paper Preview */}
          <article className={styles.previewPaper} aria-label="A4 Report Sheet Preview">
            {/* Header Banner */}
            <div className={styles.docHeader}>
              <div>
                <div className={styles.docBranding}>SKILLLENS AI</div>
                <h2 className={styles.docTitle}>AI Resume Skill Gap Report</h2>
              </div>
              <div className={styles.docMeta}>
                <span>Report Date: {new Date(reportData.reportGenerationDate).toLocaleDateString()}</span>
                <span>Analysis #{reportData.analysisId}</span>
              </div>
            </div>

            {/* Metadata Bar */}
            <div className={styles.docSubBar}>
              <div>
                {reportData.resume.candidateName && <strong>Candidate: {reportData.resume.candidateName}  |  </strong>}
                <span>Resume: {reportData.resume.filename}</span>
              </div>
              <div>
                <strong>Role: {reportData.job.title} ({reportData.job.company})</strong>
              </div>
            </div>

            {/* Section 1: Scores */}
            <section className={styles.docSection}>
              <h3 className={styles.docSectionTitle}>
                <Award size={18} color="var(--color-indigo)" />
                1. Overall Match Score & Score Breakdown
              </h3>
              <div className={styles.scoreGrid}>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreItemLabel}>Overall Match</div>
                  <div className={styles.scoreItemVal}>{reportData.scores.overall !== null ? `${Math.round(reportData.scores.overall)}%` : 'N/A'}</div>
                </div>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreItemLabel}>Skills (50%)</div>
                  <div className={styles.scoreItemVal} style={{ color: 'var(--color-emerald)' }}>
                    {reportData.scores.skills !== null ? `${Math.round(reportData.scores.skills)}%` : 'N/A'}
                  </div>
                </div>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreItemLabel}>Experience (25%)</div>
                  <div className={styles.scoreItemVal} style={{ color: 'var(--color-amber)' }}>
                    {reportData.scores.experience !== null ? `${Math.round(reportData.scores.experience)}%` : 'N/A'}
                  </div>
                </div>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreItemLabel}>Education (15%)</div>
                  <div className={styles.scoreItemVal} style={{ color: '#2563eb' }}>
                    {reportData.scores.education !== null ? `${Math.round(reportData.scores.education)}%` : 'N/A'}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                {reportData.scores.explanation}
              </p>
            </section>

            {/* Section 2: Resume Summary */}
            <section className={styles.docSection}>
              <h3 className={styles.docSectionTitle}>
                <FileText size={18} color="var(--color-emerald)" />
                2. Candidate Resume Summary
              </h3>
              <div className={styles.kvList}>
                {reportData.resume.candidateName && (
                  <div className={styles.kvRow}>
                    <span className={styles.kvKey}>Candidate Name:</span>
                    <span className={styles.kvVal}>{reportData.resume.candidateName}</span>
                  </div>
                )}
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Executive Summary:</span>
                  <span className={styles.kvVal}>{reportData.resume.summary}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Extracted Skills:</span>
                  <span className={styles.kvVal}>{reportData.resume.skills.slice(0, 16).join(', ') || 'None extracted'}</span>
                </div>
                {reportData.resume.experience.length > 0 && (
                  <div className={styles.kvRow}>
                    <span className={styles.kvKey}>Experience:</span>
                    <span className={styles.kvVal}>
                      {reportData.resume.experience.map((e) => `${e.role || e.title || 'Role'} at ${e.company || 'Company'}`).join('  |  ')}
                    </span>
                  </div>
                )}
                {reportData.resume.projects.length > 0 && (
                  <div className={styles.kvRow}>
                    <span className={styles.kvKey}>Key Projects:</span>
                    <span className={styles.kvVal}>
                      {reportData.resume.projects.map((p) => `${p.name}: ${p.description || 'Project'}`).join('  |  ')}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Section 3: Target Role */}
            <section className={styles.docSection}>
              <h3 className={styles.docSectionTitle}>
                <Briefcase size={18} color="var(--color-amber)" />
                3. Target Role Specifications
              </h3>
              <div className={styles.kvList}>
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Target Position:</span>
                  <span className={styles.kvVal}>{reportData.job.title}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Hiring Organization:</span>
                  <span className={styles.kvVal}>{reportData.job.company}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Required Skills:</span>
                  <span className={styles.kvVal}>{reportData.job.requiredSkills.join(', ') || 'None specified'}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Preferred Skills:</span>
                  <span className={styles.kvVal}>{reportData.job.preferredSkills.join(', ') || 'None specified'}</span>
                </div>
              </div>
            </section>

            {/* Section 4: Matching Skills */}
            <section className={styles.docSection}>
              <h3 className={styles.docSectionTitle}>
                <CheckCircle2 size={18} color="var(--color-emerald)" />
                4. Matching Skills (Evidence-Validated)
              </h3>
              <div className={styles.skillsList}>
                {[...reportData.matchingSkills.strong, ...reportData.matchingSkills.partial].slice(0, 6).map((m, idx) => (
                  <div key={idx} className={styles.skillEntry}>
                    <div className={styles.skillEntryLeft}>
                      <span className={styles.skillEntryTitle}>{m.name}</span>
                      <span className={styles.skillEntryEvidence}>{m.evidence || m.explanation}</span>
                    </div>
                    <span className={`${styles.badge} ${m.evidence?.includes('Strong') || !m.matchedSkill ? styles['badge--strong'] : styles['badge--partial']}`}>
                      {m.requirementType}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 5: Missing Skills */}
            <section className={styles.docSection}>
              <h3 className={styles.docSectionTitle}>
                <XCircle size={18} color="#e11d48" />
                5. Identified Skill Gaps (To Develop)
              </h3>
              <div className={styles.skillsList}>
                {[...reportData.missingSkills.required, ...reportData.missingSkills.preferred].slice(0, 6).map((g, idx) => (
                  <div key={idx} className={styles.skillEntry}>
                    <div className={styles.skillEntryLeft}>
                      <span className={styles.skillEntryTitle}>{g.name}</span>
                      <span className={styles.skillEntryEvidence}>{g.explanation || 'Skill gap identified for role.'}</span>
                    </div>
                    <span className={`${styles.badge} ${g.requirementType === 'REQUIRED' ? styles['badge--missingReq'] : styles['badge--missingPref']}`}>
                      {g.requirementType === 'REQUIRED' ? 'Required Gap' : 'Preferred Gap'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 6: Recommendations */}
            <section className={styles.docSection}>
              <h3 className={styles.docSectionTitle}>
                <Sparkles size={18} color="var(--color-indigo)" />
                6. Personalized Actionable Recommendations
              </h3>
              <div className={styles.recBlock}>
                {reportData.recommendations.technical?.slice(0, 2).map((item, idx) => (
                  <div key={`tech-${idx}`} className={styles.recItem}>
                    <span className={styles.recItemTitle}>Technical: {item.title}</span>
                    <p className={styles.recItemText}>{item.explanation}</p>
                  </div>
                ))}
                {reportData.recommendations.projects?.slice(0, 2).map((item, idx) => (
                  <div key={`proj-${idx}`} className={styles.recItem} style={{ borderLeftColor: 'var(--color-emerald)' }}>
                    <span className={styles.recItemTitle}>Project: {item.title}</span>
                    <p className={styles.recItemText}>{item.explanation}</p>
                  </div>
                ))}
                {reportData.recommendations.resume?.slice(0, 2).map((item, idx) => (
                  <div key={`res-${idx}`} className={styles.recItem} style={{ borderLeftColor: 'var(--color-amber)' }}>
                    <span className={styles.recItemTitle}>Resume: {item.title}</span>
                    <p className={styles.recItemText}>{item.explanation}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 7: Learning Roadmap */}
            <section className={styles.docSection}>
              <h3 className={styles.docSectionTitle}>
                <BookOpen size={18} color="var(--color-indigo)" />
                7. Priority Learning Roadmap
              </h3>
              <div className={styles.roadmapGrid}>
                {reportData.roadmap.slice(0, 5).map((step, idx) => (
                  <div key={idx} className={styles.roadmapStep}>
                    <div>
                      <strong style={{ color: 'var(--color-navy)' }}>Step {step.stepOrder}: {step.title}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {step.description}
                      </div>
                    </div>
                    <span className={`${styles.badge} ${step.status === 'COMPLETED' ? styles['badge--strong'] : styles['badge--partial']}`}>
                      {step.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Document Footer */}
            <footer className={styles.docFooter}>
              <span>SkillLens AI — AI-Powered Resume & Skill Gap Analyzer</span>
              <span>Generated from verified saved analysis #{reportData.analysisId}</span>
            </footer>
          </article>
        </>
      )}
    </div>
  )
}
