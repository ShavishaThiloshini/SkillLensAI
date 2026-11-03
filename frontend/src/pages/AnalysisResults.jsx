import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Briefcase, CheckCircle2, CircleAlert, Clock3, FileText, GraduationCap, Lightbulb, RefreshCw, Sparkles, Target, TrendingUp, XCircle } from 'lucide-react'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'
import { getResumes } from '../services/resumeService'
import { getJobDescriptions } from '../services/jobService'
import { calculateMatchScore, getSavedMatchScore, getSavedSkillMatching, runSkillMatching } from '../services/matchingService'
import styles from './AnalysisResults.module.css'

const CATEGORY = {
  STRONG_MATCH: { title: 'Matching Skills', empty: 'No strong skill matches were found in the saved analysis.', icon: CheckCircle2, tone: 'strong' },
  PARTIAL_MATCH: { title: 'Partial Skills', empty: 'No partial skill matches were found in the saved analysis.', icon: AlertTriangle, tone: 'partial' },
  MISSING: { title: 'Missing Skills', empty: 'No skill gaps were identified in the saved analysis.', icon: XCircle, tone: 'missing' },
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function scoreLabel(score, status) {
  if (score === null || score === undefined || status === 'NOT_APPLICABLE') return status === 'NOT_APPLICABLE' ? 'Not applicable' : 'Unavailable'
  return `${Math.round(Number(score))}%`
}

function AnalysisResults() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const resumeId = params.get('resumeId')
  const jobId = params.get('jobId')
  const [loading, setLoading] = useState(true)
  const [rerunning, setRerunning] = useState(false)
  const [error, setError] = useState('')
  const [scoreData, setScoreData] = useState(null)
  const [matchData, setMatchData] = useState(null)
  const [available, setAvailable] = useState({ resumes: [], jobs: [] })

  const loadResults = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [resumesResponse, jobsResponse] = await Promise.all([getResumes(), getJobDescriptions()])
      setAvailable({ resumes: resumesResponse.resumes || [], jobs: jobsResponse.jobs || [] })
      if (!resumeId || !jobId) return
      const [scoreResponse, matchResponse] = await Promise.all([
        getSavedMatchScore(resumeId, jobId).catch((err) => err.response?.status === 404 ? null : Promise.reject(err)),
        getSavedSkillMatching(resumeId, jobId).catch((err) => err.response?.status === 404 ? null : Promise.reject(err)),
      ])
      setScoreData(scoreResponse?.data || null)
      setMatchData(matchResponse?.data || null)
    } catch (err) {
      setError(err.message || 'We could not load the analysis results. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [jobId, resumeId])

  useEffect(() => { loadResults() }, [loadResults])

  const rerun = async () => {
    if (!resumeId || !jobId) return
    setRerunning(true); setError('')
    try {
      await runSkillMatching({ resumeId, jobDescriptionId: jobId })
      const scoreResponse = await calculateMatchScore({ resumeId, jobDescriptionId: jobId })
      const matchResponse = await getSavedSkillMatching(resumeId, jobId)
      setScoreData(scoreResponse.data)
      setMatchData(matchResponse.data)
    } catch (err) {
      setError(err.message || 'We could not re-run this analysis. Please try again.')
    } finally { setRerunning(false) }
  }

  const skills = matchData?.results || []
  const groups = useMemo(() => Object.fromEntries(Object.keys(CATEGORY).map((key) => [key, skills.filter((item) => item.category === key)])), [skills])
  const metadata = scoreData?.metadata || matchData?.matchingMetadata || {}
  const stale = metadata.algorithmVersion && matchData?.matchingMetadata?.algorithmVersion && metadata.algorithmVersion !== matchData.matchingMetadata.algorithmVersion

  if (loading) return <div className={styles.state}><Spinner size="lg" /><p>Loading your saved analysis results…</p></div>

  if (!resumeId || !jobId) return (
    <EmptyState icon={Target} title="Choose a resume and job description" message="Analysis Results needs both a selected resume and target job description." action={() => navigate('/matching')} actionLabel="Go to Skill Matching" />
  )
  if (error) return <EmptyState icon={CircleAlert} title="Results could not be loaded" message={error} action={loadResults} actionLabel="Try again" secondary={() => navigate('/matching')} />
  if (!scoreData && !matchData) return (
    <EmptyState icon={Sparkles} title="No saved analysis yet" message="Run an analysis for this resume and job description to view a consolidated result." action={rerun} actionLabel="Run analysis" secondary={() => navigate(`/matching?resumeId=${resumeId}&jobId=${jobId}`)} />
  )

  const score = scoreData?.overall?.score
  const analysis = scoreData?.aiAnalysis
  const warnings = scoreData?.metadata?.warnings || matchData?.matchingMetadata?.warnings || []
  const jobTitle = scoreData?.jobTitle || matchData?.jobTitle || available.jobs.find((job) => String(job.id) === String(jobId))?.title || 'Selected job'
  const resumeName = scoreData?.resumeFilename || matchData?.resumeFilename || available.resumes.find((resume) => String(resume.id) === String(resumeId))?.original_filename || 'Selected resume'

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Saved comparison</p><h1>Analysis Results</h1><p className={styles.subtitle}>{jobTitle} · {resumeName} · {formatDate(metadata.calculatedAt || metadata.matchedAt)}</p></div>
      <Button variant="outline" size="sm" onClick={rerun} disabled={rerunning}>{rerunning ? <Spinner size="sm" /> : <RefreshCw size={15} />} Re-run analysis</Button>
    </header>
    {(warnings.length > 0 || stale) && <div className={styles.warning} role="status"><AlertTriangle size={18} /><span>{stale ? 'Some saved results were generated with different analysis versions. Re-run the analysis to refresh them.' : warnings.join(' ')}</span></div>}

    <section className={styles.hero} aria-labelledby="overall-match">
      <div className={styles.scoreCircle} style={{ '--score': `${Math.max(0, Math.min(100, Number(score) || 0))}%` }}><div><span id="overall-match">Overall match</span><strong>{scoreLabel(score, scoreData?.overall?.status)}</strong></div></div>
      <div className={styles.heroContent}><span className={styles.statusPill}>{scoreData?.overall?.status === 'AVAILABLE' || score !== null && score !== undefined ? 'Score available' : 'Score unavailable'}</span><h2>{scoreData?.overall?.explanation || 'An overall score could not be calculated from the available data.'}</h2><p>Calculated from the applicable backend scoring categories. A 0% score is shown as 0%, not as unavailable.</p></div>
    </section>

    <section aria-labelledby="breakdown"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Score details</p><h2 id="breakdown">Score breakdown</h2></div></div><div className={styles.breakdownGrid}>{Object.entries(scoreData?.scores || {}).map(([key, item]) => <ScoreCard key={key} name={key} item={item} />)}</div></section>

    <section aria-labelledby="skills"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Evidence comparison</p><h2 id="skills">Skill matching overview</h2></div><div className={styles.counts}>{Object.entries(CATEGORY).map(([key, value]) => <span key={key} className={styles[`count${value.tone}`]}>{groups[key].length} {value.title}</span>)}</div></div><div className={styles.skillGrid}>{Object.keys(CATEGORY).map((key) => <SkillGroup key={key} config={CATEGORY[key]} entries={groups[key]} />)}</div></section>

    <section aria-labelledby="ai-analysis"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Day 22 output</p><h2 id="ai-analysis">Detailed analysis and recommendations</h2></div></div>{analysis ? <AiAnalysis analysis={analysis} /> : <div className={styles.unavailable}><Sparkles size={22}/><div><h3>AI analysis unavailable</h3><p>The saved analysis does not include an AI narrative. You can still review the verified score and skill evidence above, or re-run the analysis.</p></div></div>}</section>

    <footer className={styles.actions}><Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}><ArrowLeft size={15}/> Return to Dashboard</Button><Link to="/resumes" className={styles.textLink}><FileText size={15}/> View Resume</Link><Link to={`/jobs/${jobId}/analysis`} className={styles.textLink}><Briefcase size={15}/> View Job Description</Link></footer>
  </main>
}

function ScoreCard({ name, item }) { const score = item?.score; return <article className={styles.scoreCard}><div className={styles.scoreCardTop}><h3>{name[0].toUpperCase() + name.slice(1)} Match</h3><strong>{scoreLabel(score, item?.status)}</strong></div><div className={styles.progress} aria-label={`${name} score`}><span style={{ width: score === null || score === undefined ? '0%' : `${Math.max(0, Math.min(100, Number(score)))}%` }} /></div><p>{item?.explanation || 'No explanation is available for this scoring category.'}</p>{item?.status && item.status !== 'AVAILABLE' && <small>{item.status === 'NOT_APPLICABLE' ? 'Not applicable to this job' : 'Score unavailable'}</small>}</article> }
function SkillGroup({ config, entries }) { const Icon = config.icon; return <article className={`${styles.skillGroup} ${styles[config.tone]}`}><header><span><Icon size={19}/></span><div><h3>{config.title}</h3><p>{entries.length} {entries.length === 1 ? 'skill' : 'skills'}</p></div></header>{entries.length ? <ul>{entries.map((entry, index) => <li key={`${entry.jobSkill}-${index}`}><div className={styles.skillLine}><strong>{entry.jobSkill}</strong><span>{entry.requirementType === 'REQUIRED' ? 'Required' : entry.requirementType === 'PREFERRED' ? 'Preferred' : 'Unspecified'}</span></div>{entry.matchedSkill && entry.category === 'PARTIAL_MATCH' && <p>Related resume skill: {entry.matchedSkill}</p>}{entry.resumeEvidence?.[0] && <p>Resume evidence: {entry.resumeEvidence[0]}</p>}<small>{entry.explanation || (entry.category === 'MISSING' ? 'The available resume does not demonstrate this requirement.' : 'No additional explanation is available.')}</small></li>)}</ul> : <div className={styles.emptyCategory}>{config.empty}</div>}</article> }
function AiAnalysis({ analysis }) { return <div className={styles.aiGrid}><article className={`${styles.analysisCard} ${styles.summary}`}><h3><Sparkles size={18}/> Overall summary</h3><p>{analysis.overallSummary}</p></article><ListCard icon={TrendingUp} title="Strongest areas" items={analysis.strongestAreas} render={(item) => <><strong>{item.skill}</strong><p>{item.explanation || item.evidence}</p></>} empty="No strongest areas were included in this analysis."/><ListCard icon={XCircle} title="Biggest skill gaps" items={analysis.biggestSkillGaps} render={(item) => <><strong>{item.skill} <em>{item.requirementType}</em></strong><p>{item.explanation}</p></>} empty="No major skill gaps were included in this analysis."/><AnalysisCard icon={Clock3} title="Experience analysis" text={analysis.experienceAnalysis?.assessment} detail={analysis.experienceAnalysis?.candidateYears !== null && analysis.experienceAnalysis?.candidateYears !== undefined ? `${analysis.experienceAnalysis.candidateYears} candidate years${analysis.experienceAnalysis.requiredYears !== null && analysis.experienceAnalysis.requiredYears !== undefined ? ` · ${analysis.experienceAnalysis.requiredYears} required` : ''}` : null}/><AnalysisCard icon={GraduationCap} title="Education analysis" text={analysis.educationAnalysis?.assessment} detail={analysis.educationAnalysis?.candidateDegree || null}/><ListCard icon={Lightbulb} title="Improvement suggestions" items={analysis.improvementSuggestions} render={(item) => <><strong>{item.area}</strong><p>{item.suggestion}</p></>} empty="No improvement suggestions were included in this analysis."/></div> }
function ListCard({ icon: Icon, title, items, render, empty }) { return <article className={styles.analysisCard}><h3><Icon size={18}/>{title}</h3>{items?.length ? <ul className={styles.analysisList}>{items.map((item, index) => <li key={index}>{render(item)}</li>)}</ul> : <p className={styles.muted}>{empty}</p>}</article> }
function AnalysisCard({ icon: Icon, title, text, detail }) { return <article className={styles.analysisCard}><h3><Icon size={18}/>{title}</h3>{detail && <span className={styles.detail}>{detail}</span>}<p>{text || 'No analysis was available.'}</p></article> }
function EmptyState({ icon: Icon, title, message, action, actionLabel, secondary }) { return <div className={styles.state}><Icon size={34}/><h1>{title}</h1><p>{message}</p><div><Button onClick={action}>{actionLabel}</Button>{secondary && <Button variant="outline" onClick={secondary}>Open Skill Matching</Button>}</div></div> }
export default AnalysisResults
