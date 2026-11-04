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
import { Layers } from 'lucide-react'
import styles from './SkillDomainBarChart.module.css'

const COLORS = {
  strong: '#10B981',
  partial: '#F59E0B',
  missing: '#EF4444',
}

const CATEGORY_NAMES = {
  PROGRAMMING: 'Languages',
  FRAMEWORK: 'Frameworks',
  DATABASE: 'Databases',
  CLOUD_DEVOPS: 'Cloud & DevOps',
  CLOUD: 'Cloud & DevOps',
  TESTING: 'Testing & QA',
  METHODOLOGY: 'Methodology',
  SOFT_SKILLS: 'Soft Skills',
  OTHER: 'General Tech',
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const totalInGroup = payload.reduce((acc, curr) => acc + (curr.value || 0), 0)
    return (
      <div className={styles.tooltipCard} role="status">
        <div className={styles.tooltipHeader}>
          {label} ({totalInGroup} skills)
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
 * SkillLens AI — Skill Domain Horizontal Bar Chart
 * Compares skill alignment across technical domains (Languages, Frameworks, Databases, Cloud, etc.)
 */
export default function SkillDomainBarChart({ summary, results = [] }) {
  // Build category grouping
  const domainMap = new Map()

  // 1. If backend provides summary.categoryBreakdown, use it
  if (summary?.categoryBreakdown) {
    for (const [catKey, counts] of Object.entries(summary.categoryBreakdown)) {
      if ((counts.total || 0) > 0) {
        domainMap.set(catKey, {
          domain: CATEGORY_NAMES[catKey] || catKey,
          'Strong Match': counts.strong || 0,
          'Partial Match': counts.partial || 0,
          'Missing Skill': counts.missing || 0,
          total: counts.total || 0,
        })
      }
    }
  }

  // 2. If domainMap is still empty, derive from results
  if (domainMap.size === 0 && results.length > 0) {
    for (const r of results) {
      const rawCat = r.skillCategory || 'OTHER'
      if (!domainMap.has(rawCat)) {
        domainMap.set(rawCat, {
          domain: CATEGORY_NAMES[rawCat] || rawCat,
          'Strong Match': 0,
          'Partial Match': 0,
          'Missing Skill': 0,
          total: 0,
        })
      }
      const item = domainMap.get(rawCat)
      item.total += 1
      if (r.category === 'STRONG_MATCH') item['Strong Match'] += 1
      else if (r.category === 'PARTIAL_MATCH') item['Partial Match'] += 1
      else item['Missing Skill'] += 1
    }
  }

  const chartData = Array.from(domainMap.values()).sort((a, b) => b.total - a.total)

  if (chartData.length === 0) {
    return (
      <article className={styles.container}>
        <header className={styles.header}>
          <h3 className={styles.title}>Skill Category Comparison</h3>
          <p className={styles.subtitle}>Domain-specific match performance</p>
        </header>
        <div className={styles.emptyState}>
          <Layers size={32} aria-hidden="true" />
          <p>No skill domain classifications available to compare.</p>
        </div>
      </article>
    )
  }

  const chartHeight = Math.max(220, chartData.length * 48)

  return (
    <article className={styles.container} aria-label="Skill category horizontal comparison chart">
      <header className={styles.header}>
        <h3 className={styles.title}>Skill Category Comparison</h3>
        <p className={styles.subtitle}>Candidate alignment across technical domains</p>
      </header>

      <div className={styles.chartArea} style={{ height: `${chartHeight}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 8, right: 16, left: 24, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="domain"
              width={100}
              tick={{ fill: '#0F172A', fontSize: 12, fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            <Bar dataKey="Strong Match" fill={COLORS.strong} stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Partial Match" fill={COLORS.partial} stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Missing Skill" fill={COLORS.missing} stackId="a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

SkillDomainBarChart.propTypes = {
  summary: PropTypes.shape({
    categoryBreakdown: PropTypes.object,
  }),
  results: PropTypes.arrayOf(
    PropTypes.shape({
      skillCategory: PropTypes.string,
      category: PropTypes.string,
    })
  ),
}

