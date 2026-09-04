import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, Download, Globe, Eye, FileJson, Clock,
  CheckCircle, AlertTriangle, ExternalLink, User, MessageSquareWarning
} from 'lucide-react'
import { sessionsApi, reportsApi, issuesApi } from '../services/api'

const HEALTH_COLOR = { Good: '#22c55e', Fair: '#eab308', Poor: '#f97316', Critical: '#ef4444' }

const SEV_COLOR = {
  Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e',
}

export default function ReportsPage() {
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [userIssues, setUserIssues] = useState([])
  const [uiLoading, setUiLoading] = useState(true)

  useEffect(() => {
    sessionsApi.list()
      .then(data => setSessions(data.filter(s => s.status === 'completed')))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    issuesApi.list()
      .then(setUserIssues)
      .catch(console.error)
      .finally(() => setUiLoading(false))
  }, [])

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">{sessions.length} AI QA report{sessions.length !== 1 ? 's' : ''} · {userIssues.length} user issue{userIssues.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── AI Automated QA Reports section label ─────────────────── */}
      <div style={{ marginBottom: '0.6rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        AI Automated QA Reports
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14 }} />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <FileText size={52} className="empty-state-icon" />
          <h3>No reports yet</h3>
          <p><Link to="/new-test" style={{ color: '#a78bfa' }}>Run a test to generate your first report →</Link></p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {sessions.map((s, i) => {
            const hColor = HEALTH_COLOR[s.overall_health] || 'var(--text-muted)'
            return (
              <div key={s.id} className="glass-card fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: `${i * 0.04}s`, animationFillMode: 'both' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  {/* Icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FileText size={20} color="#a78bfa" />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
                        {s.url}
                      </span>
                      {s.overall_health && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: hColor, background: `${hColor}15`, border: `1px solid ${hColor}40`, borderRadius: 4, padding: '0.12em 0.5em' }}>
                          {s.overall_health}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={11} /> {new Date(s.created_at).toLocaleString()}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Globe size={11} /> {s.pages_crawled} pages
                      </span>
                      <span style={{ color: s.total_issues > 0 ? '#f97316' : '#22c55e', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {s.total_issues > 0 ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
                        {s.total_issues} issues
                      </span>
                      {s.critical_issues > 0 && (
                        <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          ⚠ {s.critical_issues} critical
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Link
                        to={`/report/${s.id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.42rem 0.9rem', borderRadius: 7, fontSize: '0.76rem', fontWeight: 500,
                          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                          color: '#a78bfa', textDecoration: 'none', transition: 'all 0.15s',
                        }}
                      >
                        <Eye size={12} /> View Report
                      </Link>
                      <a
                        href={reportsApi.htmlUrl(s.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.42rem 0.9rem', borderRadius: 7, fontSize: '0.76rem', fontWeight: 500,
                          background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)',
                          color: '#38bdf8', textDecoration: 'none', transition: 'all 0.15s',
                        }}
                      >
                        <FileText size={12} /> Download HTML
                      </a>
                      <a
                        href={reportsApi.pdfUrl(s.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.42rem 0.9rem', borderRadius: 7, fontSize: '0.76rem', fontWeight: 500,
                          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                          color: '#f87171', textDecoration: 'none', transition: 'all 0.15s',
                        }}
                      >
                        <Download size={12} /> Download PDF
                      </a>
                      <a
                        href={reportsApi.jsonUrl(s.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.42rem 0.9rem', borderRadius: 7, fontSize: '0.76rem', fontWeight: 500,
                          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                          color: '#4ade80', textDecoration: 'none', transition: 'all 0.15s',
                        }}
                      >
                        <FileJson size={12} /> Export JSON
                      </a>
                    </div>
                  </div>

                   {/* Session ID */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {s.id.slice(0, 8)}…
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── User Issue Reports ──────────────────────────────────────────── */}
      <div style={{ marginTop: '2rem', marginBottom: '0.6rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        User Issue Reports
      </div>
      {uiLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 14 }} />)}
        </div>
      ) : userIssues.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem' }}>
          <MessageSquareWarning size={36} className="empty-state-icon" />
          <h3>No user-reported issues yet</h3>
          <p><Link to="/report-issue" style={{ color: '#a78bfa' }}>Report an issue to see it here →</Link></p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {userIssues.map((ui, i) => {
            const sevColor = SEV_COLOR[ui.severity] || 'var(--text-muted)'
            return (
              <div key={ui.id} className="glass-card fade-in" style={{ padding: '1rem 1.25rem', animationDelay: `${i * 0.04}s`, animationFillMode: 'both', borderLeft: `3px solid ${sevColor}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flexWrap: 'wrap' }}>
                  {/* Icon */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 9,
                    background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <User size={17} color="#a78bfa" />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ui.title}
                      </span>
                      {/* Source badge */}
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 700,
                        color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)',
                        borderRadius: 4, padding: '0.1em 0.45em',
                      }}>
                        User Report
                      </span>
                      {/* Severity badge */}
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em',
                        color: sevColor, background: `${sevColor}14`, border: `1px solid ${sevColor}40`,
                        borderRadius: 4, padding: '0.1em 0.45em',
                      }}>
                        {ui.severity}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={10} /> {ui.created_at ? new Date(ui.created_at).toLocaleString() : '—'}
                      </span>
                      <span>{ui.location}</span>
                      <span style={{ color: ui.status === 'Open' ? '#6366f1' : 'var(--text-muted)' }}>{ui.status}</span>
                    </div>
                  </div>

                  {/* View button */}
                  <Link
                    to={`/issues/${ui.id}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.42rem 0.9rem', borderRadius: 7, fontSize: '0.76rem', fontWeight: 500,
                      background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)',
                      color: '#a78bfa', textDecoration: 'none', flexShrink: 0,
                    }}
                  >
                    <Eye size={12} /> View
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

