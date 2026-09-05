import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ClipboardList, Search, ArrowLeft, Clock, ExternalLink,
  CheckCircle, XCircle, AlertTriangle, ChevronDown
} from 'lucide-react'
import { sessionsApi } from '../services/api'

const SEV_ORDER  = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const CATEGORIES = ['all', 'broken_link', 'js_error', 'accessibility', 'performance', 'form', 'navigation', 'api', 'ui', 'other']
const CAT_ICONS  = { broken_link: '🔗', js_error: '⚡', accessibility: '♿', performance: '⏱️', form: '📝', navigation: '🧭', ui: '🎨', api: '🌐', other: '🔍' }

function statusFromSeverity(sev) {
  if (sev === 'critical' || sev === 'high') return 'failed'
  if (sev === 'medium') return 'warning'
  return 'passed'
}

export default function TestResultsPage() {
  const { sessionId } = useParams()
  const [sessions, setSessions] = useState([])
  const [session,  setSession]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [search,   setSearch]   = useState('')
  const [tabFilter, setTabFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [expanded, setExpanded]   = useState(null)

  // If no sessionId: list sessions to pick from
  useEffect(() => {
    setLoading(true)
    setError(null)
    if (sessionId) {
      setSession(null)
      sessionsApi.get(sessionId)
        .then(setSession)
        .catch(e => setError(e?.response?.data?.detail || 'Test result not found'))
        .finally(() => setLoading(false))
    } else {
      sessionsApi.list()
        .then(data => setSessions(data.filter(s => s.status === 'completed')))
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [sessionId])

  const issues = session?.issues || []

  const filtered = useMemo(() => {
    return issues
      .filter(i => tabFilter === 'all' || statusFromSeverity(i.severity) === tabFilter)
      .filter(i => catFilter === 'all' || i.category === catFilter)
      .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5))
  }, [issues, tabFilter, catFilter, search])

  // Session selector (no sessionId in URL)
  if (!sessionId) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Test Results</h1>
            <p className="page-subtitle">Select a session to view its results</p>
          </div>
        </div>
        {loading ? (
          <div className="empty-state"><p>Loading…</p></div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={44} className="empty-state-icon" />
            <h3>No completed sessions</h3>
            <p><Link to="/new-test" style={{ color: '#a78bfa' }}>Run a test first →</Link></p>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr><th>URL</th><th>Date</th><th>Issues</th><th>Health</th><th></th></tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td className="primary" style={{ maxWidth: 300 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                    <td style={{ color: s.total_issues > 0 ? '#f97316' : '#22c55e', fontWeight: 500 }}>{s.total_issues}</td>
                    <td style={{ color: s.overall_health === 'Good' ? '#22c55e' : 'var(--text-secondary)' }}>{s.overall_health || '—'}</td>
                    <td>
                      <Link to={`/results/${s.id}`} className="btn-secondary" style={{ textDecoration: 'none', fontSize: '0.76rem', padding: '0.3rem 0.75rem' }}>
                        View <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const isSessionLoading = loading || (Boolean(sessionId) && (!session || session.id !== sessionId))

  if (isSessionLoading && !error) return (
    <div className="empty-state"><div className="skeleton" style={{ width: 200, height: 20, margin: '0 auto' }} /></div>
  )
  if (error || (sessionId && !session)) return (
    <div className="empty-state">
      <XCircle size={44} className="empty-state-icon" style={{ opacity: 0.5, color: 'var(--critical)' }} />
      <h3>Test result not found</h3>
      <p>{error || 'Test result not found'}</p>
      <Link to="/results" style={{ color: '#a78bfa', marginTop: '1rem', display: 'inline-block' }}>← Back to Sessions</Link>
    </div>
  )

  const passCount    = issues.filter(i => statusFromSeverity(i.severity) === 'passed').length
  const failCount    = issues.filter(i => statusFromSeverity(i.severity) === 'failed').length
  const warnCount    = issues.filter(i => statusFromSeverity(i.severity) === 'warning').length

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <Link to="/results" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontSize: '0.8rem' }}>
              <ArrowLeft size={13} /> Sessions
            </Link>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.1rem' }}>{session?.url}</h1>
          <p className="page-subtitle">{issues.length} issues · {session?.pages_crawled ?? 0} pages · {session?.created_at ? new Date(session.created_at).toLocaleString() : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to={`/bugs/${sessionId}`} className="btn-secondary" style={{ textDecoration: 'none' }}>
            View Bugs
          </Link>
          <Link to={`/report/${sessionId}`} className="btn-secondary" style={{ textDecoration: 'none' }}>
            View Report
          </Link>
        </div>
      </div>

      {/* Summary mini-cards */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Total',   value: issues.length, color: '#a78bfa' },
          { label: 'Passed',  value: passCount,     color: '#22c55e' },
          { label: 'Failed',  value: failCount,     color: '#ef4444' },
          { label: 'Warning', value: warnCount,     color: '#eab308' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 1.1rem', minWidth: 90 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" className="input-field" style={{ paddingLeft: '2rem', fontSize: '0.82rem' }} placeholder="Search tests…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-bar">
          {[['all','All'], ['failed','Failed'], ['warning','Warning'], ['passed','Passed']].map(([v, l]) => (
            <button key={v} className={`tab-item ${tabFilter === v ? 'active' : ''}`} onClick={() => setTabFilter(v)}>{l}</button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <select className="select-field" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.replace('_', ' ')}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <CheckCircle size={36} className="empty-state-icon" />
            <h3>{issues.length === 0 ? 'No issues found — great job!' : 'No results match filters'}</h3>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Test Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Severity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue, i) => {
                const st = statusFromSeverity(issue.severity)
                const isExp = expanded === (issue.id || i)
                return (
                  <>
                    <tr key={issue.id || i} style={{ cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : (issue.id || i))}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{String(i + 1).padStart(3, '0')}</td>
                      <td className="primary" style={{ maxWidth: 260 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {CAT_ICONS[issue.category] || '🔍'} {issue.title}
                        </div>
                      </td>
                      <td><span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.1em 0.5em' }}>{issue.category?.replace('_', ' ')}</span></td>
                      <td>
                        <span className={`badge badge-${st}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          {st === 'passed' ? <CheckCircle size={9} /> : st === 'failed' ? <XCircle size={9} /> : <AlertTriangle size={9} />}
                          {st.toUpperCase()}
                        </span>
                      </td>
                      <td><span className={`badge badge-${issue.severity || 'info'}`}>{issue.severity?.toUpperCase() || 'INFO'}</span></td>
                      <td><ChevronDown size={13} color="var(--text-muted)" style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} /></td>
                    </tr>
                    {isExp && (
                      <tr key={`exp-${issue.id || i}`}>
                        <td colSpan={6} style={{ background: 'rgba(99,102,241,0.03)', padding: '0.75rem 1rem 1rem' }}>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '0.5rem' }}>{issue.description}</p>
                          {issue.recommendation && (
                            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: '#c4b5fd' }}>
                              💡 {issue.recommendation}
                            </div>
                          )}
                          {issue.page_url && (
                            <a href={issue.page_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
                              <ExternalLink size={11} /> {issue.page_url}
                            </a>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
