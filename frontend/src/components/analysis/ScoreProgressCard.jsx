import React from 'react'
import PropTypes from 'prop-types'
import styles from './ScoreProgressCard.module.css'

const RADIUS = 30
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function getScoreColor(numericScore, isApplicable) {
  if (!isApplicable) return 'var(--color-text-muted)'
  if (numericScore >= 80) return 'var(--color-emerald)'
  if (numericScore >= 60) return 'var(--color-indigo)'
  if (numericScore >= 40) return 'var(--color-amber)'
  return 'var(--color-red)'
}

/**
 * SkillLens AI — Score Progress Card
 * Renders circular or linear progress indicators with clear distinction between
 * genuine 0% scores and unavailable/not-applicable metrics.
 */
export default function ScoreProgressCard({
  title,
  score,
  status = 'AVAILABLE',
  weight = null,
  normalizedWeight = null,
  explanation = '',
  details = null,
  icon: Icon = null,
  type = 'circle',
}) {
  const isAvailable = score !== null && score !== undefined && status !== 'NOT_APPLICABLE' && status !== 'INSUFFICIENT_DATA'
  const isNotApplicable = status === 'NOT_APPLICABLE'
  const isZero = isAvailable && Number(score) === 0
  const numericScore = isAvailable ? Math.max(0, Math.min(100, Math.round(Number(score)))) : 0

  const strokeColor = getScoreColor(numericScore, isAvailable)
  const strokeOffset = CIRCUMFERENCE - (numericScore / 100) * CIRCUMFERENCE

  // Status badge label and style
  let statusText = 'Score Available'
  let statusClass = styles.statusAvailable

  if (isNotApplicable) {
    statusText = 'Not Applicable'
    statusClass = styles.statusNotApplicable
  } else if (!isAvailable) {
    statusText = 'Score Unavailable'
    statusClass = styles.statusUnavailable
  } else if (isZero) {
    statusText = '0% Match'
    statusClass = styles.statusZero
  }

  // Weight text
  const weightText = normalizedWeight !== null && normalizedWeight !== undefined
    ? `Weight: ${Math.round(normalizedWeight * 100)}%`
    : weight !== null && weight !== undefined
      ? `Weight: ${Math.round(weight * 100)}%`
      : null

  const displayText = isAvailable ? `${numericScore}%` : isNotApplicable ? 'N/A' : '—'
  const ariaLabel = `${title}: ${isAvailable ? `${numericScore} percent` : isNotApplicable ? 'Not applicable to this role' : 'Score unavailable'}`

  return (
    <article className={styles.card} aria-label={ariaLabel}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          {Icon && (
            <div className={styles.iconWrap} aria-hidden="true">
              <Icon size={18} />
            </div>
          )}
          <h3 className={styles.titleText}>{title}</h3>
        </div>
        {weightText && <span className={styles.weightBadge}>{weightText}</span>}
      </header>

      {type === 'circle' ? (
        <div className={styles.body}>
          <div
            className={styles.ringWrap}
            role="progressbar"
            aria-valuenow={isAvailable ? numericScore : undefined}
            aria-valuemin={isAvailable ? 0 : undefined}
            aria-valuemax={isAvailable ? 100 : undefined}
            aria-label={ariaLabel}
          >
            <svg className={styles.ringSvg} viewBox="0 0 76 76" aria-hidden="true">
              <circle
                className={styles.ringBg}
                cx="38"
                cy="38"
                r={RADIUS}
                fill="none"
                strokeWidth="7"
              />
              <circle
                className={styles.ringProgress}
                cx="38"
                cy="38"
                r={RADIUS}
                fill="none"
                stroke={strokeColor}
                strokeWidth="7"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={isAvailable ? strokeOffset : CIRCUMFERENCE}
                strokeLinecap="round"
              />
            </svg>
            <div className={styles.ringCenter}>
              <span className={isAvailable ? styles.scoreValue : styles.scoreValueMuted}>
                {displayText}
              </span>
            </div>
          </div>

          <div className={styles.detailsArea}>
            <span className={`${styles.statusPill} ${statusClass}`}>{statusText}</span>
            <p className={styles.explanation}>{explanation || 'Evaluation completed based on available data.'}</p>
            {details && <span className={styles.detailNote}>{typeof details === 'string' ? details : JSON.stringify(details)}</span>}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span className={`${styles.statusPill} ${statusClass}`}>{statusText}</span>
            <strong className={styles.scoreValue} style={{ color: strokeColor }}>{displayText}</strong>
          </div>
          <div
            className={styles.linearWrap}
            role="progressbar"
            aria-valuenow={isAvailable ? numericScore : undefined}
            aria-valuemin={isAvailable ? 0 : undefined}
            aria-valuemax={isAvailable ? 100 : undefined}
            aria-label={ariaLabel}
          >
            <div className={styles.linearTrack}>
              <div
                className={styles.linearBar}
                style={{
                  width: `${isAvailable ? numericScore : 0}%`,
                  background: strokeColor,
                }}
              />
            </div>
          </div>
          <p className={styles.explanation}>{explanation || 'Evaluation completed based on available data.'}</p>
          {details && <span className={styles.detailNote}>{typeof details === 'string' ? details : JSON.stringify(details)}</span>}
        </div>
      )}
    </article>
  )
}

ScoreProgressCard.propTypes = {
  title: PropTypes.string.isRequired,
  score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  status: PropTypes.string,
  weight: PropTypes.number,
  normalizedWeight: PropTypes.number,
  explanation: PropTypes.string,
  details: PropTypes.oneOfType([PropTypes.string, PropTypes.node, PropTypes.object]),
  icon: PropTypes.elementType,
  type: PropTypes.oneOf(['circle', 'horizontal']),
}

