import React from 'react'
import PropTypes from 'prop-types'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PieChart as ChartIcon } from 'lucide-react'
import styles from './SkillDistributionChart.module.css'

const COLORS = {
  strong: '#10B981',
  partial: '#F59E0B',
  missing: '#EF4444',
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className={styles.tooltipCard} role="status">
        <div className={styles.tooltipLabel}>{data.name}</div>
        <div className={styles.tooltipValue}>
          {data.value} {data.value === 1 ? 'skill' : 'skills'} ({data.percentage}%)
        </div>
      </div>
    )
  }
  return null
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
}

/**
 * SkillLens AI — Skill Distribution Doughnut Chart
 * Visualizes Strong Matches, Partial Matches, and Missing Skills using Recharts.
 */
export default function SkillDistributionChart({ summary, results = [] }) {
  // Derive counts from summary or results
  const strong = summary?.strongMatches ?? results.filter((r) => r.category === 'STRONG_MATCH').length
  const partial = summary?.partialMatches ?? results.filter((r) => r.category === 'PARTIAL_MATCH').length
  const missing = summary?.missingSkills ?? results.filter((r) => r.category === 'MISSING').length
  const total = summary?.totalJobSkills ?? (strong + partial + missing)

  if (!total || total === 0) {
    return (
      <article className={styles.container}>
        <header className={styles.header}>
          <h3 className={styles.title}>Skill Distribution</h3>
          <p className={styles.subtitle}>Breakdown of evaluated skill coverage</p>
        </header>
        <div className={styles.emptyState}>
          <ChartIcon size={32} aria-hidden="true" />
          <p>No skill requirements to visualize.</p>
        </div>
      </article>
    )
  }

  const strongPct = Math.round((strong / total) * 100)
  const partialPct = Math.round((partial / total) * 100)
  const missingPct = Math.max(0, 100 - strongPct - partialPct)

  const chartData = [
    { name: 'Strong Match', value: strong, percentage: strongPct, color: COLORS.strong },
    { name: 'Partial Match', value: partial, percentage: partialPct, color: COLORS.partial },
    { name: 'Missing Skill', value: missing, percentage: missingPct, color: COLORS.missing },
  ].filter((item) => item.value > 0)

  const satisfiedCount = strong + partial
  const satisfiedPct = Math.round(((strong + partial * 0.5) / total) * 100)

  return (
    <article className={styles.container} aria-label="Skill match distribution chart">
      <header className={styles.header}>
        <h3 className={styles.title}>Skill Distribution</h3>
        <p className={styles.subtitle}>Coverage breakdown across {total} technical {total === 1 ? 'requirement' : 'requirements'}</p>
      </header>

      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={chartData.length > 1 ? 4 : 0}
              dataKey="value"
              nameKey="name"
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className={styles.centerStats} aria-hidden="true">
          <span className={styles.centerValue}>{satisfiedCount}/{total}</span>
          <span className={styles.centerLabel}>Satisfied ({satisfiedPct}%)</span>
        </div>
      </div>

      <div className={styles.legendGrid}>
        <div className={styles.legendItem}>
          <span className={styles.legendLabel}>
            <span className={styles.legendDot} style={{ background: COLORS.strong }} />
            Strong
          </span>
          <strong className={styles.legendCount}>{strong}</strong>
          <span className={styles.legendPercent}>{strongPct}%</span>
        </div>

        <div className={styles.legendItem}>
          <span className={styles.legendLabel}>
            <span className={styles.legendDot} style={{ background: COLORS.partial }} />
            Partial
          </span>
          <strong className={styles.legendCount}>{partial}</strong>
          <span className={styles.legendPercent}>{partialPct}%</span>
        </div>

        <div className={styles.legendItem}>
          <span className={styles.legendLabel}>
            <span className={styles.legendDot} style={{ background: COLORS.missing }} />
            Missing
          </span>
          <strong className={styles.legendCount}>{missing}</strong>
          <span className={styles.legendPercent}>{missingPct}%</span>
        </div>
      </div>
    </article>
  )
}

SkillDistributionChart.propTypes = {
  summary: PropTypes.shape({
    totalJobSkills: PropTypes.number,
    strongMatches: PropTypes.number,
    partialMatches: PropTypes.number,
    missingSkills: PropTypes.number,
  }),
  results: PropTypes.arrayOf(
    PropTypes.shape({
      category: PropTypes.string,
    })
  ),
}

