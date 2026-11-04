import React from 'react'
import PropTypes from 'prop-types'
import styles from './MatchPercentageBreakdown.module.css'

function getMetricColor(score, isAvailable) {
  if (!isAvailable) return '#94A3B8'
  if (score >= 80) return 'var(--color-emerald)'
  if (score >= 60) return 'var(--color-indigo)'
  if (score >= 40) return 'var(--color-amber)'
  return 'var(--color-red)'
}

/**
 * SkillLens AI — Match Percentage Breakdown
 * Provides transparent, documented percentage comparisons for all supported dimensions,
 * showing exact numerators and denominators and distinguishing unavailable data.
 */
export default function MatchPercentageBreakdown({ scoreData, matchData }) {
  const summary = matchData?.summary || {}
  const scores = scoreData?.scores || {}
  const overall = scoreData?.overall || {}

  // 1. Overall Match
  const overallScore = overall.score !== null && overall.score !== undefined ? Math.round(Number(overall.score)) : null
  const overallAvailable = overallScore !== null && overall.status !== 'NOT_APPLICABLE'

  // 2. Skills Match
  const skillsScore = scores.skills?.score !== null && scores.skills?.score !== undefined ? Math.round(Number(scores.skills.score)) : null
  const skillsAvailable = skillsScore !== null && scores.skills?.status !== 'NOT_APPLICABLE'
  const totalSkills = summary.totalJobSkills || 0
  const satisfiedSkills = (summary.strongMatches || 0) + (summary.partialMatches || 0)

  // 3. Required Skills Match
  const reqTotal = summary.requiredSkills || 0
  const reqStrong = summary.requiredMatches?.strong || 0
  const reqPartial = summary.requiredMatches?.partial || 0
  const reqAvailable = reqTotal > 0
  const reqPct = reqAvailable ? Math.round(((reqStrong + reqPartial * 0.5) / reqTotal) * 100) : null

  // 4. Preferred Skills Match
  const prefTotal = summary.preferredSkills || 0
  const prefStrong = summary.preferredMatches?.strong || 0
  const prefPartial = summary.preferredMatches?.partial || 0
  const prefAvailable = prefTotal > 0
  const prefPct = prefAvailable ? Math.round(((prefStrong + prefPartial * 0.5) / prefTotal) * 100) : null

  // 5. Experience Match
  const expScore = scores.experience?.score !== null && scores.experience?.score !== undefined ? Math.round(Number(scores.experience.score)) : null
  const expAvailable = expScore !== null && scores.experience?.status !== 'NOT_APPLICABLE'
  const expDetails = scores.experience?.details

  // 6. Education Match
  const eduScore = scores.education?.score !== null && scores.education?.score !== undefined ? Math.round(Number(scores.education.score)) : null
  const eduAvailable = eduScore !== null && scores.education?.status !== 'NOT_APPLICABLE'
  const eduDetails = scores.education?.details

  const metrics = [
    {
      title: 'Overall Job Match',
      score: overallScore,
      isAvailable: overallAvailable,
      ratio: overallAvailable ? `${overallScore}% compatibility` : 'Score unavailable',
      explanation: overall.explanation || 'Weighted combination of applicable categories.',
      barColor: getMetricColor(overallScore, overallAvailable),
    },
    {
      title: 'All Skills Match',
      score: skillsScore,
      isAvailable: skillsAvailable,
      ratio: totalSkills > 0 ? `${satisfiedSkills} of ${totalSkills} skills satisfied` : 'No skills extracted',
      explanation: `${summary.strongMatches || 0} strong (1.0x) + ${summary.partialMatches || 0} partial (0.5x) / ${totalSkills} total.`,
      barColor: getMetricColor(skillsScore, skillsAvailable),
    },
    {
      title: 'Required Skills Match',
      score: reqPct,
      isAvailable: reqAvailable,
      ratio: reqAvailable
        ? `${reqStrong + reqPartial} of ${reqTotal} required satisfied`
        : 'No required skills specified',
      explanation: reqAvailable
        ? `${reqStrong} exact matches, ${reqPartial} partial coverage, ${summary.requiredMatches?.missing || 0} missing.`
        : 'The job posting does not mark skills as mandatory.',
      barColor: getMetricColor(reqPct, reqAvailable),
    },
    {
      title: 'Preferred Skills Match',
      score: prefPct,
      isAvailable: prefAvailable,
      ratio: prefAvailable
        ? `${prefStrong + prefPartial} of ${prefTotal} preferred satisfied`
        : 'No preferred skills specified',
      explanation: prefAvailable
        ? `${prefStrong} exact matches, ${prefPartial} partial coverage, ${summary.preferredMatches?.missing || 0} missing.`
        : 'No optional or preferred skills listed.',
      barColor: getMetricColor(prefPct, prefAvailable),
    },
    {
      title: 'Experience Match',
      score: expScore,
      isAvailable: expAvailable,
      ratio: expAvailable && expDetails?.candidateYears !== undefined
        ? `${expDetails.candidateYears} yrs candidate / ${expDetails.requiredYears ?? 'unspecified'} yrs required`
        : expAvailable ? `${expScore}% match` : 'Not applicable to this role',
      explanation: scores.experience?.explanation || 'Evaluated against stated experience requirements.',
      barColor: getMetricColor(expScore, expAvailable),
    },
    {
      title: 'Education Match',
      score: eduScore,
      isAvailable: eduAvailable,
      ratio: eduAvailable && eduDetails?.candidateDegree
        ? `${eduDetails.candidateDegree} degree`
        : eduAvailable ? `${eduScore}% match` : 'Not applicable to this role',
      explanation: scores.education?.explanation || 'Evaluated against stated education and field of study.',
      barColor: getMetricColor(eduScore, eduAvailable),
    },
  ]

  return (
    <section className={styles.container} aria-labelledby="percentage-breakdown-heading">
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 id="percentage-breakdown-heading">Match Percentage Breakdown</h3>
          <p className={styles.subtitle}>Verified metrics across skill requirements, experience, and education</p>
        </div>
        <span className={styles.formulaNote}>Backend Grounded Scoring</span>
      </header>

      <div className={styles.grid}>
        {metrics.map((m) => {
          const displayScore = m.isAvailable ? `${m.score}%` : 'N/A'
          return (
            <article key={m.title} className={styles.card}>
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>{m.title}</h4>
                <span
                  className={m.isAvailable ? styles.scoreBadge : styles.scoreUnavailable}
                  style={m.isAvailable ? { color: m.barColor } : {}}
                >
                  {displayScore}
                </span>
              </div>

              <div
                className={styles.track}
                role="progressbar"
                aria-valuenow={m.isAvailable ? m.score : undefined}
                aria-valuemin={m.isAvailable ? 0 : undefined}
                aria-valuemax={m.isAvailable ? 100 : undefined}
                aria-label={`${m.title}: ${displayScore}`}
              >
                <div
                  className={styles.bar}
                  style={{
                    width: `${m.isAvailable ? m.score : 0}%`,
                    background: m.barColor,
                  }}
                />
              </div>

              <div className={styles.ratio}>{m.ratio}</div>
              <p className={styles.explanation}>{m.explanation}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

MatchPercentageBreakdown.propTypes = {
  scoreData: PropTypes.object,
  matchData: PropTypes.object,
}

