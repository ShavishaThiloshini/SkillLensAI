import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Circle,
  GraduationCap,
  Award,
  Wrench,
  Code2,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  BarChart2,
  ShieldCheck,
  Info,
} from 'lucide-react'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'
import {
  getJobDescriptionById,
  getJobRequirements,
  extractJobRequirements,
} from '../services/jobService'
import styles from './JobAnalysis.module.css'

/**
 * SkillLens AI — Day 17: Job Analysis UI
 *
 * Dedicated full-page view of extracted job requirements for a saved job description.
 * Displays: Required Skills, Preferred Skills, Experience, Education,
 *           Tools, Technologies, and Certifications.
 */

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatExperienceRange(exp) {
  if (!exp) return 'Not specified'
  const { minimumYears, maximumYears } = exp
  if (minimumYears !== null && maximumYears !== null) {
    return `${minimumYears}–${maximumYears} years`
  }
  if (minimumYears !== null) {
    return `${minimumYears}+ years`
  }
  return 'Not specified'
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function SectionCard({ id, icon: Icon, iconClass, title, subtitle, badge, children }) {
  return (
    <section className={styles.sectionCard} id={id} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionCardHeader}>
        <div className={styles.sectionCardTitleGroup}>
          <div className={`${styles.sectionIconBox} ${iconClass}`}>
            <Icon size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 className={styles.sectionCardTitle} id={`${id}-title`}>{title}</h2>
            {subtitle && (
              <p className={styles.sectionCardSubtitle}>{subtitle}</p>
            )}
          </div>
        </div>
        {badge !== undefined && badge !== null && (
          <span className={styles.sectionBadge}>{badge}</span>
        )}
      </div>
      <div className={styles.sectionCardBody}>{children}</div>
    </section>
  )
}

function SkillItem({ skill, isRequired }) {
  return (
    <li className={`${styles.skillItem} ${isRequired ? styles.skillItemRequired : styles.skillItemPreferred}`}>
      <span
        className={`${styles.skillIcon} ${isRequired ? styles.skillIconRequired : styles.skillIconPreferred}`}
        aria-label={isRequired ? 'Required' : 'Preferred'}
      >
        {isRequired ? (
          <CheckCircle2 size={16} />
        ) : (
          <Circle size={16} />
        )}
      </span>
      <span className={styles.skillName}>{skill.name}</span>
      {skill.category && skill.category !== 'OTHER' && (
        <span className={`${styles.skillTag} ${isRequired ? styles.skillTagRequired : styles.skillTagPreferred}`}>
          {skill.category}
        </span>
      )}
    </li>
  )
}

function EmptyCategory({ message }) {
  return (
    <div className={styles.emptyCategory} role="status">
      <Info size={15} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────────

export default function JobAnalysis() {
  const { id } = useParams()
  const navigate = useNavigate()

  const jobId = Number(id)

  // Job data
  const [job, setJob] = useState(null)
  const [isLoadingJob, setIsLoadingJob] = useState(true)
  const [jobError, setJobError] = useState('')

  // Requirements data
  const [requirements, setRequirements] = useState(null)
  const [isLoadingReqs, setIsLoadingReqs] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState('')
  const [extractionSuccess, setExtractionSuccess] = useState('')
  const [isExtracted, setIsExtracted] = useState(false)

  // ── Load job detail ────────────────────────────────────────────────────────
  const loadJob = useCallback(async () => {
    if (!jobId || Number.isNaN(jobId)) {
      setJobError('Invalid job description ID.')
      setIsLoadingJob(false)
      return
    }

    setIsLoadingJob(true)
    setJobError('')
    try {
      const data = await getJobDescriptionById(jobId)
      if (data.success && data.job) {
        setJob(data.job)
      } else {
        setJobError(data.message || 'Job description not found.')
      }
    } catch (err) {
      setJobError(
        err.response?.data?.message ||
          'Unable to load job description. Please check your connection and try again.'
      )
    } finally {
      setIsLoadingJob(false)
    }
  }, [jobId])

  // ── Load saved requirements ────────────────────────────────────────────────
  const loadRequirements = useCallback(async () => {
    if (!jobId || Number.isNaN(jobId)) return
    setIsLoadingReqs(true)
    setExtractionError('')
    try {
      const data = await getJobRequirements(jobId)
      if (data.success && data.extracted && data.requirements) {
        setRequirements(data.requirements)
        setIsExtracted(true)
      } else {
        setRequirements(null)
        setIsExtracted(false)
      }
    } catch (err) {
      // Silent fail; UI shows "not extracted" state instead
      setRequirements(null)
      setIsExtracted(false)
    } finally {
      setIsLoadingReqs(false)
    }
  }, [jobId])

  // ── Extract requirements (trigger) ────────────────────────────────────────
  const handleExtract = useCallback(async () => {
    if (!jobId || Number.isNaN(jobId)) return
    setIsExtracting(true)
    setExtractionError('')
    setExtractionSuccess('')
    try {
      const data = await extractJobRequirements(jobId)
      if (data.success && data.requirements) {
        setRequirements(data.requirements)
        setIsExtracted(true)
        setExtractionSuccess('Requirements extracted and saved successfully!')
        setTimeout(() => setExtractionSuccess(''), 6000)
      } else {
        setExtractionError(data.message || 'Failed to extract requirements.')
      }
    } catch (err) {
      setExtractionError(
        err.response?.data?.message ||
          'Failed to extract requirements from this job description. Please try again.'
      )
    } finally {
      setIsExtracting(false)
    }
  }, [jobId])

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadJob()
  }, [loadJob])

  useEffect(() => {
    if (job) {
      loadRequirements()
    }
  }, [job, loadRequirements])

  // ── Derived state ─────────────────────────────────────────────────────────
  const warnings = requirements?.extractionMetadata?.warnings || []

  // ──────────────────────────────────────────────────────────────────────────
  // Render: Loading
  // ──────────────────────────────────────────────────────────────────────────
  if (isLoadingJob) {
    return (
      <div className={styles.loadingScreen} role="status" aria-live="polite">
        <Spinner size="xl" />
        <p className={styles.loadingText}>Loading job description…</p>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render: Error (job not found / invalid ID)
  // ──────────────────────────────────────────────────────────────────────────
  if (jobError || !job) {
    return (
      <div className={styles.errorScreen}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>
            <AlertCircle size={32} aria-hidden="true" />
          </div>
          <h1 className={styles.errorTitle}>Job Description Not Found</h1>
          <p className={styles.errorMessage}>
            {jobError || 'The requested job description could not be found or you do not have permission to view it.'}
          </p>
          <div className={styles.errorActions}>
            <Button variant="primary" onClick={() => navigate('/jobs')} id="btn-back-to-jobs-error">
              <ArrowLeft size={16} />
              Back to Job Descriptions
            </Button>
            <Button variant="outline" onClick={loadJob} id="btn-retry-load">
              <RefreshCw size={16} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render: Page
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* ── Breadcrumb / Back Navigation ─────────────────────────────── */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/jobs" className={styles.breadcrumbLink} id="link-back-to-jobs">
          <ArrowLeft size={15} aria-hidden="true" />
          Saved Job Descriptions
        </Link>
        <span className={styles.breadcrumbSep} aria-hidden="true">/</span>
        <span className={styles.breadcrumbCurrent} aria-current="page">
          Job Analysis
        </span>
      </nav>

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderTop}>
          <div className={styles.jobMeta}>
            <div className={styles.jobIcon} aria-hidden="true">
              <Briefcase size={22} />
            </div>
            <div>
              <div className={styles.pageHeadingLabel}>Job Requirements</div>
              <h1 className={styles.pageTitle}>{job.title}</h1>
              {job.company && (
                <p className={styles.pageCompany}>
                  <Building2 size={14} aria-hidden="true" />
                  {job.company}
                </p>
              )}
            </div>
          </div>

          <div className={styles.pageHeaderActions}>
            <Button
              variant={isExtracted ? 'outline' : 'primary'}
              size="sm"
              onClick={handleExtract}
              disabled={isExtracting || isLoadingReqs}
              id="btn-extract-or-reextract"
            >
              {isExtracting ? (
                <>
                  <Spinner size="sm" />
                  Extracting…
                </>
              ) : isExtracted ? (
                <>
                  <RefreshCw size={14} />
                  Re-extract
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Extract Requirements
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Job meta row */}
        <div className={styles.jobMetaRow}>
          <span className={styles.metaPill}>
            <CalendarDays size={12} aria-hidden="true" />
            Added {formatDate(job.created_at)}
          </span>
          <span className={styles.metaPill}>
            <BarChart2 size={12} aria-hidden="true" />
            {job.source_type === 'UPLOADED_FILE' ? 'Uploaded Document' : 'Pasted Text'}
          </span>
          {isExtracted && (
            <span className={`${styles.metaPill} ${styles.metaPillSuccess}`}>
              <CheckCircle2 size={12} aria-hidden="true" />
              Requirements Extracted
            </span>
          )}
        </div>
      </header>

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      {extractionError && (
        <div className={`${styles.alertBanner} ${styles.alertBannerError}`} role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{extractionError}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExtract}
            disabled={isExtracting}
            id="btn-retry-extract"
          >
            Retry
          </Button>
        </div>
      )}

      {extractionSuccess && (
        <div className={`${styles.alertBanner} ${styles.alertBannerSuccess}`} role="status" aria-live="polite">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{extractionSuccess}</span>
        </div>
      )}

      {/* ── Extraction Loading / Processing states ────────────────────── */}
      {(isLoadingReqs || isExtracting) && !requirements && (
        <div className={styles.processingBanner} role="status" aria-live="polite">
          <Spinner size="lg" />
          <p className={styles.processingText}>
            {isExtracting
              ? 'Analyzing text and extracting skills, experience, education, tools, and certifications…'
              : 'Loading saved requirements…'}
          </p>
        </div>
      )}

      {/* ── Not Yet Extracted State ───────────────────────────────────── */}
      {!isLoadingReqs && !isExtracting && !isExtracted && (
        <div className={styles.notExtractedBanner} role="status">
          <div className={styles.notExtractedIcon} aria-hidden="true">
            <Sparkles size={28} />
          </div>
          <div className={styles.notExtractedContent}>
            <h2 className={styles.notExtractedTitle}>Requirements Not Yet Extracted</h2>
            <p className={styles.notExtractedDesc}>
              Extract structured requirements from this job description to view mandatory
              and preferred skills, experience ranges, education qualifications, tools,
              technologies, and certifications.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={handleExtract}
              disabled={isExtracting}
              id="btn-extract-requirements-banner"
            >
              <Sparkles size={16} />
              Extract Requirements Now
            </Button>
          </div>
        </div>
      )}

      {/* ── Extraction Warnings ───────────────────────────────────────── */}
      {isExtracted && warnings.length > 0 && (
        <div className={styles.warningsBanner} role="note">
          <div className={styles.warningsTitle}>
            <AlertTriangle size={15} aria-hidden="true" />
            Extraction Notes ({warnings.length})
          </div>
          <ul className={styles.warningsList}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Requirements Grid ─────────────────────────────────────────── */}
      {isExtracted && requirements && (
        <div className={styles.requirementsGrid}>

          {/* ── A: Required Skills ──────────────────────────────────── */}
          <SectionCard
            id="required-skills"
            icon={CheckCircle2}
            iconClass={styles.iconRequired}
            title="Required Skills"
            subtitle="Explicitly mandatory skills and competencies"
            badge={`${requirements.requiredSkills?.length || 0} mandatory`}
          >
            {requirements.requiredSkills && requirements.requiredSkills.length > 0 ? (
              <ul className={styles.skillsList} aria-label="Required skills">
                {requirements.requiredSkills.map((skill, idx) => (
                  <SkillItem key={`req-${skill.name}-${idx}`} skill={skill} isRequired={true} />
                ))}
              </ul>
            ) : (
              <EmptyCategory message="No explicitly mandatory skills identified in this job description." />
            )}
          </SectionCard>

          {/* ── B: Preferred Skills ─────────────────────────────────── */}
          <SectionCard
            id="preferred-skills"
            icon={Circle}
            iconClass={styles.iconPreferred}
            title="Preferred Skills"
            subtitle="Optional, nice-to-have, and bonus competencies"
            badge={`${requirements.preferredSkills?.length || 0} nice-to-have`}
          >
            {requirements.preferredSkills && requirements.preferredSkills.length > 0 ? (
              <ul className={styles.skillsList} aria-label="Preferred skills">
                {requirements.preferredSkills.map((skill, idx) => (
                  <SkillItem key={`pref-${skill.name}-${idx}`} skill={skill} isRequired={false} />
                ))}
              </ul>
            ) : (
              <EmptyCategory message="No optional or preferred skills mentioned in this job description." />
            )}
          </SectionCard>

          {/* ── C: Experience ───────────────────────────────────────── */}
          <SectionCard
            id="experience"
            icon={Briefcase}
            iconClass={styles.iconExperience}
            title="Experience"
            subtitle="Years of experience, seniority level, and domain background"
            badge={requirements.experience?.level || null}
          >
            <div className={styles.expGrid}>
              <div className={styles.expCard}>
                <span className={styles.expCardLabel}>Minimum Experience</span>
                <span className={styles.expCardValue}>
                  {requirements.experience?.minimumYears !== null &&
                  requirements.experience?.minimumYears !== undefined
                    ? `${requirements.experience.minimumYears} years`
                    : 'Not specified'}
                </span>
              </div>

              <div className={styles.expCard}>
                <span className={styles.expCardLabel}>Experience Range</span>
                <span className={styles.expCardValue}>
                  {formatExperienceRange(requirements.experience)}
                </span>
              </div>

              <div className={styles.expCard}>
                <span className={styles.expCardLabel}>Seniority Level</span>
                <span className={styles.expCardValue}>
                  {requirements.experience?.level || 'Not specified'}
                </span>
              </div>
            </div>

            {requirements.experience?.details && requirements.experience.details.length > 0 && (
              <div className={styles.expDetails}>
                <p className={styles.expDetailsTitle}>Domain &amp; Functional Experience</p>
                <ul className={styles.expDetailsList}>
                  {requirements.experience.details.map((detail, idx) => (
                    <li key={idx} className={styles.expDetailItem}>
                      <span className={styles.expDetailDot} aria-hidden="true" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {requirements.experience?.minimumYears === null &&
              requirements.experience?.maximumYears === null &&
              (!requirements.experience?.details || requirements.experience.details.length === 0) && (
                <EmptyCategory message="No specific years of experience or domain background specified in this job description." />
              )}
          </SectionCard>

          {/* ── D: Education ────────────────────────────────────────── */}
          <SectionCard
            id="education"
            icon={GraduationCap}
            iconClass={styles.iconEducation}
            title="Education"
            subtitle="Academic degrees, fields of study, and equivalent qualifications"
            badge={`${requirements.education?.length || 0} qualification${requirements.education?.length !== 1 ? 's' : ''}`}
          >
            {requirements.education && requirements.education.length > 0 ? (
              <div className={styles.structuredList}>
                {requirements.education.map((edu, idx) => (
                  <div key={idx} className={styles.structuredCard}>
                    <div className={styles.structuredCardTop}>
                      <span className={styles.structuredCardName}>{edu.degree}</span>
                      <span className={edu.required ? styles.badgeMandatory : styles.badgePreferred}>
                        {edu.required ? 'Mandatory' : 'Preferred'}
                      </span>
                    </div>

                    <div className={styles.structuredCardMeta}>
                      {edu.field && (
                        <span>
                          <strong>Field:</strong> {edu.field}
                        </span>
                      )}
                      {edu.equivalentAccepted && (
                        <span className={styles.equivalentTag}>
                          <CheckCircle2 size={13} aria-hidden="true" />
                          Equivalent practical experience accepted
                        </span>
                      )}
                    </div>

                    {edu.evidence && (
                      <blockquote className={styles.evidenceQuote}>
                        "{edu.evidence}"
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCategory message="No formal degree or educational requirements specified in this job description." />
            )}
          </SectionCard>

          {/* ── E: Tools ────────────────────────────────────────────── */}
          <SectionCard
            id="tools"
            icon={Wrench}
            iconClass={styles.iconTools}
            title="Tools &amp; Platforms"
            subtitle="Version control, CI/CD, IDEs, project management, and utilities"
            badge={`${requirements.tools?.length || 0} tool${requirements.tools?.length !== 1 ? 's' : ''}`}
          >
            {requirements.tools && requirements.tools.length > 0 ? (
              <ul className={styles.toolsList} aria-label="Tools and platforms">
                {requirements.tools.map((tool, idx) => (
                  <li
                    key={idx}
                    className={`${styles.toolItem} ${tool.required ? styles.toolItemRequired : styles.toolItemPreferred}`}
                    title={tool.evidence || tool.name}
                  >
                    <span className={styles.toolName}>{tool.name}</span>
                    <span className={`${styles.toolStatus} ${tool.required ? styles.toolStatusRequired : styles.toolStatusPreferred}`}>
                      {tool.required ? 'Required' : 'Preferred'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyCategory message="No specific developer tools or platforms identified in this job description." />
            )}
          </SectionCard>

          {/* ── F: Technologies ─────────────────────────────────────── */}
          <SectionCard
            id="technologies"
            icon={Code2}
            iconClass={styles.iconTechnologies}
            title="Technologies"
            subtitle="Programming languages, frameworks, databases, and cloud infrastructure"
            badge={`${requirements.technologies?.length || 0} technolog${requirements.technologies?.length !== 1 ? 'ies' : 'y'}`}
          >
            {requirements.technologies && requirements.technologies.length > 0 ? (
              <ul className={styles.techList} aria-label="Technologies">
                {requirements.technologies.map((tech, idx) => (
                  <li
                    key={idx}
                    className={`${styles.techItem} ${tech.required ? styles.techItemRequired : styles.techItemPreferred}`}
                    title={tech.evidence || tech.name}
                  >
                    <span className={styles.techName}>{tech.name}</span>
                    <div className={styles.techMeta}>
                      <span className={styles.techCategory}>{tech.category}</span>
                      <span className={`${styles.techStatus} ${tech.required ? styles.techStatusRequired : styles.techStatusPreferred}`}>
                        {tech.required ? 'Required' : 'Preferred'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyCategory message="No programming languages, frameworks, or databases identified in this job description." />
            )}
          </SectionCard>

          {/* ── G: Certifications ───────────────────────────────────── */}
          <SectionCard
            id="certifications"
            icon={Award}
            iconClass={styles.iconCerts}
            title="Certifications"
            subtitle="Professional licenses, credentials, and cloud certificates"
            badge={String(requirements.certifications?.length || 0)}
          >
            {requirements.certifications && requirements.certifications.length > 0 ? (
              <div className={styles.structuredList}>
                {requirements.certifications.map((cert, idx) => (
                  <div key={idx} className={styles.structuredCard}>
                    <div className={styles.structuredCardTop}>
                      <div className={styles.certNameRow}>
                        <ShieldCheck size={16} className={styles.certIcon} aria-hidden="true" />
                        <span className={styles.structuredCardName}>{cert.name}</span>
                      </div>
                      <span className={cert.required ? styles.badgeMandatory : styles.badgePreferred}>
                        {cert.required ? 'Mandatory' : 'Preferred'}
                      </span>
                    </div>

                    {cert.issuer && (
                      <div className={styles.structuredCardMeta}>
                        <span>
                          <strong>Issuer:</strong> {cert.issuer}
                        </span>
                      </div>
                    )}

                    {cert.evidence && (
                      <blockquote className={styles.evidenceQuote}>
                        "{cert.evidence}"
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCategory message="No certifications specified in this job description." />
            )}
          </SectionCard>

        </div>
      )}

      {/* ── Page Footer ───────────────────────────────────────────────── */}
      <footer className={styles.pageFooter}>
        <Button variant="outline" size="sm" onClick={() => navigate('/jobs')} id="btn-back-to-jobs-footer">
          <ArrowLeft size={14} />
          Back to Job Descriptions
        </Button>

        {isExtracted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExtract}
            disabled={isExtracting}
            id="btn-reextract-footer"
          >
            <RefreshCw size={14} />
            Re-extract Requirements
          </Button>
        )}
      </footer>
    </div>
  )
}
