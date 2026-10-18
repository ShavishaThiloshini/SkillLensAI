import { useState, useEffect, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  FileCheck,
  Clock,
  Sparkles,
  X,
  Play,
  Mail,
  Phone,
  MapPin,
  Link as LinkIcon,
  ExternalLink,
  Globe,
  Award,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Code2,
  AlertTriangle,
  AlignLeft,
  Trash2,
  ArrowUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  History,
  FileEdit,
} from 'lucide-react'
import Button from '../components/common/Button'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import Modal from '../components/common/Modal'
import Spinner from '../components/common/Spinner'
import {
  uploadResume,
  getResumes,
  getResumeById,
  extractResume,
  deleteResume,
  replaceResume,
} from '../services/resumeService'
import styles from './Resume.module.css'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx']
const ITEMS_PER_PAGE = 6

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

export default function ResumeDashboard() {
  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false)
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
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  // Details Modal state
  const [activeResume, setActiveResume] = useState(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('candidate') // candidate, summary, skills, experience, education, projects, certifications, sections
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState('')
  const [extractionSuccess, setExtractionSuccess] = useState('')

  // Delete Modal state
  const [resumeToDelete, setResumeToDelete] = useState(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [actionNotice, setActionNotice] = useState(null) // { type: 'success' | 'error', message: string }

  // Replace Modal state
  const [resumeToReplace, setResumeToReplace] = useState(null)
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false)
  const [replacementFile, setReplacementFile] = useState(null)
  const [replaceValidationError, setReplaceValidationError] = useState('')
  const [isReplacing, setIsReplacing] = useState(false)
  const [replaceProgress, setReplaceProgress] = useState(0)
  const [replaceError, setReplaceError] = useState('')

  const fileInputRef = useRef(null)
  const replaceFileInputRef = useRef(null)

  // Load authenticated user's resumes
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
        err.message || 'Unable to retrieve resumes from server. Please check your connection and retry.'
      )
    } finally {
      setIsLoadingResumes(false)
    }
  }

  useEffect(() => {
    loadResumes()
  }, [])

  // File validator
  const validateFile = (file) => {
    if (!file) return { isValid: false, message: 'No file selected.' }

    const fileName = file.name || ''
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        isValid: false,
        message: 'Invalid file type. Only PDF (.pdf) and Word (.docx) files are supported.',
      }
    }

    if (file.size === 0) {
      return {
        isValid: false,
        message: 'The selected file is empty (0 bytes). Please choose a valid document.',
      }
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        message: `File exceeds the 5 MB limit. Selected file size: ${formatBytes(file.size)}.`,
      }
    }

    return { isValid: true }
  }

  // Handle upload selection
  const handleFileSelect = (file) => {
    setUploadSuccess(null)
    setUploadError('')
    const validation = validateFile(file)
    if (validation.isValid) {
      setSelectedFile(file)
      setValidationError('')
    } else {
      setSelectedFile(null)
      setValidationError(validation.message)
    }
  }

  const handleUploadSubmit = async () => {
    if (!selectedFile) return
    const validation = validateFile(selectedFile)
    if (!validation.isValid) {
      setValidationError(validation.message)
      return
    }

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
          message: result.message || 'Resume uploaded successfully! Document verified and ready for extraction.',
          resume: result.resume,
        })
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        await loadResumes()
      } else {
        setUploadError(result?.message || 'Upload failed. Please try again.')
      }
    } catch (err) {
      setUploadError(
        err.message || 'Upload failed due to a server or network issue. Please check your connection.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  // Handle Details View
  const handleOpenDetails = async (resume) => {
    setActiveResume(resume)
    setIsDetailsModalOpen(true)
    setActiveTab('candidate')
    setExtractionError('')
    setExtractionSuccess('')

    try {
      const full = await getResumeById(resume.id)
      if (full?.success && full.resume) {
        setActiveResume(full.resume)
      }
    } catch (err) {
      console.warn('Could not load rich details:', err.message)
    }
  }

  // Handle Extraction Trigger
  const handleTriggerExtract = async (resumeId) => {
    setIsExtracting(true)
    setExtractionError('')
    setExtractionSuccess('')

    try {
      const result = await extractResume(resumeId)
      if (result?.success) {
        setExtractionSuccess(result.message || 'Text extracted and structured information parsed successfully!')
        const updated = await getResumeById(resumeId)
        if (updated?.success && updated.resume) {
          setActiveResume(updated.resume)
        }
        await loadResumes()
      } else {
        setExtractionError(result?.message || 'Extraction failed.')
      }
    } catch (err) {
      setExtractionError(err.message || 'Failed to extract resume text.')
    } finally {
      setIsExtracting(false)
    }
  }

  // Handle Delete Confirmation
  const handleOpenDeleteConfirm = (resume) => {
    setResumeToDelete(resume)
    setDeleteError('')
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!resumeToDelete) return
    setIsDeleting(true)
    setDeleteError('')

    try {
      const result = await deleteResume(resumeToDelete.id)
      if (result?.success) {
        setIsDeleteModalOpen(false)
        if (activeResume?.id === resumeToDelete.id) {
          setIsDetailsModalOpen(false)
          setActiveResume(null)
        }
        setResumeToDelete(null)
        setActionNotice({
          type: 'success',
          message: `Resume "${resumeToDelete.original_filename}" and associated data were deleted successfully.`,
        })
        await loadResumes()
      } else {
        setDeleteError(result?.message || 'Failed to delete resume.')
      }
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete resume. Please check your connection.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle Replace Confirmation & Execution
  const handleOpenReplace = (resume) => {
    setResumeToReplace(resume)
    setReplacementFile(null)
    setReplaceValidationError('')
    setReplaceError('')
    setReplaceProgress(0)
    setIsReplaceModalOpen(true)
  }

  const handleReplacementFileSelect = (file) => {
    setReplaceError('')
    const val = validateFile(file)
    if (val.isValid) {
      setReplacementFile(file)
      setReplaceValidationError('')
    } else {
      setReplacementFile(null)
      setReplaceValidationError(val.message)
    }
  }

  const handleConfirmReplace = async () => {
    if (!resumeToReplace || !replacementFile) return
    const val = validateFile(replacementFile)
    if (!val.isValid) {
      setReplaceValidationError(val.message)
      return
    }

    setIsReplacing(true)
    setReplaceError('')
    setReplaceProgress(0)

    try {
      const result = await replaceResume(resumeToReplace.id, replacementFile, (pct) => {
        setReplaceProgress(pct)
      })

      if (result?.success) {
        setIsReplaceModalOpen(false)
        const oldName = resumeToReplace.original_filename
        setResumeToReplace(null)
        setReplacementFile(null)
        setActionNotice({
          type: 'success',
          message: `Resume "${oldName}" was successfully replaced with "${result.resume.original_filename}". Previous extracted data has been reset and is ready for fresh processing.`,
        })
        await loadResumes()
        if (activeResume?.id === result.resume.id) {
          await handleOpenDetails(result.resume)
        }
      } else {
        setReplaceError(result?.message || 'Replacement failed.')
      }
    } catch (err) {
      setReplaceError(err.message || 'Failed to replace resume. Please check your connection and retry.')
    } finally {
      setIsReplacing(false)
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

  // Filtered & Paginated resumes
  const filteredResumes = resumes.filter((r) => {
    const matchesSearch =
      !searchQuery.trim() ||
      r.original_filename?.toLowerCase().includes(searchQuery.toLowerCase().trim())
    const matchesStatus =
      statusFilter === 'ALL' ||
      (r.processing_status || 'UPLOADED').toUpperCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredResumes.length / ITEMS_PER_PAGE) || 1
  const paginatedResumes = filteredResumes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Structured details extraction helpers
  const structuredModel =
    activeResume?.structuredModel || activeResume?.structuredData?.structuredModel || null
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
  const skills =
    structuredModel?.skills || activeResume?.skills || activeResume?.structuredData?.skills || []
  const education =
    structuredModel?.education || activeResume?.structuredData?.education || []
  const experience =
    structuredModel?.experience || activeResume?.structuredData?.experience || []
  const projects =
    structuredModel?.projects || activeResume?.structuredData?.projects || []
  const certifications =
    structuredModel?.certifications || activeResume?.structuredData?.certifications || []
  const sections = activeResume?.sections || activeResume?.structuredData?.sections || []
  const parsingWarnings = structuredModel?.parsingMetadata?.warnings || []

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>My Resumes</h1>
            <p className={styles.description}>
              Manage, inspect, and organize your uploaded resumes. SkillLens AI parses your
              resumes into structured candidate details, skills, experience, and education for intelligent gap analysis.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="primary"
              onClick={() => {
                setShowUploadModal(true)
                setUploadSuccess(null)
                setUploadError('')
                setSelectedFile(null)
              }}
              icon={UploadCloud}
            >
              Upload Resume
            </Button>
          </div>
        </div>
      </div>

      {/* Global Action Notice Banner */}
      {actionNotice && (
        <div
          className={`${styles.alert} ${
            actionNotice.type === 'success' ? styles.alertSuccess : styles.alertError
          }`}
          role="alert"
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <div className={styles.alertContent}>
            <div className={styles.alertMessage}>{actionNotice.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '2px',
            }}
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Upload Resume Modal ── */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => !isUploading && setShowUploadModal(false)}
        title="Upload New Resume"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', width: '100%' }}>
            <Button
              variant="secondary"
              onClick={() => setShowUploadModal(false)}
              disabled={isUploading}
            >
              Close
            </Button>
            {selectedFile && (
              <Button
                variant="primary"
                onClick={handleUploadSubmit}
                loading={isUploading}
                icon={FileCheck}
              >
                {isUploading ? 'Uploading...' : 'Confirm Upload'}
              </Button>
            )}
          </div>
        }
      >
        <div>
          <div
            className={[
              styles.dropzone,
              dragActive ? styles.dropzoneActive : '',
              isUploading ? styles.dropzoneDisabled : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragEnter={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setDragActive(false)
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFileSelect(file)
            }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className={styles.fileInputHidden}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
              disabled={isUploading}
            />
            <div className={styles.iconWrapper}>
              <UploadCloud size={28} />
            </div>
            <div className={styles.dropzoneText}>
              <p className={styles.primaryText}>
                Drag &amp; drop resume here, or <span className={styles.highlightText}>browse files</span>
              </p>
              <p className={styles.subText}>Accepted formats: <strong>.pdf</strong>, <strong>.docx</strong> (Max: 5 MB)</p>
            </div>
          </div>

          {validationError && (
            <div className={`${styles.alert} ${styles.alertError}`} role="alert">
              <AlertCircle size={18} />
              <div className={styles.alertContent}>
                <div className={styles.alertTitle}>Validation Error</div>
                <div className={styles.alertMessage}>{validationError}</div>
              </div>
            </div>
          )}

          {selectedFile && !validationError && (
            <div className={styles.filePreview}>
              <div className={styles.fileDetails}>
                {getFileExtensionBadge(selectedFile.name)}
                <div className={styles.fileNameMeta}>
                  <p className={styles.fileName} title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className={styles.fileMeta}>{formatBytes(selectedFile.size)} &bull; Ready to upload</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
                icon={X}
              >
                Clear
              </Button>
            </div>
          )}

          {isUploading && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBarTrack}>
                <div className={styles.progressBarFill} style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className={styles.progressLabel}>
                <span>Uploading and verifying document format...</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          )}

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
                      onClick={() => {
                        setShowUploadModal(false)
                        handleOpenDetails(uploadSuccess.resume)
                      }}
                      icon={Eye}
                    >
                      View Details &amp; Extract
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {uploadError && (
            <div className={`${styles.alert} ${styles.alertError}`} role="alert">
              <AlertCircle size={18} />
              <div className={styles.alertContent}>
                <div className={styles.alertTitle}>Upload Failed</div>
                <div className={styles.alertMessage}>{uploadError}</div>
                {selectedFile && (
                  <div className={styles.alertActions}>
                    <Button variant="danger" size="sm" onClick={handleUploadSubmit} icon={RefreshCw}>
                      Retry Upload
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Main Dashboard Content ── */}
      <Card variant="default" padding="lg">
        {/* Controls & Search */}
        <div className={styles.dashboardControls}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h2 className={styles.tableTitle}>Resume Library</h2>
            <span className={styles.countBadge}>
              {resumes.length} {resumes.length === 1 ? 'document' : 'documents'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div className={styles.searchBox}>
              <Search size={16} color="var(--color-text-muted)" />
              <input
                type="text"
                placeholder="Search resumes by title..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <X size={14} color="var(--color-text-muted)" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-sm)',
              }}
              aria-label="Filter resumes by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="UPLOADED">Uploaded</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadResumes}
              loading={isLoadingResumes}
              icon={RefreshCw}
              title="Refresh resumes list"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Error Banner with retry */}
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

        {/* Loading State */}
        {isLoadingResumes && resumes.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <Spinner size="lg" color="primary" />
            <p style={{ marginTop: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              Loading your uploaded documents from Aiven MySQL...
            </p>
          </div>
        ) : resumes.length === 0 ? (
          /* Empty State */
          <div className={styles.emptyState}>
            <FileText className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>No resumes uploaded yet</h3>
            <p className={styles.emptyText}>
              Upload your first resume in PDF or Word (.docx) format to extract structured sections,
              analyze your skills, and compare your profile against target jobs.
            </p>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Button
                variant="primary"
                onClick={() => setShowUploadModal(true)}
                icon={UploadCloud}
              >
                Upload Your First Resume
              </Button>
            </div>
          </div>
        ) : filteredResumes.length === 0 ? (
          /* Search Empty State */
          <div className={styles.emptyState}>
            <Search className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>No matching resumes found</h3>
            <p className={styles.emptyText}>
              No resumes match your search query &ldquo;{searchQuery}&rdquo; or selected filter. Try adjusting your search keywords.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('ALL')
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          /* Responsive Resume Cards Grid */
          <div>
            <div className={styles.cardGrid}>
              {paginatedResumes.map((item) => (
                <div key={item.id} className={styles.resumeCard}>
                  {/* Card Header */}
                  <div className={styles.resumeCardHeader}>
                    <div className={styles.resumeCardDocInfo}>
                      {getFileExtensionBadge(item.original_filename)}
                      <div style={{ minWidth: 0 }}>
                        <h3 className={styles.resumeCardTitle} title={item.original_filename}>
                          {item.original_filename}
                        </h3>
                        <div className={styles.resumeCardSubtitle}>
                          Resume #{item.id} &bull; {formatBytes(item.file_size)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className={styles.resumeCardBody}>
                    <div className={styles.resumeMetaRow}>
                      <span>Processing Status</span>
                      <div>{getStatusBadge(item.processing_status)}</div>
                    </div>
                    <div className={styles.resumeMetaRow}>
                      <span>Uploaded Date</span>
                      <span className={styles.resumeMetaValue}>{formatDate(item.created_at)}</span>
                    </div>
                    {item.updated_at && item.updated_at !== item.created_at && (
                      <div className={styles.resumeMetaRow}>
                        <span>Last Updated</span>
                        <span className={styles.resumeMetaValue}>{formatDate(item.updated_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className={styles.resumeCardActions}>
                    <div className={styles.resumeActionGroup}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetails(item)}
                        icon={Eye}
                      >
                        Details
                      </Button>

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
                    </div>

                    <div className={styles.resumeActionGroup}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenReplace(item)}
                        icon={FileEdit}
                        title="Replace resume with new document"
                      >
                        Replace
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDeleteConfirm(item)}
                        icon={Trash2}
                        title="Delete resume"
                        style={{ color: 'var(--color-red)' }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className={styles.paginationRow}>
                <div>
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredResumes.length)} of {filteredResumes.length} resumes
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    icon={ChevronLeft}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Resume History View ── */}
      {resumes.length > 0 && (
        <Card variant="default" padding="lg">
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <History size={20} color="var(--color-indigo)" />
              <h2 className={styles.cardTitle}>Resume Upload History</h2>
            </div>
          </CardHeader>
          <CardBody>
            <p style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Chronological log of all resumes uploaded to your account (sorted newest to oldest).
            </p>
            <div className={styles.historySection}>
              {resumes.map((hist) => (
                <div key={hist.id} className={styles.historyItem}>
                  <div className={styles.historyItemInfo}>
                    <FileText size={18} color="var(--color-indigo)" />
                    <div>
                      <div className={styles.historyItemName} title={hist.original_filename}>
                        {hist.original_filename}
                      </div>
                      <div className={styles.historyItemDate}>
                        Uploaded on {formatDate(hist.created_at)} &bull; {formatBytes(hist.file_size)} &bull; {hist.file_type}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {getStatusBadge(hist.processing_status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDetails(hist)}
                      icon={Eye}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Extracted Information Details Modal ── */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={activeResume?.original_filename || 'Resume Information'}
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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
              {activeResume && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDetailsModalOpen(false)
                      handleOpenReplace(activeResume)
                    }}
                    icon={FileEdit}
                  >
                    Replace File
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsDetailsModalOpen(false)
                      handleOpenDeleteConfirm(activeResume)
                    }}
                    icon={Trash2}
                    style={{ color: 'var(--color-red)' }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
            <Button variant="secondary" onClick={() => setIsDetailsModalOpen(false)}>
              Back to Dashboard
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
                      <LinkIcon size={14} />
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

            {/* Tab: Overview */}
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
                    <span className={styles.metaValue}>{formatBytes(activeResume.file_size)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Processing Status</span>
                    <span className={styles.metaValue}>{getStatusBadge(activeResume.processing_status)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Uploaded At</span>
                    <span className={styles.metaValue}>{formatDate(activeResume.created_at)}</span>
                  </div>
                </div>

                {activeResume.processing_status !== 'COMPLETED' ? (
                  <div className={styles.metaNoteBox}>
                    <strong>Resume Not Processed Yet</strong>
                    <p style={{ margin: 'var(--space-1) 0 0 0' }}>
                      Click <strong>Extract Resume Information</strong> below to extract all sections,
                      skills, and candidate history from this {activeResume.file_type} document into Aiven MySQL.
                    </p>
                  </div>
                ) : (
                  <div className={styles.metaNoteBox} style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
                    <strong>Structured Parsing Completed</strong>
                    <p style={{ margin: 'var(--space-1) 0 0 0' }}>
                      Document parsed and normalized into structured data model! All information is stored securely in Aiven MySQL.
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
                          ({s.category || 'General'})
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
                    const title = exp.jobTitle || exp.title || 'Role Title Not Detected'
                    const company = exp.company || 'Company not detected'
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
                        {resp && <p className={styles.sectionContent}>{resp}</p>}
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
                    const inst = edu.institution || 'Institution not detected'
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
                            Technologies: {techs}
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
                    const org = c.issuingOrganization || c.issuer || 'Issuer not detected'
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
                  <p className={styles.notDetected}>No raw sections detected yet.</p>
                ) : (
                  sections.map((sec, idx) => (
                    <div key={idx} className={styles.sectionCard}>
                      <div className={styles.sectionHeader}>
                        <h4 className={styles.sectionTitle}>{sec.section_type}</h4>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          Display Order #{sec.display_order}
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

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Confirm Resume Deletion"
        size="sm"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', width: '100%' }}>
            <Button
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              loading={isDeleting}
              icon={Trash2}
            >
              {isDeleting ? 'Deleting...' : 'Delete Resume'}
            </Button>
          </div>
        }
      >
        <div className={styles.confirmModalContent}>
          <div className={styles.confirmWarningBox}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Are you sure you want to delete this resume?</strong>
              <p style={{ margin: 'var(--space-1) 0 0 0' }}>
                Its uploaded file and associated extracted information will also be deleted from the server and database. This action cannot be undone.
              </p>
            </div>
          </div>

          {resumeToDelete && (
            <div className={styles.confirmInfoRow}>
              <div><strong>Document:</strong> {resumeToDelete.original_filename}</div>
              <div><strong>Format / Size:</strong> {resumeToDelete.file_type} &bull; {formatBytes(resumeToDelete.file_size)}</div>
              <div><strong>Uploaded:</strong> {formatDate(resumeToDelete.created_at)}</div>
            </div>
          )}

          {deleteError && (
            <div className={`${styles.alert} ${styles.alertError}`} role="alert">
              <AlertCircle size={18} />
              <div className={styles.alertContent}>
                <div className={styles.alertMessage}>{deleteError}</div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Replace Resume Modal ── */}
      <Modal
        isOpen={isReplaceModalOpen}
        onClose={() => !isReplacing && setIsReplaceModalOpen(false)}
        title="Replace Existing Resume"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', width: '100%' }}>
            <Button
              variant="secondary"
              onClick={() => setIsReplaceModalOpen(false)}
              disabled={isReplacing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmReplace}
              disabled={!replacementFile || isReplacing}
              loading={isReplacing}
              icon={FileEdit}
            >
              {isReplacing ? 'Replacing...' : 'Confirm & Replace File'}
            </Button>
          </div>
        }
      >
        <div className={styles.confirmModalContent}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Select a new PDF or Word (.docx) document to replace{' '}
            <strong>{resumeToReplace?.original_filename}</strong>. The existing file and prior extracted sections will be reset and updated with the replacement.
          </p>

          <div
            className={styles.replaceDropzone}
            onClick={() => !isReplacing && replaceFileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') replaceFileInputRef.current?.click()
            }}
          >
            <input
              ref={replaceFileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className={styles.fileInputHidden}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleReplacementFileSelect(file)
              }}
              disabled={isReplacing}
            />
            <UploadCloud size={24} color="var(--color-indigo)" />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
              {replacementFile ? 'Select a different file' : 'Click to browse replacement file'}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              PDF or DOCX up to 5 MB
            </span>
          </div>

          {replaceValidationError && (
            <div className={`${styles.alert} ${styles.alertError}`} role="alert">
              <AlertCircle size={18} />
              <div className={styles.alertContent}>
                <div className={styles.alertMessage}>{replaceValidationError}</div>
              </div>
            </div>
          )}

          {replacementFile && !replaceValidationError && (
            <div className={styles.filePreview}>
              <div className={styles.fileDetails}>
                {getFileExtensionBadge(replacementFile.name)}
                <div className={styles.fileNameMeta}>
                  <p className={styles.fileName} title={replacementFile.name}>
                    {replacementFile.name}
                  </p>
                  <p className={styles.fileMeta}>{formatBytes(replacementFile.size)} &bull; Valid replacement document</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplacementFile(null)}
                disabled={isReplacing}
                icon={X}
              >
                Clear
              </Button>
            </div>
          )}

          {isReplacing && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBarTrack}>
                <div className={styles.progressBarFill} style={{ width: `${replaceProgress}%` }} />
              </div>
              <div className={styles.progressLabel}>
                <span>Uploading replacement and resetting extracted data...</span>
                <span>{replaceProgress}%</span>
              </div>
            </div>
          )}

          {replaceError && (
            <div className={`${styles.alert} ${styles.alertError}`} role="alert">
              <AlertCircle size={18} />
              <div className={styles.alertContent}>
                <div className={styles.alertMessage}>{replaceError}</div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
