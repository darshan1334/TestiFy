import { useState, useMemo } from 'react'
import { Download, FileText, FileJson, Filter, Search, ChevronDown } from 'lucide-react'
import IssueCard from './IssueCard'
import StatsBar from './StatsBar'
import { reportsApi } from '../services/api'

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const ALL_CATEGORIES = ['all', 'broken_link', 'js_error', 'accessibility', 'performance', 'form', 'navigation', 'api', 'ui', 'other']
const ALL_SEVERITIES = ['all', 'critical', 'high', 'medium', 'low', 'info']

export default function ResultsPanel({ session }) {
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  const issues = session?.issues || []

  const filtered = useMemo(() => {
    return issues
      .filter(i => filterSeverity === 'all' || i.severity === filterSeverity)
      .filter(i => filterCategory === 'all' || i.category === filterCategory)
      .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5))
  }, [issues, filterSeverity, filterCategory, search])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>
      {/* Main issue list */}
      <div>
        {/* Toolbar */}
        <div className="glass-card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: '2rem', fontSize: '0.82rem', padding: '0.45rem 0.75rem 0.45rem 2rem' }}
              placeholder="Search issues…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Severity filter */}
          <FilterSelect value={filterSeverity} onChange={setFilterSeverity} options={ALL_SEVERITIES} label="Severity" />

          {/* Category filter */}
          <FilterSelect value={filterCategory} onChange={setFilterCategory} options={ALL_CATEGORIES} label="Category" />

          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {filtered.length} of {issues.length} issues
          </span>
        </div>

        {/* Download buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <a
            href={reportsApi.htmlUrl(session.id)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
              color: '#a78bfa', textDecoration: 'none', transition: 'all 0.15s',
            }}
          >
            <FileText size={13} /> HTML Report
          </a>
          <a
            href={reportsApi.pdfUrl(session.id)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171', textDecoration: 'none', transition: 'all 0.15s',
            }}
          >
            <Download size={13} /> PDF Report
          </a>
          <a
            href={reportsApi.jsonUrl(session.id)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
              color: '#4ade80', textDecoration: 'none', transition: 'all 0.15s',
            }}
          >
            <FileJson size={13} /> JSON Export
          </a>
        </div>

        {/* Issues */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {issues.length === 0 ? '✅ No issues found!' : '🔍 No issues match your filters'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {filtered.map((issue, i) => (
              <IssueCard key={issue.id || i} issue={issue} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div style={{ position: 'sticky', top: 76 }}>
        <StatsBar session={session} />
      </div>
    </div>
  )
}

function FilterSelect({ value, onChange, options, label }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none',
          background: 'rgba(15,20,32,0.8)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text-primary)',
          fontSize: '0.78rem',
          padding: '0.45rem 2rem 0.45rem 0.75rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>
            {opt === 'all' ? `All ${label}` : opt.replace('_', ' ')}
          </option>
        ))}
      </select>
      <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
    </div>
  )
}
