import { useState, useEffect, useRef } from 'react'
import {
  FileText,
  UploadCloud,
  ClipboardPaste,
  Building2,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Search,
  Eye,
  X,
  Copy,
  Check,
  Clock,
  Sparkles,
  RefreshCw,
  FileCheck,
} from 'lucide-react'
import Button from '../components/common/Button'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import Modal from '../components/common/Modal'
import Spinner from '../components/common/Spinner'
import Input from '../components/common/Input'
import {
  createJobDescription,
  uploadJobDescription,
  getJobDescriptions,
  getJobDescriptionById,
} from '../services/jobService'
import styles from './JobDescriptions.module.css'

const MAX_DESCRIPTION_LENGTH = 30000
const MAX_TITLE_LENGTH = 200
const MAX_COMPANY_LENGTH = 200
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
  })
}

export default function JobDescriptions() {
  // Navigation / active input mode
  const [activeTab, setActiveTab] = useState('paste') // 'paste' | 'upload'

  // Pasted text form state
  const [pastedTitle, setPastedTitle] = useState('')
  const [pastedCompany, setPastedCompany] = useState('')
  const [pastedDescription, setPastedDescription] = useState('')
  const [isSubmittingPaste, setIsSubmittingPaste] = useState(false)

  // Upload document form state
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCompany, setUploadCompany] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false)
  const fileInputRef = useRef(null)

  // Global feedback alerts
  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackSuccess, setFeedbackSuccess] = useState('')

  // Job descriptions list state
  const [jobs, setJobs] = useState([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)
  const [jobsError, setJobsError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('ALL')

  // Details Modal state
  const [selectedJob, setSelectedJob] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // Load existing job descriptions
  const fetchJobs = async () => {
    setIsLoadingJobs(true)
    setJobsError('')
    try {
      const data = await getJobDescriptions()
      if (data.success) {
        setJobs(data.jobs || [])
      } else {
        setJobsError(data.message || 'Failed to load job descriptions.')
      }
    } catch (err) {
      setJobsError(
        err.response?.data?.message ||
          'Failed to load job descriptions. Please check your connection.'
      )
    } finally {
      setIsLoadingJobs(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  // Auto-dismiss alerts after 6 seconds
  useEffect(() => {
    if (feedbackSuccess) {
      const timer = setTimeout(() => setFeedbackSuccess(''), 6000)
      return () => clearTimeout(timer)
    }
  }, [feedbackSuccess])

  // Handle Pasted Text Submission
  const handlePasteSubmit = async (e) => {
    e.preventDefault()
    setFeedbackError('')
    setFeedbackSuccess('')

    const trimmedTitle = pastedTitle.trim()
    const trimmedCompany = pastedCompany.trim()
    const trimmedDescription = pastedDescription.trim()

    if (!trimmedTitle) {
      setFeedbackError('Please enter a target job title.')
      return
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setFeedbackError(`Job title must not exceed ${MAX_TITLE_LENGTH} characters.`)
      return
    }

    if (trimmedCompany && trimmedCompany.length > MAX_COMPANY_LENGTH) {
      setFeedbackError(`Company name must not exceed ${MAX_COMPANY_LENGTH} characters.`)
      return
    }

    if (!trimmedDescription) {
      setFeedbackError('Please enter or paste the job description text.')
      return
    }

    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      setFeedbackError(
        `Job description exceeds the maximum length of ${MAX_DESCRIPTION_LENGTH.toLocaleString()} characters.`
      )
      return
    }

    setIsSubmittingPaste(true)
    try {
      const result = await createJobDescription({
        title: trimmedTitle,
        company: trimmedCompany || undefined,
        description: trimmedDescription,
      })

      if (result.success) {
        setFeedbackSuccess('Job description saved successfully!')
        setPastedTitle('')
        setPastedCompany('')
        setPastedDescription('')
        fetchJobs()
      } else {
        setFeedbackError(result.message || 'Failed to save job description.')
      }
    } catch (err) {
      setFeedbackError(
        err.response?.data?.message ||
          'An unexpected error occurred while saving the job description.'
      )
    } finally {
      setIsSubmittingPaste(false)
    }
  }

  // Handle File Selection and Drag & Drop
  const handleFileValidation = (file) => {
    setFeedbackError('')
    if (!file) return false

    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFeedbackError('Invalid file type. Only PDF (.pdf) and Word (.docx) files are supported.')
      return false
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFeedbackError('File exceeds the 5 MB maximum size limit.')
      return false
    }

    if (file.size === 0) {
      setFeedbackError('The selected file is empty (0 bytes).')
      return false
    }

    setSelectedFile(file)
    return true
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileValidation(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileValidation(e.target.files[0])
    }
  }

  // Handle Document Upload Submission
  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    setFeedbackError('')
    setFeedbackSuccess('')

    const trimmedTitle = uploadTitle.trim()
    const trimmedCompany = uploadCompany.trim()

    if (!trimmedTitle) {
      setFeedbackError('Please enter a target job title.')
      return
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setFeedbackError(`Job title must not exceed ${MAX_TITLE_LENGTH} characters.`)
      return
    }

    if (!selectedFile) {
      setFeedbackError('Please select or drop a PDF or DOCX file to upload.')
      return
    }

    setIsSubmittingUpload(true)
    setUploadProgress(0)

    try {
      const result = await uploadJobDescription(
        {
          title: trimmedTitle,
          company: trimmedCompany || undefined,
          file: selectedFile,
        },
        (progress) => setUploadProgress(progress)
      )

      if (result.success) {
        const charMsg = result.extractedCharCount
          ? ` (${result.extractedCharCount.toLocaleString()} characters extracted)`
          : ''
        setFeedbackSuccess(`Job description extracted and saved successfully!${charMsg}`)
        setUploadTitle('')
        setUploadCompany('')
        setSelectedFile(null)
        setUploadProgress(0)
        if (fileInputRef.current) fileInputRef.current.value = ''
        fetchJobs()
      } else {
        setFeedbackError(result.message || 'Failed to upload job description.')
      }
    } catch (err) {
      setFeedbackError(
        err.response?.data?.message ||
          'Failed to extract and save job description from the uploaded document.'
      )
    } finally {
      setIsSubmittingUpload(false)
    }
  }

  // View Details Modal
  const handleViewDetails = async (jobId) => {
    setIsLoadingDetails(true)
    setIsModalOpen(true)
    setCopySuccess(false)
    try {
      const data = await getJobDescriptionById(jobId)
      if (data.success) {
        setSelectedJob(data.job)
      } else {
        setFeedbackError(data.message || 'Failed to load job description details.')
      }
    } catch (err) {
      setFeedbackError(
        err.response?.data?.message || 'Could not retrieve job description.'
      )
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleCopyText = () => {
    if (!selectedJob?.description) return
    navigator.clipboard.writeText(selectedJob.description)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2500)
  }

  // Filtered jobs list
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      (job.title && job.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.company && job.company.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesSource =
      sourceFilter === 'ALL' || job.source_type === sourceFilter

    return matchesSearch && matchesSource
  })

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1 className={styles.title}>Job Descriptions</h1>
            <span className={styles.taglineBadge}>
              <Sparkles size={13} />
              Day 15
            </span>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-indigo-dark)', fontWeight: 600 }}>
            See your skills. Find your gaps. Build your career.
          </span>
        </div>
        <p className={styles.description}>
          Add the job descriptions you want to target. You can either paste text directly or upload
          a PDF / DOCX file to automatically extract requirements for skill gap analysis.
        </p>
      </div>

      {/* Global Alerts */}
      {feedbackError && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{feedbackError}</span>
        </div>
      )}

      {feedbackSuccess && (
        <div className={`${styles.alert} ${styles.alertSuccess}`} role="alert">
          <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {/* Input Card with Tabs */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Briefcase size={20} color="var(--color-indigo)" />
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>
                Add Target Job Description
              </h2>
            </div>

            {/* Input Method Switcher */}
            <div className={styles.tabsNav} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'paste'}
                className={`${styles.tabBtn} ${activeTab === 'paste' ? styles.tabBtnActive : ''}`}
                onClick={() => {
                  setActiveTab('paste')
                  setFeedbackError('')
                }}
              >
                <ClipboardPaste size={15} />
                Paste Text
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'upload'}
                className={`${styles.tabBtn} ${activeTab === 'upload' ? styles.tabBtnActive : ''}`}
                onClick={() => {
                  setActiveTab('upload')
                  setFeedbackError('')
                }}
              >
                <UploadCloud size={15} />
                Upload Document
              </button>
            </div>
          </div>
        </CardHeader>

        <CardBody>
          {/* TAB 1: Paste Text */}
          {activeTab === 'paste' && (
            <form onSubmit={handlePasteSubmit} className={styles.form}>
              <div className={styles.grid2}>
                <Input
                  label="Job Title"
                  required
                  placeholder="e.g. Senior Full Stack Engineer"
                  value={pastedTitle}
                  onChange={(e) => setPastedTitle(e.target.value)}
                  maxLength={MAX_TITLE_LENGTH}
                  disabled={isSubmittingPaste}
                />
                <Input
                  label="Company Name"
                  placeholder="e.g. Google, Acme Corp (optional)"
                  value={pastedCompany}
                  onChange={(e) => setPastedCompany(e.target.value)}
                  maxLength={MAX_COMPANY_LENGTH}
                  disabled={isSubmittingPaste}
                />
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>
                  <span>
                    Job Description Content
                    <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <span
                    className={`${styles.charCount} ${
                      pastedDescription.length > MAX_DESCRIPTION_LENGTH
                        ? styles.charCountOverLimit
                        : pastedDescription.length > MAX_DESCRIPTION_LENGTH - 2000
                        ? styles.charCountNearLimit
                        : ''
                    }`}
                  >
                    {pastedDescription.length.toLocaleString()} / {MAX_DESCRIPTION_LENGTH.toLocaleString()} characters
                  </span>
                </div>

                <textarea
                  className={styles.textarea}
                  rows={8}
                  placeholder="Paste the full job posting here, including overview, responsibilities, technical requirements, and qualifications..."
                  value={pastedDescription}
                  onChange={(e) => setPastedDescription(e.target.value)}
                  disabled={isSubmittingPaste}
                  required
                />
              </div>

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmittingPaste || !pastedTitle.trim() || !pastedDescription.trim()}
                >
                  {isSubmittingPaste ? (
                    <>
                      <Spinner size="sm" />
                      Saving Description...
                    </>
                  ) : (
                    <>
                      <ClipboardPaste size={16} />
                      Save Job Description
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: Upload Document */}
          {activeTab === 'upload' && (
            <form onSubmit={handleUploadSubmit} className={styles.form}>
              <div className={styles.grid2}>
                <Input
                  label="Job Title"
                  required
                  placeholder="e.g. Lead React Developer"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  maxLength={MAX_TITLE_LENGTH}
                  disabled={isSubmittingUpload}
                />
                <Input
                  label="Company Name"
                  placeholder="e.g. Stripe (optional)"
                  value={uploadCompany}
                  onChange={(e) => setUploadCompany(e.target.value)}
                  maxLength={MAX_COMPANY_LENGTH}
                  disabled={isSubmittingUpload}
                />
              </div>

              {/* Drag and Drop Zone or Selected File */}
              {!selectedFile ? (
                <div
                  className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''} ${
                    isSubmittingUpload ? styles.dropzoneDisabled : ''
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
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
                    accept=".pdf,.docx"
                    style={{ display: 'none' }}
                    onChange={handleFileInputChange}
                    disabled={isSubmittingUpload}
                  />

                  <div className={styles.iconWrapper}>
                    <UploadCloud size={28} />
                  </div>

                  <div>
                    <p className={styles.dropzonePrompt}>
                      Drop your job posting file here, or{' '}
                      <span className={styles.highlightLink}>browse files</span>
                    </p>
                    <p className={styles.dropzoneMeta}>
                      Supports PDF and Microsoft Word (.docx) documents up to 5 MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className={styles.fileCard}>
                  <div className={styles.fileInfo}>
                    <FileText size={28} className={styles.fileIcon} />
                    <div>
                      <p className={styles.fileName}>{selectedFile.name}</p>
                      <p className={styles.fileMeta}>{formatBytes(selectedFile.size)}</p>
                    </div>
                  </div>
                  {!isSubmittingUpload && (
                    <button
                      type="button"
                      className={styles.removeFileBtn}
                      onClick={() => {
                        setSelectedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      aria-label="Remove selected file"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              )}

              {/* Progress bar */}
              {isSubmittingUpload && uploadProgress > 0 && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressHeader}>
                    <span>Uploading & extracting document text...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className={styles.progressBarTrack}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmittingUpload || !uploadTitle.trim() || !selectedFile}
                >
                  {isSubmittingUpload ? (
                    <>
                      <Spinner size="sm" />
                      Extracting & Saving...
                    </>
                  ) : (
                    <>
                      <FileCheck size={16} />
                      Extract & Save Job
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      {/* Saved Job Descriptions Section */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <span>Saved Target Roles</span>
          <span className={styles.countPill}>{filteredJobs.length}</span>
        </div>

        <div className={styles.filterControls}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by role or company..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className={styles.filterSelect}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Filter by input source"
          >
            <option value="ALL">All Sources</option>
            <option value="PASTED_TEXT">Pasted Text</option>
            <option value="UPLOADED_FILE">Uploaded Document</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchJobs}
            disabled={isLoadingJobs}
            title="Refresh job descriptions"
          >
            <RefreshCw size={15} className={isLoadingJobs ? 'spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Loading state for list */}
      {isLoadingJobs && jobs.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <Spinner size="lg" />
        </div>
      )}

      {/* Jobs List / Cards Grid */}
      {!isLoadingJobs && filteredJobs.length > 0 && (
        <div className={styles.jobsGrid}>
          {filteredJobs.map((job) => (
            <div key={job.id} className={styles.jobCard}>
              <div className={styles.cardTopRow}>
                <h3 className={styles.jobTitleText}>{job.title}</h3>
                <span className={styles.statusCompleted}>
                  <CheckCircle2 size={12} />
                  Ready
                </span>
              </div>

              {job.company && (
                <p className={styles.companyText}>
                  <Building2 size={14} color="var(--color-indigo)" />
                  {job.company}
                </p>
              )}

              <div className={styles.badgeRow}>
                {job.source_type === 'UPLOADED_FILE' ? (
                  <span className={`${styles.sourceBadge} ${styles.sourceUploaded}`}>
                    <FileText size={12} />
                    Uploaded Document
                  </span>
                ) : (
                  <span className={`${styles.sourceBadge} ${styles.sourcePasted}`}>
                    <ClipboardPaste size={12} />
                    Pasted Text
                  </span>
                )}
              </div>

              <p className={styles.snippet}>
                {job.description_preview || job.description || 'No description preview available.'}
              </p>

              <div className={styles.cardFooter}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  {formatDate(job.created_at)}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(job.id)}
                >
                  <Eye size={14} />
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoadingJobs && filteredJobs.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrapper}>
            <Briefcase size={32} />
          </div>
          <h3 className={styles.emptyTitle}>
            {searchQuery || sourceFilter !== 'ALL'
              ? 'No matching job descriptions'
              : 'No job descriptions added yet'}
          </h3>
          <p className={styles.emptyDescription}>
            {searchQuery || sourceFilter !== 'ALL'
              ? 'Try adjusting your search terms or filter settings.'
              : 'Add your target job descriptions above to begin comparing against your resumes and pinpointing your skill gaps.'}
          </p>
        </div>
      )}

      {/* Job Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedJob(null)
        }}
        title="Job Description Details"
        size="lg"
      >
        {isLoadingDetails && !selectedJob && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <Spinner size="md" />
          </div>
        )}

        {selectedJob && (
          <div>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{selectedJob.title}</h2>
              <div className={styles.modalMetaRow}>
                {selectedJob.company && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={15} color="var(--color-indigo)" />
                    {selectedJob.company}
                  </span>
                )}
                <span>Added on {formatDate(selectedJob.created_at)}</span>
                <span
                  className={`${styles.sourceBadge} ${
                    selectedJob.source_type === 'UPLOADED_FILE'
                      ? styles.sourceUploaded
                      : styles.sourcePasted
                  }`}
                >
                  {selectedJob.source_type === 'UPLOADED_FILE'
                    ? 'Uploaded File'
                    : 'Pasted Text'}
                </span>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className={styles.statsBar} style={{ marginTop: 'var(--space-3)' }}>
              <div className={styles.statItem}>
                <span>Characters:</span>
                <span className={styles.statValue}>
                  {selectedJob.description?.length.toLocaleString() || 0}
                </span>
              </div>
              <div className={styles.statItem}>
                <span>Words:</span>
                <span className={styles.statValue}>
                  {selectedJob.description
                    ? selectedJob.description.trim().split(/\s+/).length.toLocaleString()
                    : 0}
                </span>
              </div>
              <div className={styles.statItem}>
                <span>Status:</span>
                <span className={styles.statValue} style={{ color: 'var(--color-emerald-dark)' }}>
                  COMPLETED
                </span>
              </div>
            </div>

            {/* Full text viewer */}
            <div className={styles.fullTextContainer}>
              {selectedJob.description}
            </div>

            {/* Modal Footer Actions */}
            <div className={styles.modalFooter}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
                disabled={!selectedJob.description}
              >
                {copySuccess ? (
                  <>
                    <Check size={14} color="var(--color-emerald)" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy Text
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsModalOpen(false)
                  setSelectedJob(null)
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
