import React from 'react'
import PropTypes from 'prop-types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import styles from './SkillMatchBarChart.module.css'

const COLORS = {
  strong: '#10B981',
  partial: '#F59E0B',
  missing: '#EF4444',
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const totalInGroup = payload.reduce((acc, curr) => acc + (curr.value || 0), 0)
    return (
      <div className={styles.tooltipCard} role="status">
        <div className={styles.tooltipHeader}>
          {label} ({totalInGroup} total)
        </div>
        {payload.map((item) => (
          <div key={item.name} className={styles.tooltipRow}>
            <span>
              <span className={styles.tooltipDot} style={{ background: item.color }} />
              {item.name}
            </span>
            <strong>
              {item.value} ({totalInGroup > 0 ? Math.round((item.value / totalInGroup) * 100) : 0}%)
            </strong>
          </div>
        ))}
      </div>
    )
  }
  return null
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
}

/**
 * SkillLens AI — Skill Match Bar Chart
 * Visualizes Required vs Preferred skill coverage comparison.
 */
export default function SkillMatchBarChart({ summary, results = [] }) {
  // Support both summary matches and dynamic calculation from results
  const reqMatches = summary?.requiredMatches || {
    strong: results.filter((r) => r.requirementType === 'REQUIRED' && r.category === 'STRONG_MATCH').length,
    partial: results.filter((r) => r.requirementType === 'REQUIRED' && r.category === 'PARTIAL_MATCH').length,
    missing: results.filter((r) => r.requirementType === 'REQUIRED' && r.category === 'MISSING').length,
  }

  const prefMatches = summary?.preferredMatches || {
    strong: results.filter((r) => r.requirementType === 'PREFERRED' && r.category === 'STRONG_MATCH').length,
    partial: results.filter((r) => r.requirementType === 'PREFERRED' && r.category === 'PARTIAL_MATCH').length,
    missing: results.filter((r) => r.requirementType === 'PREFERRED' && r.category === 'MISSING').length,
  }

  const unspecMatches = summary?.unspecifiedMatches || {
    strong: results.filter((r) => r.requirementType === 'UNSPECIFIED' && r.category === 'STRONG_MATCH').length,
    partial: results.filter((r) => r.requirementType === 'UNSPECIFIED' && r.category === 'PARTIAL_MATCH').length,
    missing: results.filter((r) => r.requirementType === 'UNSPECIFIED' && r.category === 'MISSING').length,
  }

  const totalReq = (reqMatches.strong || 0) + (reqMatches.partial || 0) + (reqMatches.missing || 0)
  const totalPref = (prefMatches.strong || 0) + (prefMatches.partial || 0) + (prefMatches.missing || 0)
  const totalUnspec = (unspecMatches.strong || 0) + (unspecMatches.partial || 0) + (unspecMatches.missing || 0)

  const chartData = []
  if (totalReq > 0) {
    chartData.push({
      group: 'Required Skills',
      'Strong Match': reqMatches.strong || 0,
      'Partial Match': reqMatches.partial || 0,
      'Missing Skill': reqMatches.missing || 0,
    })
  }
  if (totalPref > 0) {
    chartData.push({
      group: 'Preferred Skills',
      'Strong Match': prefMatches.strong || 0,
      'Partial Match': prefMatches.partial || 0,
      'Missing Skill': prefMatches.missing || 0,
    })
  }
  if (totalUnspec > 0) {
    chartData.push({
      group: 'Other Requirements',
      'Strong Match': unspecMatches.strong || 0,
      'Partial Match': unspecMatches.partial || 0,
      'Missing Skill': unspecMatches.missing || 0,
    })
  }

  if (chartData.length === 0) {
    return (
      <article className={styles.container}>
        <header className={styles.header}>
          <h3 className={styles.title}>Required vs. Preferred Skills</h3>
          <p className={styles.subtitle}>Comparison of requirement priority groups</p>
        </header>
        <div className={styles.emptyState}>
          <BarChart3 size={32} aria-hidden="true" />
          <p>No requirement priorities available to compare.</p>
        </div>
      </article>
    )
  }

  return (
    <article className={styles.container} aria-label="Required versus preferred skill matches chart">
      <header className={styles.header}>
        <h3 className={styles.title}>Required vs. Preferred Skills</h3>
        <p className={styles.subtitle}>Match breakdown segregated by job expectation level</p>
      </header>

      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={chartData}
            margin={{ top: 12, right: 16, left: -20, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="group" tick={{ fill: '#64748B', fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            <Bar dataKey="Strong Match" fill={COLORS.strong} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Partial Match" fill={COLORS.partial} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Missing Skill" fill={COLORS.missing} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

SkillMatchBarChart.propTypes = {
  summary: PropTypes.shape({
    requiredMatches: PropTypes.object,
    preferredMatches: PropTypes.object,
    unspecifiedMatches: PropTypes.object,
  }),
  results: PropTypes.arrayOf(
    PropTypes.shape({
      requirementType: PropTypes.string,
      category: PropTypes.string,
    })
  ),
}

