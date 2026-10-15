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
} from 'lucide-react'
import Button from '../components/common/Button'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import Modal from '../components/common/Modal'
import Spinner from '../components/common/Spinner'
import { uploadResume, getResumes } from '../services/resumeService'
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
            'Resume uploaded successfully! Document is verified and ready for Day 11 text extraction.',
          resume: result.resume,
        })
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        // Refresh resume list from backend
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

  const handleOpenDetails = (resume) => {
    setActiveResume(resume)
    setIsModalOpen(true)
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

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Resume Management</h1>
          <span className={styles.stageBadge}>
            <Sparkles size={14} /> Day 10: Ingestion & Validation
          </span>
        </div>
        <p className={styles.description}>
          Upload your resume in PDF or Word (DOCX) format. SkillLens AI validates
          the internal structure, securely stores the document, and prepares it for
          deep text extraction and skill gap analysis.
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
                      View Metadata
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
                  <th style={{ textAlign: 'right' }}>Action</th>
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
                    <td>
                      <span className={`${styles.statusPill} ${styles.statusUploaded}`}>
                        <span className={styles.statusDot} />
                        {item.processing_status || 'UPLOADED'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
                        <Clock size={12} />
                        {formatDate(item.created_at)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetails(item)}
                        icon={Eye}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Metadata Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Resume Metadata"
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            Close
          </Button>
        }
      >
        {activeResume && (
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
                  {formatBytes(activeResume.file_size)} ({Number(activeResume.file_size).toLocaleString()} bytes)
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Processing Status</span>
                <span className={styles.metaValue}>
                  <span className={`${styles.statusPill} ${styles.statusUploaded}`}>
                    <span className={styles.statusDot} />
                    {activeResume.processing_status || 'UPLOADED'}
                  </span>
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Upload Timestamp</span>
                <span className={styles.metaValue}>{formatDate(activeResume.created_at)}</span>
              </div>
            </div>

            <div className={styles.metaNoteBox}>
              <strong>Current Stage: Ingestion &amp; Storage (Day 10)</strong>
              <p style={{ margin: 'var(--space-1) 0 0 0' }}>
                This resume has been securely stored on the server. In Day 11, the
                text extraction pipeline will parse raw content and sections from this
                document for skill gap comparison.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
