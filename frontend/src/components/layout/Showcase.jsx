import { useState } from 'react'
import {
  Zap, Download, Trash2, Send, Plus, Search,
  CheckCircle, AlertCircle, Info, Eye,
} from 'lucide-react'
import Button from '../common/Button'
import Card from '../common/Card'
import Input from '../common/Input'
import Textarea from '../common/Textarea'
import Select from '../common/Select'
import Modal from '../common/Modal'
import Spinner, { PageLoader } from '../common/Spinner'
import styles from './Showcase.module.css'

const SKILL_OPTIONS = [
  { value: 'react',      label: 'React' },
  { value: 'nodejs',     label: 'Node.js' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python',     label: 'Python' },
  { value: 'docker',     label: 'Docker' },
]

const PALETTE = [
  { name: 'Navy',      var: '--color-navy',      hex: '#0F172A' },
  { name: 'Indigo',    var: '--color-indigo',     hex: '#6366F1' },
  { name: 'Cyan',      var: '--color-cyan',       hex: '#06B6D4' },
  { name: 'Emerald',   var: '--color-emerald',    hex: '#10B981' },
  { name: 'Amber',     var: '--color-amber',      hex: '#F59E0B' },
  { name: 'Red',       var: '--color-red',        hex: '#EF4444' },
  { name: 'Surface',   var: '--color-surface',    hex: '#FFFFFF' },
  { name: 'Background',var: '--color-bg',         hex: '#F8FAFC' },
]

function Section({ title, subtitle, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

function Badge({ color, label }) {
  return (
    <div className={styles.badge} style={{ background: color }}>
      <span className={styles.badgeSwatch} />
      <span className={styles.badgeName}>{label}</span>
      <code className={styles.badgeHex}>{color}</code>
    </div>
  )
}

function UIShowcase() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [selectedSkill, setSelectedSkill] = useState('')
  const [textareaValue, setTextareaValue] = useState('')

  const simulateLoad = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <div className={styles.showcase}>
      {/* ── Page heading ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderBadge}>
          <Zap size={14} />
          UI Component Library
        </div>
        <h1 className={styles.pageTitle}>SkillLens AI Design System</h1>
        <p className={styles.pageSubtitle}>
          All reusable components and design tokens used across the application.
          This showcase page is for development verification only.
        </p>
      </div>

      {/* ── 1. Color palette ── */}
      <Section title="Color Palette" subtitle="SkillLens AI brand colors and semantic tokens.">
        <div className={styles.palette}>
          {PALETTE.map(({ name, hex }) => (
            <div key={name} className={styles.colorCard}>
              <div
                className={styles.colorSwatch}
                style={{ background: hex, border: hex === '#FFFFFF' || hex === '#F8FAFC' ? '1px solid #E2E8F0' : 'none' }}
              />
              <div className={styles.colorMeta}>
                <span className={styles.colorName}>{name}</span>
                <code className={styles.colorHex}>{hex}</code>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2. Typography ── */}
      <Section title="Typography" subtitle="Inter font scale used throughout the application.">
        <div className={styles.typeGrid}>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>H1 / Page Title</span>
            <h1 className={styles.typeSample} style={{ fontSize: 'var(--text-4xl)', letterSpacing: '-0.03em', fontWeight: 800 }}>
              Know How Ready You Are
            </h1>
          </div>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>H2 / Section</span>
            <h2 className={styles.typeSample} style={{ fontSize: 'var(--text-3xl)' }}>
              Skill Match Overview
            </h2>
          </div>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>H3 / Card Title</span>
            <h3 className={styles.typeSample} style={{ fontSize: 'var(--text-2xl)' }}>
              Missing Skills
            </h3>
          </div>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>Body / Regular</span>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.625 }}>
              Upload your resume, compare it with a target job, discover your skill gaps, and get a personalized roadmap to improve your career readiness.
            </p>
          </div>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>Small / Metadata</span>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Analyzed: Oct 05, 2026 · PDF · 2.4 MB
            </p>
          </div>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>Label / Form</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Job Description
            </span>
          </div>
        </div>
      </Section>

      {/* ── 3. Buttons ── */}
      <Section title="Buttons" subtitle="All variants, sizes, and states.">
        <div className={styles.buttonGrid}>
          <div className={styles.buttonRow}>
            <span className={styles.rowLabel}>Variants</span>
            <div className={styles.rowItems}>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </div>

          <div className={styles.buttonRow}>
            <span className={styles.rowLabel}>Sizes</span>
            <div className={styles.rowItems}>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          <div className={styles.buttonRow}>
            <span className={styles.rowLabel}>With Icons</span>
            <div className={styles.rowItems}>
              <Button variant="primary" icon={Download}>Download</Button>
              <Button variant="outline" icon={Plus}>New Analysis</Button>
              <Button variant="ghost" icon={Search} iconPosition="right">Search</Button>
              <Button variant="danger" icon={Trash2}>Delete</Button>
            </div>
          </div>

          <div className={styles.buttonRow}>
            <span className={styles.rowLabel}>States</span>
            <div className={styles.rowItems}>
              <Button disabled>Disabled</Button>
              <Button loading onClick={simulateLoad}>Loading</Button>
              <Button
                variant="primary"
                icon={Send}
                loading={loading}
                onClick={simulateLoad}
              >
                {loading ? 'Analyzing…' : 'Analyze Resume'}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 4. Cards ── */}
      <Section title="Cards" subtitle="Flexible card component with sub-components and variants.">
        <div className={styles.cardGrid}>
          {/* Default */}
          <Card variant="default" padding="md">
            <Card.Header>
              <Card.Title>Resume Analysis</Card.Title>
              <Button variant="ghost" size="sm" icon={Eye}>View</Button>
            </Card.Header>
            <Card.Body>
              <Card.Description>
                Your resume scored 82% against the Frontend Developer role at Acme Corp. Strong match in React and JavaScript skills.
              </Card.Description>
            </Card.Body>
            <Card.Footer>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Oct 05, 2026</span>
              <Button variant="primary" size="sm">View Report</Button>
            </Card.Footer>
          </Card>

          {/* Elevated */}
          <Card variant="elevated" padding="md">
            <Card.Header>
              <div>
                <Card.Title>Match Score</Card.Title>
                <Card.Description>Frontend Developer · Acme Corp</Card.Description>
              </div>
            </Card.Header>
            <Card.Body>
              <div className={styles.scoreDemo}>
                <div className={styles.scoreBig}>82%</div>
                <span className={styles.scoreLabel}>Strong Match</span>
              </div>
            </Card.Body>
          </Card>

          {/* Flat / stat */}
          <Card variant="flat" padding="md">
            <Card.Body>
              <div className={styles.statGrid}>
                {[
                  { label: 'Matched Skills', value: '12', color: 'var(--color-emerald)' },
                  { label: 'Partial Match',  value: '5',  color: 'var(--color-amber)'   },
                  { label: 'Missing Skills', value: '3',  color: 'var(--color-red)'     },
                ].map(({ label, value, color }) => (
                  <div key={label} className={styles.statItem}>
                    <span className={styles.statValue} style={{ color }}>{value}</span>
                    <span className={styles.statLabel}>{label}</span>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>

          {/* Hover card */}
          <Card variant="outline" padding="md" hover>
            <Card.Body>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <CheckCircle size={24} color="var(--color-emerald)" />
                <Card.Title>Skill: React</Card.Title>
                <Card.Description>Matched · 3 years experience · Listed in job requirements.</Card.Description>
              </div>
            </Card.Body>
          </Card>
        </div>
      </Section>

      {/* ── 5. Form Inputs ── */}
      <Section title="Form Inputs" subtitle="Accessible form components with labels, helper text, and error states.">
        <div className={styles.formGrid}>
          <Input
            label="Full Name"
            placeholder="e.g. Shavisha Thiloshini"
            helperText="Enter your full name as it appears on your resume."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            required
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            required
          />

          <Input
            label="Job Title"
            placeholder="e.g. Frontend Developer"
            errorText="Job title is required to start the analysis."
          />

          <Input
            label="Disabled Field"
            placeholder="This field is disabled"
            disabled
            value="Not editable"
          />

          <Select
            label="Primary Skill"
            options={SKILL_OPTIONS}
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
            helperText="Select the skill most relevant to your target role."
          />

          <Select
            label="Experience Level (Error)"
            options={[
              { value: 'junior', label: 'Junior (0–2 years)' },
              { value: 'mid',    label: 'Mid (2–5 years)'    },
              { value: 'senior', label: 'Senior (5+ years)'  },
            ]}
            errorText="Please select your experience level."
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Job Description"
              placeholder="Paste the full job description here…"
              helperText="Include the complete job posting for the most accurate analysis."
              rows={5}
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
            />
          </div>
        </div>
      </Section>

      {/* ── 6. Modal ── */}
      <Section title="Modal" subtitle="Accessible dialog with Escape key, backdrop close, and configurable sizes.">
        <div className={styles.rowItems} style={{ flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Info Modal
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
            Open Confirm Modal
          </Button>
        </div>

        {/* Info modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="How Analysis Works"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Maybe Later
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Got It
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className={styles.modalStep}>
              <span className={styles.stepNum}>1</span>
              <div>
                <strong>Upload Resume</strong>
                <p>Upload your resume in PDF or DOCX format.</p>
              </div>
            </div>
            <div className={styles.modalStep}>
              <span className={styles.stepNum}>2</span>
              <div>
                <strong>Add Job Description</strong>
                <p>Paste the job posting you are targeting.</p>
              </div>
            </div>
            <div className={styles.modalStep}>
              <span className={styles.stepNum}>3</span>
              <div>
                <strong>Get Your Roadmap</strong>
                <p>Receive a personalized skill gap report and learning recommendations.</p>
              </div>
            </div>
          </div>
        </Modal>

        {/* Confirm modal */}
        <Modal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Delete Analysis"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setConfirmOpen(false)}>
                Delete
              </Button>
            </>
          }
        >
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.625 }}>
            Are you sure you want to delete this analysis? This action cannot be undone.
          </p>
        </Modal>
      </Section>

      {/* ── 7. Loading / Spinners ── */}
      <Section title="Loading Components" subtitle="Spinner variants and sizes with accessible aria attributes.">
        <div className={styles.spinnerGrid}>
          {['sm','md','lg','xl'].map((size) => (
            <div key={size} className={styles.spinnerItem}>
              <Spinner size={size} />
              <code className={styles.spinnerLabel}>size="{size}"</code>
            </div>
          ))}
        </div>

        <div className={styles.spinnerColors}>
          <div className={styles.spinnerItem}>
            <Spinner size="md" color="primary" />
            <code className={styles.spinnerLabel}>primary</code>
          </div>
          <div className={styles.spinnerItem} style={{ background: 'var(--color-navy)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
            <Spinner size="md" color="white" />
            <code className={styles.spinnerLabel} style={{ color: 'rgba(255,255,255,0.6)' }}>white</code>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button
            variant="outline"
            loading={loading}
            onClick={simulateLoad}
          >
            {loading ? 'Processing…' : 'Simulate Loading (2s)'}
          </Button>
        </div>
      </Section>

      {/* ── 8. Status indicators ── */}
      <Section title="Status Indicators" subtitle="Semantic color usage for skill match states.">
        <div className={styles.statusGrid}>
          {[
            { icon: CheckCircle, color: 'var(--color-emerald)',  bg: 'var(--color-emerald-50)',  label: 'Matched Skill',  desc: 'React · 3 years'   },
            { icon: AlertCircle, color: 'var(--color-amber)',    bg: 'var(--color-amber-50)',    label: 'Partial Match',  desc: 'TypeScript · Basic' },
            { icon: AlertCircle, color: 'var(--color-red)',      bg: 'var(--color-red-50)',      label: 'Missing Skill',  desc: 'Docker · Required'  },
            { icon: Info,        color: 'var(--color-cyan)',     bg: 'var(--color-cyan-50)',     label: 'AI Insight',     desc: 'Suggested learning' },
          ].map(({ icon: Icon, color, bg, label, desc }) => (
            <div key={label} className={styles.statusItem} style={{ background: bg, borderColor: color }}>
              <Icon size={20} color={color} />
              <div>
                <span className={styles.statusLabel} style={{ color }}>{label}</span>
                <span className={styles.statusDesc}>{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

export default UIShowcase
