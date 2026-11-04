import React, { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
} from 'lucide-react'
import styles from './SkillCategorySection.module.css'

const CATEGORIES = [
  {
    key: 'STRONG_MATCH',
    title: 'Strong Matches',
    subtitle: 'Verified by resume evidence',
    icon: CheckCircle2,
    tone: 'strong',
    emptyText: 'No strong skill matches found in this view.',
  },
  {
    key: 'PARTIAL_MATCH',
    title: 'Partial Matches',
    subtitle: 'Related skills with transferable background',
    icon: AlertTriangle,
    tone: 'partial',
    emptyText: 'No partial skill matches found in this view.',
  },
  {
    key: 'MISSING',
    title: 'Missing Skills',
    subtitle: 'Requirements not evidenced in resume',
    icon: XCircle,
    tone: 'missing',
    emptyText: 'No missing skills in this view.',
  },
]

/**
 * SkillLens AI — Skill Category Section
 * Groups skills into Strong Matches, Partial Matches, and Missing Skills
 * with responsive filtering, text search, and accessible priority badges.
 */
export default function SkillCategorySection({ results = [] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [requirementFilter, setRequirementFilter] = useState('ALL') // ALL, REQUIRED, PREFERRED
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL, STRONG_MATCH, PARTIAL_MATCH, MISSING

  // Filter skills based on search term and filters
  const filteredSkills = useMemo(() => {
    return results.filter((item) => {
      // 1. Search term match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchName = (item.jobSkill || '').toLowerCase().includes(query)
        const matchMatched = (item.matchedSkill || '').toLowerCase().includes(query)
        const matchDomain = (item.skillCategory || '').toLowerCase().includes(query)
        if (!matchName && !matchMatched && !matchDomain) return false
      }

      // 2. Requirement type match
      if (requirementFilter !== 'ALL') {
        if (item.requirementType !== requirementFilter) return false
      }

      // 3. Status filter match
      if (statusFilter !== 'ALL') {
        if (item.category !== statusFilter) return false
      }

      return true
    })
  }, [results, searchQuery, requirementFilter, statusFilter])

  // Group filtered skills by category
  const grouped = useMemo(() => {
    const map = {
      STRONG_MATCH: [],
      PARTIAL_MATCH: [],
      MISSING: [],
    }
    for (const skill of filteredSkills) {
      if (map[skill.category]) {
        map[skill.category].push(skill)
      }
    }
    return map
  }, [filteredSkills])

  // Determine which category columns to display
  const visibleCategories = statusFilter === 'ALL'
    ? CATEGORIES
    : CATEGORIES.filter((c) => c.key === statusFilter)

  return (
    <section className={styles.container} aria-labelledby="skill-breakdown-heading">
      <div className={styles.controlsBar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search skills (e.g. React, SQL, Docker)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter skills by keyword"
          />
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Type:</span>
          {['ALL', 'REQUIRED', 'PREFERRED'].map((type) => (
            <button
              key={type}
              type="button"
              className={`${styles.pillButton} ${requirementFilter === type ? styles.pillActive : ''}`}
              onClick={() => setRequirementFilter(type)}
            >
              {type === 'ALL' ? 'All Types' : type === 'REQUIRED' ? 'Required' : 'Preferred'}
            </button>
          ))}
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Status:</span>
          {[
            { id: 'ALL', label: 'All Statuses' },
            { id: 'STRONG_MATCH', label: 'Strong' },
            { id: 'PARTIAL_MATCH', label: 'Partial' },
            { id: 'MISSING', label: 'Missing' },
          ].map((status) => (
            <button
              key={status.id}
              type="button"
              className={`${styles.pillButton} ${statusFilter === status.id ? styles.pillActive : ''}`}
              onClick={() => setStatusFilter(status.id)}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.categoryGrid}>
        {visibleCategories.map((cat) => {
          const Icon = cat.icon
          const entries = grouped[cat.key] || []

          return (
            <article
              key={cat.key}
              className={`${styles.categoryCard} ${styles[cat.tone]}`}
              aria-label={`${cat.title} list, ${entries.length} skills`}
            >
              <header className={styles.cardHeader}>
                <div className={styles.cardIcon} aria-hidden="true">
                  <Icon size={20} />
                </div>
                <div className={styles.cardTitles}>
                  <h4 className={styles.cardTitle}>{cat.title}</h4>
                  <p className={styles.cardCount}>
                    {entries.length} {entries.length === 1 ? 'skill' : 'skills'} · {cat.subtitle}
                  </p>
                </div>
              </header>

              {entries.length > 0 ? (
                <ul className={styles.skillList}>
                  {entries.map((item, idx) => {
                    const isRequired = item.requirementType === 'REQUIRED'
                    const priorityClass = item.priority === 'HIGH'
                      ? styles.priorityHigh
                      : item.priority === 'LOW'
                        ? styles.priorityLow
                        : styles.priorityMedium

                    return (
                      <li key={`${item.jobSkill}-${idx}`} className={styles.skillItem}>
                        <div className={styles.skillTopRow}>
                          <span className={styles.skillName}>{item.jobSkill}</span>
                          <div className={styles.badges}>
                            <span
                              className={`${styles.reqBadge} ${isRequired ? styles.badgeRequired : styles.badgePreferred}`}
                            >
                              {isRequired ? 'Required' : 'Preferred'}
                            </span>
                            {item.priority && (
                              <span className={`${styles.priorityBadge} ${priorityClass}`}>
                                {item.priority}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Category A: Strong Match Evidence */}
                        {item.category === 'STRONG_MATCH' && item.resumeEvidence?.[0] && (
                          <div className={styles.evidenceText}>
                            <strong>Resume Evidence:</strong> {item.resumeEvidence[0]}
                          </div>
                        )}

                        {/* Category B: Partial Match Rationale & Related Skill */}
                        {item.category === 'PARTIAL_MATCH' && (
                          <>
                            {item.matchedSkill && (
                              <div className={styles.evidenceText}>
                                <strong>Related Resume Skill:</strong> {item.matchedSkill}
                              </div>
                            )}
                            <p className={styles.explanationText}>
                              {item.explanation || 'Demonstrates transferable background with partial coverage.'}
                            </p>
                          </>
                        )}

                        {/* Category C: Missing Skill Details */}
                        {item.category === 'MISSING' && (
                          <p className={styles.explanationText}>
                            {item.explanation ||
                              (isRequired
                                ? 'Mandatory skill not evidenced in candidate resume.'
                                : 'Optional / preferred technology not found in resume.')}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className={styles.emptyCategory}>{cat.emptyText}</div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

SkillCategorySection.propTypes = {
  results: PropTypes.arrayOf(
    PropTypes.shape({
      jobSkill: PropTypes.string,
      requirementType: PropTypes.string,
      category: PropTypes.string,
      priority: PropTypes.string,
      resumeEvidence: PropTypes.array,
      explanation: PropTypes.string,
      matchedSkill: PropTypes.string,
    })
  ),
}

