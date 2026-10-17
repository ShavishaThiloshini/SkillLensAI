import { useState, useEffect, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  FileCheck,
  Info,
  Clock,
  Sparkles,
  X,
  Play,
  Mail,
  Phone,
  MapPin,
  Link,
  ExternalLink,
  Globe,
  Award,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Code2,
  AlertTriangle,
  User,
  AlignLeft,
} from 'lucide-react'
import Button from '../components/common/Button'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import Modal from '../components/common/Modal'
import Spinner from '../components/common/Spinner'
import { uploadResume, getResumes, getResumeById, extractResume, parseResume } from '../services/resumeService'
import styles from './Resume.module.css'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx']

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ResumePage() {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [validationError, setValidationError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(null)
  const [uploadError, setUploadError] = useState('')

  // Resumes list state
  const [resumes, setResumes] = useState([])
  const [isLoadingResumes, setIsLoadingResumes] = useState(true)
  const [resumesError, setResumesError] = useState('')

  // Details Modal state
  const [activeResume, setActiveResume] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('candidate') // 'candidate', 'skills', 'experience', 'education', 'projects', 'certifications', 'raw'
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState('')
  const [extractionSuccess, setExtractionSuccess] = useState('')

  const fileInputRef = useRef(null)

  // Fetch authenticated user's resumes on load
  const loadResumes = async () => {
    setIsLoadingResumes(true)
    setResumesError('')
    try {
      const data = await getResumes()
      if (data?.success) {
        setResumes(data.resumes || [])
      }
    } catch (err) {
      setResumesError(
        err.message || 'Unable to retrieve resumes. Please check your connection.'
      )
    } finally {
      setIsLoadingResumes(false)
    }
  }

  useEffect(() => {
    loadResumes()
  }, [])

  // Client-side file validation
  const validateSelectedFile = (file) => {
    if (!file) return false

    const fileName = file.name || ''
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setValidationError(
        'Invalid file type. Only PDF (.pdf) and Word (.docx) files are supported.'
      )
      return false
    }

    if (file.size === 0) {
      setValidationError('The selected file is empty (0 bytes). Please choose a valid document.')
      return false
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(
        `File exceeds the 5 MB limit. Selected file size: ${formatBytes(file.size)}.`
      )
      return false
    }

    setValidationError('')
    return true
  }

  const handleFileSelect = (file) => {
    setUploadSuccess(null)
    setUploadError('')
    if (validateSelectedFile(file)) {
      setSelectedFile(file)
    } else {
      setSelectedFile(null)
    }
  }

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleUploadSubmit = async () => {
    if (!selectedFile || !validateSelectedFile(selectedFile)) return

    setIsUploading(true)
    setUploadProgress(0)
    setUploadError('')
    setUploadSuccess(null)

    try {
      const result = await uploadResume(selectedFile, (percent) => {
        setUploadProgress(percent)
      })

      if (result?.success) {
        setUploadSuccess({
          message:
            result.message ||
            'Resume uploaded successfully! Document is verified and ready for extraction.',
          resume: result.resume,
        })
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        await loadResumes()
      } else {
        setUploadError(result?.message || 'Upload failed. Please try again.')
      }
    } catch (err) {
      setUploadError(
        err.message ||
          'Upload failed due to a server or network issue. Please check your connection and retry.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancelSelection = () => {
    setSelectedFile(null)
    setValidationError('')
    setUploadError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleOpenDetails = async (resume) => {
    setActiveResume(resume)
    setIsModalOpen(true)
    setActiveTab('candidate')
    setExtractionError('')
    setExtractionSuccess('')

    // Fetch full extracted details
    try {
      const full = await getResumeById(resume.id)
      if (full?.success && full.resume) {
        setActiveResume(full.resume)
      }
    } catch (err) {
      console.warn('Could not load rich details:', err.message)
    }
  }

  const handleTriggerExtract = async (resumeId) => {
    setIsExtracting(true)
    setExtractionError('')
    setExtractionSuccess('')

    try {
      const result = await extractResume(resumeId)
      if (result?.success) {
        setExtractionSuccess(result.message || 'Text extracted and structured information parsed!')
        // Reload details and list
        const updated = await getResumeById(resumeId)
        if (updated?.success && updated.resume) {
          setActiveResume(updated.resume)
        }
        await loadResumes()
      } else {
        setExtractionError(result?.message || 'Text extraction failed.')
      }
    } catch (err) {
      setExtractionError(err.message || 'Failed to extract resume text.')
    } finally {
      setIsExtracting(false)
    }
  }

  const getFileExtensionBadge = (filename) => {
    const isDocx = filename?.toLowerCase().endsWith('.docx')
    return (
      <div
        className={`${styles.fileIconBadge} ${
          isDocx ? styles.badgeDocx : styles.badgePdf
        }`}
      >
        {isDocx ? 'DOCX' : 'PDF'}
      </div>
    )
  }

  const getStatusBadge = (status) => {
    const s = (status || 'UPLOADED').toUpperCase()
    let cls = styles.statusUploaded
    if (s === 'PROCESSING') cls = styles.statusProcessing
    else if (s === 'COMPLETED') cls = styles.statusCompleted
    else if (s === 'FAILED') cls = styles.statusFailed

    return (
      <span className={`${styles.statusPill} ${cls}`}>
        <span className={styles.statusDot} />
        {s}
      </span>
    )
  }

  const structuredModel = activeResume?.structuredModel || activeResume?.structuredData?.structuredModel || null
  const candidate = structuredModel?.personalInformation || {
    fullName: activeResume?.structuredData?.candidate?.full_name || null,
    email: activeResume?.structuredData?.candidate?.email || null,
    phone: activeResume?.structuredData?.candidate?.phone || null,
    location: activeResume?.structuredData?.candidate?.location || null,
    linkedinUrl: activeResume?.structuredData?.candidate?.linkedin_url || null,
    githubUrl: activeResume?.structuredData?.candidate?.github_url || null,
    portfolioUrl: activeResume?.structuredData?.candidate?.portfolio_url || null,
  }
  const summary = structuredModel?.summary || activeResume?.structuredData?.summary || null
  const skills = structuredModel?.skills || activeResume?.skills || activeResume?.structuredData?.skills || []
  const education = structuredModel?.education || activeResume?.structuredData?.education || []
  const experience = structuredModel?.experience || activeResume?.structuredData?.experience || []
  const projects = structuredModel?.projects || activeResume?.structuredData?.projects || []
  const certifications = structuredModel?.certifications || activeResume?.structuredData?.certifications || []
  const sections = activeResume?.sections || activeResume?.structuredData?.sections || []
  const parsingWarnings = structuredModel?.parsingMetadata?.warnings || []

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Resume Management</h1>
          <span className={styles.stageBadge}>
            <Sparkles size={14} /> Day 12: Structured Resume Parser
          </span>
        </div>
        <p className={styles.description}>
          Upload your resume in PDF or Word (DOCX) format. SkillLens AI validates
          the internal structure, securely extracts text, and organizes information into a
          canonical structured data model (Personal Information, Summary, Skills, Education,
          Experience, Projects, and Certifications) stored in Aiven MySQL.
        </p>
      </div>

      {/* Upload Card */}
      <Card variant="default" padding="lg">
        <CardHeader>
          <h2 className={styles.cardTitle}>
            <UploadCloud size={22} color="var(--color-indigo)" />
            Upload New Resume
          </h2>
        </CardHeader>
        <CardBody>
          {/* Drag & Drop Area */}
          <div
            className={[
              styles.dropzone,
              dragActive ? styles.dropzoneActive : '',
              isUploading ? styles.dropzoneDisabled : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className={styles.fileInputHidden}
              onChange={handleInputChange}
              disabled={isUploading}
            />

            <div className={styles.iconWrapper}>
              <UploadCloud size={28} />
            </div>

            <div className={styles.dropzoneText}>
              <p className={styles.primaryText}>
                Drag &amp; drop your resume here, or{' '}
                <span className={styles.highlightText}>browse files</span>
              </p>
              <p className={styles.subText}>
                Accepted formats: <strong>.pdf</strong>, <strong>.docx</strong> (Maximum size: 5 MB)
              </p>
            </div>
          </div>

          {/* Validation Error Banner */}
          {validationError && (
            <div className={`${styles.alert} ${styles.alertError}`} role="alert">
              <AlertCircle size={18} />
              <div className={styles.alertContent}>
                <div className={styles.alertTitle}>Validation Error</div>
                <div className={styles.alertMessage}>{validationError}</div>
              </div>
            </div>
          )}

          {/* Selected File Card Preview */}
          {selectedFile && !validationError && (
            <div className={styles.filePreview}>
              <div className={styles.fileDetails}>
                {getFileExtensionBadge(selectedFile.name)}
                <div className={styles.fileNameMeta}>
                  <p className={styles.fileName} title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className={styles.fileMeta}>
                    {formatBytes(selectedFile.size)} &bull; Ready to upload
                  </p>
                </div>
              </div>

              <div className={styles.fileActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelSelection}
                  disabled={isUploading}
                  icon={X}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUploadSubmit}
                  loading={isUploading}
                  icon={FileCheck}
                >
                  {isUploading ? 'Uploading...' : 'Confirm & Upload'}
                </Button>
              </div>
            </div>
          )}

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className={styles.progressLabel}>
                <span>Uploading and verifying document format...</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {uploadSuccess && (
            <div className={`${styles.alert} ${styles.alertSuccess}`} role="alert">
              <CheckCircle2 size={18} />
              <div className={styles.alertContent}>
                <div className={styles.alertTitle}>Upload Confirmed</div>
                <div className={styles.alertMessage}>{uploadSuccess.message}</div>
                {uploadSuccess.resume && (
                  <div className={styles.alertActions}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetails(uploadSuccess.resume)}
                      icon={Eye}
                    >
                      View Details &amp; Extract
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Error Banner with Retry */}
          {uploadError && (
            <div className={`${styles.alert} ${styles.alertError}`} role="alert">
              <AlertCircle size={18} />
              <div className={styles.alertContent}>
                <div className={styles.alertTitle}>Upload Failed</div>
                <div className={styles.alertMessage}>{uploadError}</div>
                {selectedFile && (
                  <div className={styles.alertActions}>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleUploadSubmit}
                      icon={RefreshCw}
                    >
                      Retry Upload
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Resumes List Card */}
      <Card variant="default" padding="lg">
        <div className={styles.tableHeaderArea}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h2 className={styles.tableTitle}>Uploaded Resumes</h2>
            <span className={styles.countBadge}>{resumes.length}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadResumes}
            loading={isLoadingResumes}
            icon={RefreshCw}
          >
            Refresh
          </Button>
        </div>

        {resumesError && (
          <div className={`${styles.alert} ${styles.alertError}`} role="alert">
            <AlertCircle size={18} />
            <div className={styles.alertContent}>
              <div className={styles.alertTitle}>Error Loading Resumes</div>
              <div className={styles.alertMessage}>{resumesError}</div>
              <div className={styles.alertActions}>
                <Button variant="outline" size="sm" onClick={loadResumes}>
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoadingResumes && resumes.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <Spinner size="lg" color="primary" />
            <p style={{ marginTop: 'var(--space-3)', color: 'var(--color-text-secondary)' }}>
              Loading your uploaded documents...
            </p>
          </div>
        ) : resumes.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>No resumes uploaded yet</h3>
            <p className={styles.emptyText}>
              Select or drop your PDF or DOCX resume into the upload box above. Your
              stored resume will appear here once saved.
            </p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Uploaded Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resumes.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <FileText size={18} color="var(--color-indigo)" />
                        <span style={{ fontWeight: 'var(--font-medium)' }}>
                          {item.original_filename}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.fileIconBadge} ${
                          item.file_type === 'DOCX' ? styles.badgeDocx : styles.badgePdf
                        }`}
                        style={{ width: 'auto', padding: '0.15rem 0.5rem', height: '24px' }}
                      >
                        {item.file_type}
                      </span>
                    </td>
                    <td>{formatBytes(item.file_size)}</td>
                    <td>{getStatusBadge(item.processing_status)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
                        <Clock size={12} />
                        {formatDate(item.created_at)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                        {item.processing_status !== 'COMPLETED' ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              handleOpenDetails(item)
                              handleTriggerExtract(item.id)
                            }}
                            icon={Play}
                          >
                            Extract
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDetails(item)}
                          icon={Eye}
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Structured Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={activeResume?.original_filename || 'Resume Information'}
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              {activeResume && activeResume.processing_status !== 'COMPLETED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleTriggerExtract(activeResume.id)}
                  loading={isExtracting}
                  icon={Play}
                >
                  {isExtracting ? 'Extracting...' : 'Extract Resume Information'}
                </Button>
              )}
            </div>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {activeResume && (
          <div>
            {/* Header info & Status Banner */}
            <div className={styles.candidateHeader}>
              <div>
                <h3 className={styles.candidateName}>
                  {candidate.fullName || 'Candidate Name Not Detected'}
                </h3>
                <div className={styles.candidateContactGrid}>
                  <div className={styles.contactItem}>
                    <Mail size={14} />
                    <span>{candidate.email || <span className={styles.notDetected}>Email not detected</span>}</span>
                  </div>
                  <div className={styles.contactItem}>
                    <Phone size={14} />
                    <span>{candidate.phone || <span className={styles.notDetected}>Phone not detected</span>}</span>
                  </div>
                  <div className={styles.contactItem}>
                    <MapPin size={14} />
                    <span>{candidate.location || <span className={styles.notDetected}>Location not detected</span>}</span>
                  </div>
                  {candidate.linkedinUrl && (
                    <div className={styles.contactItem}>
                      <Link size={14} />
                      <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-indigo)' }}>
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  {candidate.githubUrl && (
                    <div className={styles.contactItem}>
                      <ExternalLink size={14} />
                      <a href={candidate.githubUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-indigo)' }}>
                        GitHub Profile
                      </a>
                    </div>
                  )}
                  {candidate.portfolioUrl && (
                    <div className={styles.contactItem}>
                      <Globe size={14} />
                      <a href={candidate.portfolioUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-indigo)' }}>
                        Portfolio
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <div>{getStatusBadge(activeResume.processing_status)}</div>
            </div>

            {/* Parsing Warnings Banner */}
            {parsingWarnings.length > 0 && (
              <div className={`${styles.alert} ${styles.alertWarning}`} role="alert" style={{ marginBottom: 'var(--space-4)' }}>
                <AlertTriangle size={18} />
                <div className={styles.alertContent}>
                  <div className={styles.alertTitle}>Parser Warnings ({parsingWarnings.length})</div>
                  <ul style={{ margin: 'var(--space-1) 0 0 0', paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                    {parsingWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Extraction Notifications */}
            {extractionSuccess && (
              <div className={`${styles.alert} ${styles.alertSuccess}`} role="alert" style={{ marginBottom: 'var(--space-4)' }}>
                <CheckCircle2 size={18} />
                <div className={styles.alertContent}>
                  <div className={styles.alertTitle}>Extraction Complete</div>
                  <div className={styles.alertMessage}>{extractionSuccess}</div>
                </div>
              </div>
            )}

            {extractionError && (
              <div className={`${styles.alert} ${styles.alertError}`} role="alert" style={{ marginBottom: 'var(--space-4)' }}>
                <AlertCircle size={18} />
                <div className={styles.alertContent}>
                  <div className={styles.alertTitle}>Extraction Error</div>
                  <div className={styles.alertMessage}>{extractionError}</div>
                  <div className={styles.alertActions}>
                    <Button variant="danger" size="sm" onClick={() => handleTriggerExtract(activeResume.id)}>
                      Retry Extraction
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className={styles.modalTabs}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'candidate' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('candidate')}
              >
                Overview
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'summary' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                Summary
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'skills' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('skills')}
              >
                Skills ({skills.length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'experience' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('experience')}
              >
                Experience ({experience.length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'education' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('education')}
              >
                Education ({education.length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'projects' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('projects')}
              >
                Projects ({projects.length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'certifications' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('certifications')}
              >
                Certifications ({certifications.length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'sections' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('sections')}
              >
                Raw Sections ({sections.length})
              </button>
            </div>

            {/* Tab: Overview & Metadata */}
            {activeTab === 'candidate' && (
              <div>
                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Resume ID</span>
                    <span className={styles.metaValue}>#{activeResume.id}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Document Format</span>
                    <span className={styles.metaValue}>{activeResume.file_type}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Original Filename</span>
                    <span className={styles.metaValue}>{activeResume.original_filename}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>File Size</span>
                    <span className={styles.metaValue}>
                      {formatBytes(activeResume.file_size)}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Processing Status</span>
                    <span className={styles.metaValue}>
                      {getStatusBadge(activeResume.processing_status)}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Uploaded At</span>
                    <span className={styles.metaValue}>{formatDate(activeResume.created_at)}</span>
                  </div>
                </div>

                {activeResume.processing_status !== 'COMPLETED' ? (
                  <div className={styles.metaNoteBox}>
                    <strong>Ready for Extraction &amp; Structured Parsing (Day 12)</strong>
                    <p style={{ margin: 'var(--space-1) 0 0 0' }}>
                      Click <strong>Extract Resume Information</strong> below to extract all sections,
                      skills, and work history from this {activeResume.file_type} document without sending data to third parties.
                    </p>
                  </div>
                ) : (
                  <div className={styles.metaNoteBox} style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
                    <strong>Structured Parsing Completed</strong>
                    <p style={{ margin: 'var(--space-1) 0 0 0' }}>
                      Document parsed and normalized into structured data model! Personal info, summary, skills, education, experience, projects, and certifications are stored in Aiven MySQL.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Summary */}
            {activeTab === 'summary' && (
              <div>
                {!summary ? (
                  <p className={styles.notDetected}>No professional summary or career objective detected in this resume.</p>
                ) : (
                  <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                      <h4 className={styles.sectionTitle}>
                        <AlignLeft size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        Professional Summary
                      </h4>
                    </div>
                    <p className={styles.sectionContent} style={{ fontSize: 'var(--text-sm)', lineHeight: '1.6' }}>
                      {summary}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Skills */}
            {activeTab === 'skills' && (
              <div>
                {skills.length === 0 ? (
                  <p className={styles.notDetected}>No skills detected in this resume yet.</p>
                ) : (
                  <div className={styles.skillsList}>
                    {skills.map((s, idx) => (
                      <span key={idx} className={styles.skillPill} title={s.evidence || s.category}>
                        <Code2 size={13} />
                        {s.name}
                        <small style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                          ({s.category})
                        </small>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Experience */}
            {activeTab === 'experience' && (
              <div>
                {experience.length === 0 ? (
                  <p className={styles.notDetected}>No work experience entries detected.</p>
                ) : (
                  experience.map((exp, idx) => {
                    const title = exp.jobTitle || exp.title
                    const company = exp.company || 'Not detected'
                    const dates = exp.startDate && exp.endDate ? `${exp.startDate} - ${exp.endDate}` : (exp.dates || exp.startDate || 'Dates not detected')
                    const resp = Array.isArray(exp.responsibilities) ? exp.responsibilities.join(' ') : exp.responsibilities
                    const techs = Array.isArray(exp.technologies) ? exp.technologies : []

                    return (
                      <div key={idx} className={styles.sectionCard}>
                        <div className={styles.sectionHeader}>
                          <h4 className={styles.sectionTitle}>
                            <Briefcase size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                            {title}
                          </h4>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            {dates} {exp.isCurrent && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}> (Current)</span>}
                          </span>
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--color-indigo)' }}>
                          {company} {exp.location && <span> &bull; {exp.location}</span>}
                        </p>
                        {resp && (
                          <p className={styles.sectionContent}>{resp}</p>
                        )}
                        {techs.length > 0 && (
                          <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                            {techs.map((t, ti) => (
                              <span key={ti} className={styles.skillPill} style={{ fontSize: '11px', padding: '0.15rem 0.45rem' }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Tab: Education */}
            {activeTab === 'education' && (
              <div>
                {education.length === 0 ? (
                  <p className={styles.notDetected}>No education records detected.</p>
                ) : (
                  education.map((edu, idx) => {
                    const qual = edu.qualification || 'Degree / Qualification'
                    const inst = edu.institution || 'Not detected'
                    const dates = edu.startDate && edu.endDate ? `${edu.startDate} - ${edu.endDate}` : (edu.dates || edu.startDate || '')
                    const field = edu.fieldOfStudy || edu.field_of_study
                    const grade = edu.grade
                    const details = edu.description || edu.details

                    return (
                      <div key={idx} className={styles.sectionCard}>
                        <div className={styles.sectionHeader}>
                          <h4 className={styles.sectionTitle}>
                            <GraduationCap size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                            {qual}
                          </h4>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            {dates}
                          </span>
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-1) 0', color: 'var(--color-indigo)' }}>
                          {inst}
                        </p>
                        {field && (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-1) 0' }}>
                            Field of Study: {field}
                          </p>
                        )}
                        {grade && (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-1) 0' }}>
                            Grade / Result: {grade}
                          </p>
                        )}
                        {details && <p className={styles.sectionContent}>{details}</p>}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Tab: Projects */}
            {activeTab === 'projects' && (
              <div>
                {projects.length === 0 ? (
                  <p className={styles.notDetected}>No projects detected.</p>
                ) : (
                  projects.map((proj, idx) => {
                    const link = proj.projectUrl || proj.githubUrl || proj.demoUrl || proj.url
                    const techs = Array.isArray(proj.technologies) ? proj.technologies.join(', ') : proj.technologies

                    return (
                      <div key={idx} className={styles.sectionCard}>
                        <div className={styles.sectionHeader}>
                          <h4 className={styles.sectionTitle}>
                            <FolderGit2 size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                            {proj.name}
                          </h4>
                          {link && (
                            <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-indigo)' }}>
                              Project Link
                            </a>
                          )}
                        </div>
                        {techs && (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-indigo)', margin: '0 0 var(--space-1) 0' }}>
                            Tech: {techs}
                          </p>
                        )}
                        {proj.description && <p className={styles.sectionContent}>{proj.description}</p>}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Tab: Certifications */}
            {activeTab === 'certifications' && (
              <div>
                {certifications.length === 0 ? (
                  <p className={styles.notDetected}>No certifications detected.</p>
                ) : (
                  certifications.map((c, idx) => {
                    const org = c.issuingOrganization || c.issuer || 'Not detected'
                    const date = c.issueDate || c.date

                    return (
                      <div key={idx} className={styles.sectionCard}>
                        <div className={styles.sectionHeader}>
                          <h4 className={styles.sectionTitle}>
                            <Award size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                            {c.name}
                          </h4>
                          {date && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                              {date}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-indigo)', margin: 0 }}>
                          Issued by: {org}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Tab: Sections */}
            {activeTab === 'sections' && (
              <div>
                {sections.length === 0 ? (
                  <p className={styles.notDetected}>No structured sections detected yet.</p>
                ) : (
                  sections.map((sec, idx) => (
                    <div key={idx} className={styles.sectionCard}>
                      <div className={styles.sectionHeader}>
                        <h4 className={styles.sectionTitle}>{sec.section_type}</h4>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          Order #{sec.display_order}
                        </span>
                      </div>
                      <p className={styles.sectionContent}>{sec.section_content}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
