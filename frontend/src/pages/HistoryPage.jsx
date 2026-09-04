import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Clock, AlertTriangle, CheckCircle, XCircle,
  ExternalLink, Search, Filter, Bug, ClipboardList
} from 'lucide-react'
import { sessionsApi } from '../services/api'

const STATUS_CONFIG = {
  completed: { icon: CheckCircle, color: '#22c55e', cls: 'badge-passed',  label: 'Completed' },
  running:   { icon: Activity,    color: '#a78bfa', cls: 'badge-running', label: 'Running'   },
  pending:   { icon: Clock,       color: '#eab308', cls: 'badge-pending', label: 'Pending'   },
  failed:    { icon: XCircle,     color: '#ef4444', cls: 'badge-failed',  label: 'Failed'    },
}

const HEALTH_COLOR = { Good: '#22c55e', Fair: '#eab308', Poor: '#f97316', Critical: '#ef4444' }

export default function HistoryPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')

  useEffect(() => {
    sessionsApi.list()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = sessions.filter(s => {
    const matchStatus = filter === 'all' || s.status === filter
    const matchSearch = !search || s.url.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Test History</h1>
          <p className="page-subtitle">{sessions.length} total sessions</p>
        </div>
        <Link to="/new-test" className="btn-primary" style={{ textDecoration: 'none' }}>
          + New Test
        </Link>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '2.2rem', fontSize: '0.84rem' }}
            placeholder="Search by URL…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Status filter tabs */}
        <div className="tab-bar">
          {['all', 'completed', 'running', 'failed'].map(s => (
            <button key={s} className={`tab-item ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 68, borderRadius: 12 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Activity size={44} className="empty-state-icon" />
          <h3>{sessions.length === 0 ? 'No sessions yet' : 'No matches'}</h3>
          <p>
            {sessions.length === 0
              ? <Link to="/new-test" style={{ color: '#a78bfa' }}>Run your first test →</Link>
              : 'Try adjusting your search or filters'}
          </p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Date</th>
                <th>Pages</th>
                <th>Issues</th>
                <th>Health</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending
                const StatusIcon = cfg.icon
                const hColor = HEALTH_COLOR[s.overall_health] || 'var(--text-muted)'
                return (
                  <tr key={s.id}>
                    <td className="primary" style={{ maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                        {s.url}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.75rem' }}>
                        {new Date(s.created_at).toLocaleDateString()}<br />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                          {new Date(s.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td>{s.pages_crawled}</td>
                    <td>
                      <span style={{ color: s.total_issues > 0 ? '#f97316' : '#22c55e', fontWeight: 500 }}>
                        {s.total_issues}
                      </span>
                      {s.critical_issues > 0 && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', color: 'var(--critical)' }}>
                          ({s.critical_issues} crit)
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: hColor, fontSize: '0.8rem', fontWeight: 500 }}>
                        {s.overall_health || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${cfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <StatusIcon size={9} /> {cfg.label}
                      </span>
                    </td>
                    <td>
                      {s.status === 'completed' && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <Link to={`/results/${s.id}`} title="Results" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                            <ClipboardList size={14} />
                          </Link>
                          <Link to={`/bugs/${s.id}`} title="Bugs" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                            <Bug size={14} />
                          </Link>
                          <Link to={`/report/${s.id}`} title="Report" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                            <ExternalLink size={14} />
                          </Link>
                        </div>
                      )}
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
