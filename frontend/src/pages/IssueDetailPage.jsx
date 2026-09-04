import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, FileText, AlignLeft, MapPin, Gauge,
  Image, Clock, RefreshCw, Info, User, XCircle
} from 'lucide-react'
import { issuesApi } from '../services/api'

const SEV_CFG = {
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
  High:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)' },
  Medium:   { color: '#eab308', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.3)' },
  Low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)' },
}

const STATUS_CFG = {
  Open:          { color: '#6366f1', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.3)' },
  'In Progress': { color: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.3)' },
  Resolved:      { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)' },
  Closed:        { color: '#4b5563', bg: 'rgba(75,85,99,0.08)',    border: 'rgba(75,85,99,0.3)' },
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div style={{
      display: 'flex', gap: '1rem', padding: '0.85rem 0',
      borderBottom: '1px solid var(--border)',
      alignItems: 'flex-start',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        minWidth: 140, color: 'var(--text-muted)', fontSize: '0.73rem',
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
        flexShrink: 0, paddingTop: '0.1rem',
      }}>
        <Icon size={12} />
        {label}
      </div>
      <div style={{ flex: 1, fontSize: '0.86rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
        {children}
      </div>
    </div>
  )
}

export default function IssueDetailPage() {
  const { issueId } = useParams()
  const [issue, setIssue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!issueId) return
    issuesApi.get(issueId)
      .then(setIssue)
      .catch(e => setError(e?.response?.data?.detail || 'Failed to load issue report.'))
      .finally(() => setLoading(false))
  }, [issueId])

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading issue…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state">
        <XCircle size={44} className="empty-state-icon" style={{ color: '#ef4444', opacity: 0.5 }} />
        <h3>Error</h3>
        <p>{error}</p>
        <Link to="/bugs" style={{ color: '#a78bfa', marginTop: '1rem', display: 'inline-block' }}>
          ← Back to Bugs
        </Link>
      </div>
    )
  }

  if (!issue) return null

  const sev = SEV_CFG[issue.severity] || {}
  const status = STATUS_CFG[issue.status] || STATUS_CFG.Open

  return (
    <div className="fade-in" style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Link
          to="/bugs"
          style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontSize: '0.8rem' }}
        >
          <ArrowLeft size={13} /> Bugs
        </Link>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>User Report</span>
      </div>

      {/* Header card */}
      <div className="glass-card" style={{ padding: '1.5rem 1.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges row */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              {/* Source badge */}
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: 4, padding: '0.15em 0.55em', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              }}>
                <User size={9} /> User Report
              </span>
              {/* Severity badge */}
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`,
                borderRadius: 4, padding: '0.15em 0.55em',
              }}>
                {issue.severity?.toUpperCase()}
              </span>
              {/* Status badge */}
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                color: status.color, background: status.bg, border: `1px solid ${status.border}`,
                borderRadius: 4, padding: '0.15em 0.55em',
              }}>
                {issue.status}
              </span>
              {/* Location pill */}
              <span style={{
                fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)', borderRadius: 4, padding: '0.12em 0.45em',
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              }}>
                <MapPin size={10} /> {issue.location}
              </span>
            </div>

            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '0.3rem' }}>
              {issue.title}
            </h1>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              ID: {issue.id}
            </div>
          </div>
        </div>

        {/* Details table */}
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <DetailRow icon={MapPin} label="Location">
            <span style={{ fontWeight: 600 }}>{issue.location}</span>
          </DetailRow>

          <DetailRow icon={AlignLeft} label="Description">
            <p style={{ lineHeight: 1.75, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {issue.description}
            </p>
          </DetailRow>

          <DetailRow icon={Gauge} label="Severity">
            <span style={{ color: sev.color, fontWeight: 600 }}>{issue.severity}</span>
          </DetailRow>

          <DetailRow icon={Info} label="Status">
            <span style={{ color: status.color, fontWeight: 600 }}>{issue.status}</span>
          </DetailRow>

          <DetailRow icon={User} label="Source">
            <span style={{ color: '#a78bfa', fontWeight: 600 }}>User Report</span>
          </DetailRow>

          <DetailRow icon={Clock} label="Reported">
            {issue.created_at ? new Date(issue.created_at).toLocaleString() : '—'}
          </DetailRow>

          <DetailRow icon={RefreshCw} label="Updated">
            {issue.updated_at ? new Date(issue.updated_at).toLocaleString() : '—'}
          </DetailRow>
        </div>
      </div>

      {/* Screenshot / Evidence */}
      <div className="glass-card" style={{ padding: '1.25rem 1.75rem' }}>
        <h3 style={{
          fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          <Image size={13} /> Screenshot / Evidence
        </h3>

        {issue.screenshot_url ? (
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img
              src={issue.screenshot_url}
              alt="Issue evidence screenshot"
              style={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block', background: '#0a0d16' }}
              onError={e => {
                e.currentTarget.style.display = 'none'
                if (e.currentTarget.nextSibling) {
                  e.currentTarget.nextSibling.style.display = 'flex'
                }
              }}
            />
            <div style={{
              display: 'none', height: 80, alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: '0.75rem', gap: '0.4rem',
              background: 'rgba(15,20,32,0.5)',
            }}>
              <Image size={15} /> Screenshot file unavailable
            </div>
          </div>
        ) : (
          <div style={{
            height: 80, borderRadius: 10,
            background: 'repeating-linear-gradient(45deg, rgba(99,102,241,0.04) 0, rgba(99,102,241,0.04) 10px, transparent 10px, transparent 20px)',
            border: '1px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: '0.75rem', gap: '0.4rem',
          }}>
            <Image size={15} /> No screenshot uploaded
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to="/bugs" className="btn-secondary" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Bugs
        </Link>
        <Link to="/report-issue" className="btn-secondary" style={{ textDecoration: 'none' }}>
          <FileText size={14} /> Report Another Issue
        </Link>
      </div>
    </div>
  )
}
