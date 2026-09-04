import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe, GitBranch, FileArchive, Settings2, ChevronDown, Zap, UploadCloud, X,
  Accessibility, Gauge, Wifi, Eye, ShieldCheck, FlaskConical, Bug,
  CheckCircle, Loader2,
} from 'lucide-react'
import ProgressPanel from '../components/ProgressPanel'
import { useTestSession } from '../hooks/useTestSession'

const BROWSERS = ['Chromium', 'Firefox', 'WebKit']

const SOURCES = [
  { key: 'url',    label: 'Website URL', icon: Globe },
  { key: 'github', label: 'GitHub Repo', icon: GitBranch },
  { key: 'zip',    label: 'ZIP Upload',  icon: FileArchive },
]

// The pipeline runs the same phases for every intake; only the labels differ,
// because a codebase is indexed rather than crawled with a browser.
const URL_STEPS = [
  { key: 'init',    label: 'Starting browser' },
  { key: 'open',    label: 'Opening website' },
  { key: 'crawl',   label: 'Discovering pages' },
  { key: 'analyse', label: 'Analysing UI elements' },
  { key: 'gen',     label: 'Generating test cases' },
  { key: 'exec',    label: 'Executing tests' },
  { key: 'fail',    label: 'Analysing failures' },
  { key: 'report',  label: 'Generating report' },
]

const SOURCE_STEPS = [
  { key: 'init',    label: 'Preparing workspace' },
  { key: 'open',    label: 'Reading project files' },
  { key: 'crawl',   label: 'Indexing source tree' },
  { key: 'analyse', label: 'Analysing code and coverage' },
  { key: 'gen',     label: 'Generating test cases' },
  { key: 'exec',    label: 'Evaluating findings' },
  { key: 'fail',    label: 'Classifying defects' },
  { key: 'report',  label: 'Generating report' },
]

const PHASE_TO_STEP = {
  initialising:      2,
  exploring:         3,
  analysing:         4,
  ai_analysis:       5,
  generating_report: 7,
  completed:         8,
}

const MAX_ZIP_MB = 200

function Toggle({ id, label, description, icon: Icon, checked, onChange }) {
  return (
    <label htmlFor={id} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.85rem 1rem',
      background: 'rgba(15,20,32,0.5)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      cursor: 'pointer',
      transition: 'border-color 0.2s',
      ...(checked ? { borderColor: 'rgba(99,102,241,0.4)' } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: checked ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}>
          <Icon size={16} color={checked ? '#a78bfa' : 'var(--text-muted)'} />
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: checked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {label}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{description}</div>
        </div>
      </div>
      <label className="toggle-switch">
        <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </label>
    </label>
  )
}

const fieldLabelStyle = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
  marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em',
}

export default function NewTestPage() {
  const {
    status, phase, message, progress, session, error, sourceType, uploadPercent,
    startTest, startGithubTest, startZipTest, reset,
  } = useTestSession()
  const navigate = useNavigate()

  const [source, setSource]     = useState('url')
  const [url, setUrl]           = useState('')
  const [repoUrl, setRepoUrl]   = useState('')
  const [zipFile, setZipFile]   = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [inputError, setInputError] = useState('')
  const fileInputRef = useRef(null)

  const [browser, setBrowser]   = useState('Chromium')
  const [maxPages, setMaxPages] = useState(5)
  const [opts, setOpts] = useState({
    accessibility: true,
    performance:   true,
    api:           false,
    visual:        false,
  })
  const [codeOpts, setCodeOpts] = useState({
    accessibility: true,
    coverage:      true,
    errorHandling: true,
    performance:   false,
  })

  const isRunning   = status === 'running' || status === 'submitting'
  const isCompleted = status === 'completed'
  const isFailed    = status === 'failed'

  const isCodeSource = sourceType === 'github' || sourceType === 'zip'
  const unitLabel    = isCodeSource ? 'file' : 'page'
  const steps        = isCodeSource ? SOURCE_STEPS : URL_STEPS

  const target = source === 'url' ? url : source === 'github' ? repoUrl : (zipFile?.name || '')
  const canSubmit = source === 'zip' ? !!zipFile : !!target.trim()

  function validateUrl(value) {
    try {
      const u = new URL(value)
      if (!['http:', 'https:'].includes(u.protocol)) return 'URL must use http or https'
      return ''
    } catch {
      return 'Please enter a valid URL (e.g. https://example.com)'
    }
  }

  function validateRepo(value) {
    const pattern = /^https?:\/\/(www\.)?(github|gitlab|bitbucket)\.(com|org)\/[\w.-]+\/[\w.-]+\/?$/i
    if (!pattern.test(value.trim().replace(/\.git$/i, '')))
      return 'Enter a public repository URL, e.g. https://github.com/owner/repo'
    return ''
  }

  function selectZip(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setInputError('Only .zip archives are supported')
      return
    }
    if (file.size > MAX_ZIP_MB * 1024 * 1024) {
      setInputError(`Archive is larger than the ${MAX_ZIP_MB} MB limit`)
      return
    }
    setInputError('')
    setZipFile(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    selectZip(e.dataTransfer.files?.[0])
  }

  function handleSubmit(e) {
    e.preventDefault()

    if (source === 'url') {
      const err = validateUrl(url)
      if (err) { setInputError(err); return }
      setInputError('')
      startTest(url.trim(), maxPages)
      return
    }

    if (source === 'github') {
      const err = validateRepo(repoUrl)
      if (err) { setInputError(err); return }
      setInputError('')
      startGithubTest(repoUrl.trim().replace(/\.git$/i, '').replace(/\/$/, ''))
      return
    }

    if (!zipFile) { setInputError('Choose a .zip archive of your project'); return }
    setInputError('')
    startZipTest(zipFile)
  }

  function handleReset() {
    reset()
    setZipFile(null)
    setInputError('')
  }

  // Completed: offer the results
  if (isCompleted && session) {
    return (
      <div className="fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
          }}>
            <CheckCircle size={30} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Test Complete!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {session.total_issues} issues found across {session.pages_crawled} {unitLabel}s.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => navigate(`/results/${session.id}`)}>
              View Results
            </button>
            <button className="btn-secondary" onClick={() => navigate(`/bugs/${session.id}`)}>
              View Bugs
            </button>
            <button className="btn-ghost" onClick={handleReset}>
              Run Another Test
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Form card */}
      {!isRunning && !isFailed && (
        <form onSubmit={handleSubmit} className="glass-card fade-in" style={{ padding: '2rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={17} color="#a78bfa" /> Configure Test
          </h2>

          {/* Source selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={fieldLabelStyle}>Test Source</label>
            <div className="tab-bar" style={{ display: 'inline-flex' }}>
              {SOURCES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  id={`source-tab-${key}`}
                  type="button"
                  className={`tab-item${source === key ? ' active' : ''}`}
                  onClick={() => { setSource(key); setInputError('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Website URL ─────────────────────────────────────────────── */}
          {source === 'url' && (
            <>
              <div style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="website-url" style={fieldLabelStyle}>Website URL *</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="website-url"
                    type="text"
                    className="input-field"
                    style={{ paddingLeft: '2.4rem' }}
                    placeholder="https://example.com"
                    value={url}
                    onChange={e => { setUrl(e.target.value); if (inputError) setInputError('') }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Browser + depth row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Browser</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="select-field"
                      style={{ width: '100%' }}
                      value={browser}
                      onChange={e => setBrowser(e.target.value)}
                    >
                      {BROWSERS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={fieldLabelStyle}>
                    Test Depth — <span style={{ color: '#a78bfa' }}>{maxPages} pages</span>
                  </label>
                  <input
                    type="range" min={1} max={20} value={maxPages}
                    onChange={e => setMaxPages(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#6366f1', marginTop: '0.6rem' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    <span>1 (fast)</span><span>20 (thorough)</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── GitHub repository ───────────────────────────────────────── */}
          {source === 'github' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="repo-url" style={fieldLabelStyle}>Repository URL *</label>
              <div style={{ position: 'relative' }}>
                <GitBranch size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="repo-url"
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={e => { setRepoUrl(e.target.value); if (inputError) setInputError('') }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.45rem' }}>
                The default branch of a public repository is cloned, analysed, then deleted.
              </p>
            </div>
          )}

          {/* ── ZIP upload ──────────────────────────────────────────────── */}
          {source === 'zip' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={fieldLabelStyle}>Project Archive *</label>
              {!zipFile ? (
                <div
                  id="zip-dropzone"
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                  onDragOver={e => { e.preventDefault(); setDragActive(true) }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '0.6rem', padding: '2.25rem 1rem', cursor: 'pointer',
                    background: dragActive ? 'rgba(99,102,241,0.08)' : 'rgba(15,20,32,0.5)',
                    border: `1px dashed ${dragActive ? 'rgba(99,102,241,0.6)' : 'var(--border)'}`,
                    borderRadius: 10,
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  <UploadCloud size={26} color={dragActive ? '#a78bfa' : 'var(--text-muted)'} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                    Drop a .zip here, or <span style={{ color: '#a78bfa' }}>browse</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Up to {MAX_ZIP_MB} MB · extracted, analysed, then deleted
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                  padding: '0.9rem 1rem',
                  background: 'rgba(15,20,32,0.5)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(99,102,241,0.15)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FileArchive size={16} color="#a78bfa" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {zipFile.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {(zipFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost"
                    aria-label="Remove selected archive"
                    onClick={() => setZipFile(null)}
                    style={{ padding: '0.4rem' }}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                id="zip-file-input"
                type="file"
                accept=".zip,application/zip"
                style={{ display: 'none' }}
                onChange={e => selectZip(e.target.files?.[0])}
              />
            </div>
          )}

          {inputError && (
            <p style={{ color: 'var(--critical)', fontSize: '0.75rem', marginTop: '-0.75rem', marginBottom: '1rem' }}>
              {inputError}
            </p>
          )}

          {/* Test options */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Settings2 size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {source === 'url' ? 'Test Options' : 'Analysis Options'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              {source === 'url' ? (
                <>
                  <Toggle id="opt-a11y" label="Accessibility"  description="WCAG checks"         icon={Accessibility} checked={opts.accessibility} onChange={v => setOpts(o => ({ ...o, accessibility: v }))} />
                  <Toggle id="opt-perf" label="Performance"    description="Load time metrics"   icon={Gauge}         checked={opts.performance}   onChange={v => setOpts(o => ({ ...o, performance: v }))} />
                  <Toggle id="opt-api"  label="API Testing"    description="Endpoint validation" icon={Wifi}          checked={opts.api}           onChange={v => setOpts(o => ({ ...o, api: v }))} />
                  <Toggle id="opt-vis"  label="Visual Testing" description="Screenshot diffs"    icon={Eye}           checked={opts.visual}        onChange={v => setOpts(o => ({ ...o, visual: v }))} />
                </>
              ) : (
                <>
                  <Toggle id="opt-code-a11y"     label="Accessibility"  description="Markup and ARIA checks"   icon={Accessibility} checked={codeOpts.accessibility} onChange={v => setCodeOpts(o => ({ ...o, accessibility: v }))} />
                  <Toggle id="opt-code-coverage" label="Test Coverage"  description="Untested modules and CI"  icon={FlaskConical}  checked={codeOpts.coverage}      onChange={v => setCodeOpts(o => ({ ...o, coverage: v }))} />
                  <Toggle id="opt-code-errors"   label="Error Handling" description="Swallowed failures"       icon={Bug}           checked={codeOpts.errorHandling} onChange={v => setCodeOpts(o => ({ ...o, errorHandling: v }))} />
                  <Toggle id="opt-code-perf"     label="Performance"    description="Heavy modules and assets" icon={Gauge}         checked={codeOpts.performance}   onChange={v => setCodeOpts(o => ({ ...o, performance: v }))} />
                </>
              )}
            </div>
          </div>

          {source !== 'url' && (
            <p style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1.25rem',
            }}>
              <ShieldCheck size={13} color="var(--text-muted)" />
              Quality and testability analysis. For vulnerabilities, secrets and CVEs, use the Security section.
            </p>
          )}

          {/* Submit */}
          <button
            id="start-ai-testing-btn"
            type="submit"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}
            disabled={!canSubmit}
          >
            <Zap size={16} fill="currentColor" /> Start AI Testing
          </button>
        </form>
      )}

      {/* Running / failed */}
      {(isRunning || isFailed) && (
        <div className="fade-in">
          {/* Status header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem',
          }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                {isFailed ? '❌ Test Failed' : '🧪 AI Testing in Progress'}
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                {target}
              </p>
            </div>
            {isFailed && (
              <button className="btn-secondary" onClick={handleReset}>Try Again</button>
            )}
          </div>

          {/* Archive upload progress — before the pipeline itself begins */}
          {status === 'submitting' && sourceType === 'zip' && (
            <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Uploading archive</span>
                <span style={{ color: '#a78bfa', fontWeight: 600 }}>{uploadPercent}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  width: `${uploadPercent}%`, height: '100%',
                  background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                  transition: 'width 0.2s',
                }} />
              </div>
            </div>
          )}

          {/* Live stats */}
          {isRunning && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
              {[
                { label: 'Status', value: status === 'submitting' ? 'Submitting' : 'Running' },
                { label: 'Progress', value: `${progress}%` },
                { label: 'Phase', value: phase || '—' },
                { label: 'Source', value: sourceType === 'github' ? 'GitHub' : sourceType === 'zip' ? 'Archive' : 'Website' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#a78bfa', marginBottom: '0.2rem' }}>{value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          <ProgressPanel phase={phase} message={isFailed ? error : message} progress={progress} status={status} />

          {/* Live timeline */}
          {isRunning && (
            <div className="glass-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
                Live Activity Timeline
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {steps.map((step, i) => {
                  const currentStep = PHASE_TO_STEP[phase] || 0
                  const isDone = i < currentStep
                  const isCur  = i === currentStep - 1
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isDone ? 'rgba(34,197,94,0.12)' : isCur ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: `1px solid ${isDone ? 'rgba(34,197,94,0.4)' : isCur ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                      }}>
                        {isDone ? <CheckCircle size={11} color="#22c55e" /> :
                         isCur  ? <Loader2 size={11} color="#a78bfa" className="spin" /> :
                                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border)', display: 'block' }} />}
                      </div>
                      <span style={{
                        fontSize: '0.8rem',
                        color: isDone ? '#22c55e' : isCur ? '#a78bfa' : 'var(--text-muted)',
                        fontWeight: isCur ? 600 : 400,
                      }}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
