import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, AlertTriangle, Info } from 'lucide-react'

const SEVERITY_CONFIG = {
  critical: { color: 'var(--critical)', bg: 'rgba(239,68,68,0.08)', label: 'CRITICAL', border: 'rgba(239,68,68,0.3)' },
  high:     { color: 'var(--high)',     bg: 'rgba(249,115,22,0.08)', label: 'HIGH',     border: 'rgba(249,115,22,0.3)' },
  medium:   { color: 'var(--medium)',   bg: 'rgba(234,179,8,0.08)',  label: 'MEDIUM',   border: 'rgba(234,179,8,0.3)' },
  low:      { color: 'var(--low)',      bg: 'rgba(34,197,94,0.08)',  label: 'LOW',      border: 'rgba(34,197,94,0.3)' },
  info:     { color: 'var(--info)',     bg: 'rgba(96,165,250,0.08)', label: 'INFO',     border: 'rgba(96,165,250,0.3)' },
}

const CATEGORY_ICONS = {
  broken_link:   '🔗',
  js_error:      '⚡',
  accessibility: '♿',
  performance:   '⏱️',
  form:          '📝',
  navigation:    '🧭',
  ui:            '🎨',
  api:           '🌐',
  other:         '🔍',
}

export default function IssueCard({ issue, index }) {
  const [expanded, setExpanded] = useState(false)
  const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info
  const icon = CATEGORY_ICONS[issue.category] || '🔍'

  return (
    <div
      className="fade-in"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${sev.color}`,
        borderRadius: 10,
        overflow: 'hidden',
        animationDelay: `${Math.min(index * 0.04, 0.5)}s`,
        animationFillMode: 'both',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = sev.border}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '0.9rem 1rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>

        <span style={{
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
          color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`,
          borderRadius: 4, padding: '0.15em 0.55em', flexShrink: 0,
        }}>
          {sev.label}
        </span>

        <span style={{
          fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {issue.title}
        </span>

        <span style={{
          fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)',
          borderRadius: 4, padding: '0.15em 0.5em', flexShrink: 0, marginRight: '0.5rem',
          border: '1px solid var(--border)',
        }}>
          {issue.category?.replace('_', ' ')}
        </span>

        {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', lineHeight: 1.65, marginTop: '0.85rem', marginBottom: '0.75rem' }}>
            {issue.description}
          </p>

          {issue.recommendation && (
            <div style={{
              padding: '0.65rem 0.9rem', borderRadius: 8, marginBottom: '0.65rem',
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
              fontSize: '0.8rem', color: '#c4b5fd', lineHeight: 1.6,
              display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
            }}>
              <Info size={13} style={{ marginTop: 2, flexShrink: 0, color: '#818cf8' }} />
              {issue.recommendation}
            </div>
          )}

          {issue.page_url && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ExternalLink size={11} color="var(--info)" />
              <a
                href={issue.page_url} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--info)', fontSize: '0.75rem', wordBreak: 'break-all' }}
              >
                {issue.page_url}
              </a>
            </div>
          )}

          {issue.element_selector && (
            <div style={{ marginTop: '0.5rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.73rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '0.3rem 0.6rem', borderRadius: 4 }}>
              {issue.element_selector.slice(0, 120)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
