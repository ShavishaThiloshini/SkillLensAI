import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  History,
  Search,
  X,
  Briefcase,
  FileText,
  Clock,
  FileDown,
  Award,
  BookOpen,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  TrendingUp,
  Layers,
  Sparkles,
} from 'lucide-react'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'
import { getAnalysisHistory, deleteAnalysis } from '../services/analysisService'
import styles from './AnalysisHistory.module.css'

function formatDate(isoString) {
  if (!isoString) return 'Date unavailable'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AnalysisHistory() {
  const navigate = useNavigate()

  // Data states
  const [historyData, setHistoryData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState(null)

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState('')
  const [matchFilter, setMatchFilter] = useState('all') // 'all' | 'high' | 'medium' | 'low'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'COMPLETED' | 'PROCESSING' | 'FAILED'
  const [dateRangeFilter, setDateRangeFilter] = useState('all') // 'all' | '7d' | '30d' | '90d'
  const [sortBy, setSortBy] = useState('most_recent') // 'most_recent' | 'oldest' | 'highest_match' | 'lowest_match'
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Delete modal state
  const [deletingItem, setDeletingItem] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load history data from backend API
  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getAnalysisHistory({
        search: searchQuery.trim(),
        match: matchFilter,
        status: statusFilter,
        dateRange: dateRangeFilter,
        sortBy,
        page: currentPage,
        limit: pageSize,
      })
      setHistoryData(response.data)
    } catch (err) {
      console.error('Failed to load history:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load analysis history.')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, matchFilter, statusFilter, dateRangeFilter, sortBy, currentPage, pageSize])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Handle Search Input with debounce or on Enter
  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setCurrentPage(1)
    loadHistory()
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setMatchFilter('all')
    setStatusFilter('all')
    setDateRangeFilter('all')
    setSortBy('most_recent')
    setCurrentPage(1)
  }

  // Handle Delete Confirmation
  const confirmDelete = async () => {
    if (!deletingItem) return
    setIsDeleting(true)
    try {
      await deleteAnalysis(deletingItem.id)
      setFeedback({ type: 'success', message: 'Analysis deleted successfully from history.' })
      setDeletingItem(null)
      // Reload history
      await loadHistory()
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to delete analysis record.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const isFiltered =
    searchQuery.trim() !== '' ||
    matchFilter !== 'all' ||
    statusFilter !== 'all' ||
    dateRangeFilter !== 'all' ||
    sortBy !== 'most_recent'

  const analyses = historyData?.analyses || []
  const pagination = historyData?.pagination || {}
  const summaryStats = historyData?.summaryStats || {}

  return (
    <main className={styles.page}>
      {/* ── Page Header ── */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Historical Comparisons</p>
          <h1 className={styles.title}>Analysis History</h1>
          <p className={styles.subtitle}>
            Review, compare, and manage your previous resume-to-job match evaluations.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button variant="primary" size="sm" onClick={() => navigate('/matching')}>
            <Sparkles size={15} /> Start New Analysis
          </Button>
        </div>
      </header>

      {/* ── Feedback Message Toast ── */}
      {feedback && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            backgroundColor: feedback.type === 'success' ? 'var(--color-emerald-50)' : 'var(--color-red-50)',
            color: feedback.type === 'success' ? 'var(--color-emerald-dark)' : 'var(--color-red-dark)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--color-emerald-100)' : 'var(--color-red-100)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
          role="status"
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ── Summary Stats / KPI Row ── */}
      <section className={styles.statsGrid} aria-label="Analysis Statistics">
        <article className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Total Analyses</span>
            <History size={16} />
          </div>
          <div className={styles.statValue}>{summaryStats.totalAnalyses || 0}</div>
          <div className={styles.statSubtext}>Saved evaluation snapshots</div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Average Match</span>
            <TrendingUp size={16} />
          </div>
          <div className={styles.statValue}>
            {summaryStats.averageScore ? `${summaryStats.averageScore}%` : '0%'}
          </div>
          <div className={styles.statSubtext}>Across all completed roles</div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Highest Match</span>
            <Award size={16} />
          </div>
          <div className={styles.statValue}>
            {summaryStats.highestScore ? `${summaryStats.highestScore}%` : '0%'}
          </div>
          <div className={styles.statSubtext}>Peak candidate alignment</div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Completed Analyses</span>
            <CheckCircle2 size={16} />
          </div>
          <div className={styles.statValue}>{summaryStats.completedCount || 0}</div>
          <div className={styles.statSubtext}>Fully scored & evaluated</div>
        </article>
      </section>

      {/* ── Search and Filter Controls Panel ── */}
      <section className={styles.controlsPanel} aria-label="Search and Filter Controls">
        <form className={styles.searchRow} onSubmit={handleSearchSubmit}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by job title, company, or resume name…"
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>

          {isFiltered && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
              Reset Filters
            </Button>
          )}
        </form>

        <div className={styles.filterRow}>
          {/* Match Score Filter */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Match:</span>
            <button
              className={`${styles.filterPill} ${matchFilter === 'all' ? styles.filterPillActive : ''}`}
              onClick={() => { setMatchFilter('all'); setCurrentPage(1); }}
            >
              All
            </button>
            <button
              className={`${styles.filterPill} ${matchFilter === 'high' ? styles.filterPillActive : ''}`}
              onClick={() => { setMatchFilter('high'); setCurrentPage(1); }}
            >
              High (75%+)
            </button>
            <button
              className={`${styles.filterPill} ${matchFilter === 'medium' ? styles.filterPillActive : ''}`}
              onClick={() => { setMatchFilter('medium'); setCurrentPage(1); }}
            >
              Medium (50–74%)
            </button>
            <button
              className={`${styles.filterPill} ${matchFilter === 'low' ? styles.filterPillActive : ''}`}
              onClick={() => { setMatchFilter('low'); setCurrentPage(1); }}
            >
              Low (&lt;50%)
            </button>
          </div>

          {/* Date & Sort Controls */}
          <div className={styles.filterGroup}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className={styles.filterLabel}>Date:</span>
              <select
                className={styles.filterSelect}
                value={dateRangeFilter}
                onChange={(e) => { setDateRangeFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className={styles.filterLabel}>Status:</span>
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PROCESSING">Processing</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className={styles.filterLabel}>Sort:</span>
              <select
                className={styles.filterSelect}
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              >
                <option value="most_recent">Most Recent</option>
                <option value="oldest">Oldest</option>
                <option value="highest_match">Highest Match</option>
                <option value="lowest_match">Lowest Match</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ── Loading State ── */}
      {loading && (
        <div className={styles.state}>
          <Spinner size="lg" />
          <p>Loading your analysis history…</p>
        </div>
      )}

      {/* ── Error State ── */}
      {error && !loading && (
        <div className={styles.state}>
          <AlertTriangle size={36} className={styles.stateIcon} />
          <h2 className={styles.emptyStateTitle}>Unable to load history</h2>
          <p className={styles.emptyStateDesc}>{error}</p>
          <Button onClick={loadHistory}>Try again</Button>
        </div>
      )}

      {/* ── Initial Empty State (No records at all) ── */}
      {!loading && !error && analyses.length === 0 && !isFiltered && (
        <div className={styles.state}>
          <History size={40} className={styles.stateIcon} />
          <h2 className={styles.emptyStateTitle}>No Previous Analyses</h2>
          <p className={styles.emptyStateDesc}>
            Your completed resume-to-job comparisons will appear here. Run your first analysis to discover your skill match and career roadmap.
          </p>
          <Button variant="primary" onClick={() => navigate('/matching')}>
            <Sparkles size={16} /> Compare a Resume & Job
          </Button>
        </div>
      )}

      {/* ── Filter Empty State (Search / Filter returned 0) ── */}
      {!loading && !error && analyses.length === 0 && isFiltered && (
        <div className={styles.state}>
          <Search size={36} className={styles.stateIcon} />
          <h2 className={styles.emptyStateTitle}>No Analyses Found</h2>
          <p className={styles.emptyStateDesc}>
            No saved analyses matched your current search and filter settings. Try adjusting your search query or reset the filters.
          </p>
          <Button variant="outline" onClick={handleClearFilters}>
            Clear All Filters
          </Button>
        </div>
      )}

      {/* ── Analysis History Cards List ── */}
      {!loading && !error && analyses.length > 0 && (
        <section className={styles.historyList} aria-label="Saved Analysis Cards">
          {analyses.map((item) => {
            const scoreClass =
              item.matchCategory === 'HIGH'
                ? styles.scoreHigh
                : item.matchCategory === 'MEDIUM'
                ? styles.scoreMedium
                : item.matchCategory === 'LOW'
                ? styles.scoreLow
                : styles.scoreUnavailable

            const statusClass =
              item.status === 'COMPLETED'
                ? styles.statusCompleted
                : item.status === 'FAILED'
                ? styles.statusFailed
                : styles.statusProcessing

            return (
              <article key={item.id} className={styles.historyCard}>
                <div className={styles.historyCardLeft}>
                  {/* Score Gauge Circle */}
                  <div className={`${styles.scoreBadge} ${scoreClass}`}>
                    <span className={styles.scorePercent}>
                      {item.overallScore !== null ? `${item.overallScore}%` : 'N/A'}
                    </span>
                    <span className={styles.scoreLabel}>Match</span>
                  </div>

                  {/* Card Main Info */}
                  <div className={styles.cardInfo}>
                    <div className={styles.cardTitleRow}>
                      <h3 className={styles.jobTitle}>
                        <Briefcase size={17} style={{ color: 'var(--color-indigo)', flexShrink: 0 }} />
                        {item.jobTitle}
                      </h3>

                      {item.company && (
                        <span className={styles.companyBadge}>at {item.company}</span>
                      )}

                      <span className={`${styles.statusPill} ${statusClass}`}>
                        {item.status === 'COMPLETED' ? (
                          <CheckCircle2 size={12} />
                        ) : item.status === 'FAILED' ? (
                          <XCircle size={12} />
                        ) : (
                          <HelpCircle size={12} />
                        )}
                        {item.status.toLowerCase()}
                      </span>
                    </div>

                    {/* Metadata: Resume name & Date */}
                    <div className={styles.cardMetaRow}>
                      <div className={styles.metaItem}>
                        <FileText size={14} style={{ color: 'var(--color-text-muted)' }} />
                        <span>{item.resumeName}</span>
                      </div>

                      <div className={styles.metaItem}>
                        <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
                        <span>
                          {formatDate(item.createdAt)} · {formatTime(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Score Breakdown Micro-Chips */}
                    <div className={styles.breakdownChips}>
                      {item.scores.skills !== null && (
                        <span className={styles.chip}>Skills: {item.scores.skills}%</span>
                      )}
                      {item.scores.experience !== null && (
                        <span className={styles.chip}>Experience: {item.scores.experience}%</span>
                      )}
                      {item.scores.education !== null && (
                        <span className={styles.chip}>Education: {item.scores.education}%</span>
                      )}
                      {item.hasRoadmap && (
                        <span
                          className={styles.chip}
                          style={{ backgroundColor: 'var(--color-indigo-50)', color: 'var(--color-indigo-dark)' }}
                        >
                          Roadmap Available
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side Actions */}
                <div className={styles.historyCardRight}>
                  {item.hasRoadmap && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/roadmap?analysisId=${item.id}&resumeId=${item.resumeId}&jobId=${item.jobId}`
                        )
                      }
                      title="View personalized skill gap roadmap"
                    >
                      <BookOpen size={14} /> Roadmap
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/reports/${item.id}`)}
                    title="View and download PDF report"
                  >
                    <FileDown size={14} /> Report
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/analysis-results?analysisId=${item.id}`)}
                  >
                    View Analysis <ChevronRight size={14} />
                  </Button>

                  <button
                    className={styles.deleteBtn}
                    onClick={() => setDeletingItem(item)}
                    aria-label={`Delete analysis for ${item.jobTitle}`}
                    title="Delete this analysis record"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {/* ── Pagination Row ── */}
      {!loading && !error && pagination.total > 0 && (
        <section className={styles.paginationRow} aria-label="Pagination Navigation">
          <div className={styles.paginationInfo}>
            Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> to{' '}
            <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{' '}
            <strong>{pagination.total}</strong> analyses
          </div>

          <div className={styles.paginationButtons}>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
            >
              Previous
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === pagination.totalPages ||
                  Math.abs(p - pagination.page) <= 1
              )
              .map((p) => (
                <button
                  key={p}
                  className={`${styles.pageBtn} ${
                    p === pagination.page ? styles.pageBtnActive : ''
                  }`}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </button>
              ))}

            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingItem && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <AlertTriangle size={22} />
              <h3 id="delete-title" className={styles.modalTitle}>
                Delete Analysis Record?
              </h3>
            </div>

            <p className={styles.modalBody}>
              Are you sure you want to delete the analysis record for <strong>{deletingItem.jobTitle}</strong> (Resume:{' '}
              {deletingItem.resumeName})?
              <br />
              <br />
              This will permanently delete this analysis and its associated roadmap. Your uploaded resume and job description will <strong>not</strong> be deleted.
            </p>

            <div className={styles.modalActions}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <Spinner size="sm" /> : <Trash2 size={14} />}
                {isDeleting ? 'Deleting…' : 'Delete Analysis'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

