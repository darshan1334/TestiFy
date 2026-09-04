import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Bug, ArrowLeft, Search, ExternalLink, ChevronDown, ChevronUp,
  Info, AlertTriangle, XCircle, Image, Lightbulb, ListChecks, User
} from 'lucide-react'
import { sessionsApi, issuesApi } from '../services/api'

const SEV_CFG = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)',  label: 'CRITICAL' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)', label: 'HIGH'     },
  medium:   { color: '#eab308', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.3)',  label: 'MEDIUM'   },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)',  label: 'LOW'      },
  info:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.3)', label: 'INFO'     },
}

const CAT_ICONS = {
  broken_link: '🔗', js_error: '⚡', accessibility: '♿', performance: '⏱️',
  form: '📝', navigation: '🧭', ui: '🎨', api: '🌐', other: '🔍'
}

function BugCard({ bug, index }) {
  const [open, setOpen] = useState(false)
  const sev = SEV_CFG[bug.severity] || SEV_CFG.info
  const icon = CAT_ICONS[bug.category] || '🔍'

  return (
    <div className="fade-in" style={{
      background: 'var(--bg-card)',
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${sev.color}`,
      borderRadius: 12,
      overflow: 'hidden',
      animationDelay: `${Math.min(index * 0.05, 0.4)}s`,
      animationFillMode: 'both',
    }}>
      {/* Header */}
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.85rem', textAlign: 'left',
      }}>
        {/* Bug ID + category icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
          <span style={{ fontSize: '1.1rem' }}>{icon}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
            #{String(index + 1).padStart(3, '0')}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Severity + category row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
              color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`,
              borderRadius: 4, padding: '0.15em 0.55em',
            }}>{sev.label}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.12em 0.45em' }}>
              {bug.category?.replace(/_/g, ' ')}
            </span>
          </div>
          {/* Title */}
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
            {bug.title}
          </div>
          {/* URL preview */}
          {bug.page_url && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bug.page_url}
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          {/* Description */}
          <Section icon={<Info size={13} />} title="Description">
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{bug.description || '—'}</p>
          </Section>

          {/* Expected / Actual */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>✓ Expected</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Functionality should work as designed without errors or violations.</p>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>✗ Actual</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{bug.description?.slice(0, 120) || 'Issue detected by AI analysis.'}…</p>
            </div>
          </div>

          {/* Steps to reproduce */}
          {bug.recommendation && (
            <Section icon={<ListChecks size={13} />} title="Steps to Reproduce / Context">
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{bug.recommendation}</p>
            </Section>
          )}

          {/* Screenshot placeholder */}
          <Section icon={<Image size={13} />} title="Screenshot">
            <div style={{
              height: 80, borderRadius: 8,
              background: 'repeating-linear-gradient(45deg, rgba(99,102,241,0.04) 0, rgba(99,102,241,0.04) 10px, transparent 10px, transparent 20px)',
              border: '1px dashed var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: '0.75rem', gap: '0.4rem',
            }}>
              <Image size={15} /> Screenshot captured during test run
            </div>
          </Section>

          {/* AI Analysis */}
          <Section icon={<Lightbulb size={13} />} title="AI Analysis & Recommendation">
            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '0.75rem', fontSize: '0.8rem', color: '#c4b5fd', lineHeight: 1.7 }}>
              {bug.recommendation || 'Review the issue and apply best practices to resolve.'}
            </div>
          </Section>

          {/* Page URL */}
          {bug.page_url && (
            <a href={bug.page_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--info)', marginTop: '0.5rem' }}>
              <ExternalLink size={11} /> Open page
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div style={{ marginBottom: '0.85rem', marginTop: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {icon} {title}
      </div>
      {children}
    </div>
  )
}

export default function BugsPage() {
  const { sessionId } = useParams()
  const [sessions,    setSessions]    = useState([])
  const [session,     setSession]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [search,      setSearch]      = useState('')
  const [sevFilter,   setSevFilter]   = useState('all')
  const [userIssues,  setUserIssues]  = useState([])
  const [uiLoading,   setUiLoading]   = useState(false)

  useEffect(() => {
    if (sessionId) {
      sessionsApi.get(sessionId)
        .then(setSession)
        .catch(e => setError(e?.response?.data?.detail || 'Failed to load'))
        .finally(() => setLoading(false))
    } else {
      sessionsApi.list()
        .then(d => setSessions(d.filter(s => s.status === 'completed')))
        .catch(console.error)
        .finally(() => setLoading(false))
      // Also fetch user-submitted issues for the list view
      setUiLoading(true)
      issuesApi.list()
        .then(setUserIssues)
        .catch(console.error)
        .finally(() => setUiLoading(false))
    }
  }, [sessionId])

  const bugs = useMemo(() => {
    if (!session) return []
    return (session.issues || [])
      .filter(i => sevFilter === 'all' || i.severity === sevFilter)
      .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3, info: 4 }[a.severity] ?? 5) - ({ critical: 0, high: 1, medium: 2, low: 3, info: 4 }[b.severity] ?? 5))
  }, [session, sevFilter, search])

  // ── Session picker (no sessionId in URL) ──────────────────────────────────
  if (!sessionId) {
    const USER_SEV = {
      Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
      High:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)' },
      Medium:   { color: '#eab308', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.3)' },
      Low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)' },
    }
    return (
      <div className="fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Bugs</h1>
            <p className="page-subtitle">AI-detected bugs by session · User-reported issues</p>
          </div>
          {!window.location.pathname.startsWith('/admin') && (
            <Link to="/report-issue" className="btn-primary" style={{ textDecoration: 'none', fontSize: '0.82rem' }}>
              <User size={14} /> Report an Issue
            </Link>
          )}
        </div>

        {/* ── AI Automated Sessions ──────────────────────────────────── */}
        <div style={{ marginBottom: '0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          AI Automated Test Bugs
        </div>
        {loading ? <div className="empty-state"><p>Loading…</p></div> :
         sessions.length === 0 ? (
          <div className="empty-state">
            <Bug size={44} className="empty-state-icon" />
            <h3>No completed sessions</h3>
            <p><Link to="/new-test" style={{ color: '#a78bfa' }}>Run a test first →</Link></p>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
            <table className="data-table">
              <thead><tr><th>URL</th><th>Date</th><th>Bugs</th><th>Critical</th><th></th></tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td className="primary"><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{s.url}</div></td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                    <td style={{ color: s.total_issues > 0 ? '#f97316' : '#22c55e', fontWeight: 500 }}>{s.total_issues}</td>
                    <td style={{ color: s.critical_issues > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 500 }}>{s.critical_issues}</td>
                    <td>
                      <Link to={`/bugs/${s.id}`} className="btn-secondary" style={{ textDecoration: 'none', fontSize: '0.76rem', padding: '0.3rem 0.75rem' }}>
                        View Bugs <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── User-Reported Issues ───────────────────────────────────── */}
        <div style={{ marginBottom: '0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          User-Reported Issues
        </div>
        {uiLoading ? <div className="empty-state" style={{ padding: '1.5rem' }}><p>Loading user issues…</p></div> :
         userIssues.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <User size={32} className="empty-state-icon" />
            <h3>No user-reported issues yet</h3>
            <p><Link to="/report-issue" style={{ color: '#a78bfa' }}>Report an issue →</Link></p>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Location</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {userIssues.map(ui => {
                  const sevCfg = USER_SEV[ui.severity] || {}
                  return (
                    <tr key={ui.id}>
                      <td className="primary">
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{ui.title}</div>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {ui.location}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                          color: sevCfg.color, background: sevCfg.bg, border: `1px solid ${sevCfg.border}`,
                          borderRadius: 4, padding: '0.12em 0.5em',
                        }}>{ui.severity?.toUpperCase()}</span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ui.status}</td>
                      <td>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 600,
                          color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)',
                          borderRadius: 4, padding: '0.12em 0.5em', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        }}>
                          <User size={9} /> User Report
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(ui.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <Link to={`/issues/${ui.id}`} className="btn-secondary" style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}>
                          View <ExternalLink size={11} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="empty-state"><p>Loading bugs…</p></div>
  if (error) return (
    <div className="empty-state">
      <XCircle size={44} className="empty-state-icon" style={{ color: 'var(--critical)', opacity: 0.5 }} />
      <h3>Error</h3><p>{error}</p>
      <Link to="/bugs" style={{ color: '#a78bfa', marginTop: '1rem', display: 'inline-block' }}>← Back</Link>
    </div>
  )

  const total = session.issues?.length || 0

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <Link to="/bugs" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontSize: '0.8rem' }}>
              <ArrowLeft size={13} /> All Sessions
            </Link>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.1rem' }}>{session.url}</h1>
          <p className="page-subtitle">{total} bug{total !== 1 ? 's' : ''} detected · Health: {session.overall_health || '—'}</p>
        </div>
        <Link to={`/results/${sessionId}`} className="btn-secondary" style={{ textDecoration: 'none' }}>
          View Results Table
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" className="input-field" style={{ paddingLeft: '2rem', fontSize: '0.82rem' }} placeholder="Search bugs…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-bar">
          {['all', 'critical', 'high', 'medium', 'low', 'info'].map(s => (
            <button key={s} className={`tab-item ${sevFilter === s ? 'active' : ''}`} onClick={() => setSevFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bugs.length} / {total}</span>
      </div>

      {/* Bug cards */}
      {bugs.length === 0 ? (
        <div className="empty-state">
          <Bug size={44} className="empty-state-icon" />
          <h3>{total === 0 ? 'No bugs found — excellent!' : 'No bugs match your filters'}</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {bugs.map((bug, i) => <BugCard key={bug.id || i} bug={bug} index={i} />)}
        </div>
      )}
    </div>
  )
}
