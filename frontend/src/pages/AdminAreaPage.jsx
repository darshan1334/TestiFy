import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { adminApi } from '../services/api'
import { Users, AlertCircle, Database, ShieldAlert, BarChart3, Clock, Loader2 } from 'lucide-react'

export default function AdminAreaPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const tabFromUrl = searchParams.get('tab') || 'users'

  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [issues, setIssues] = useState([])
  const [activeTab, setActiveTab] = useState(tabFromUrl)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  const handleTabClick = (tabId) => {
    setActiveTab(tabId)
    navigate(`/admin?tab=${tabId}`, { replace: true })
  }

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [statsData, usersData, issuesData] = await Promise.all([
          adminApi.getStats(),
          adminApi.getUsers(),
          adminApi.getIssues()
        ])
        setStats(statsData)
        setUsers(usersData)
        setIssues(issuesData)
      } catch (err) {
        console.error("Failed to load admin data:", err)
      } finally {
        setLoading(false)
      }
    }
    loadAdminData()
  }, [])

  if (loading) {
    return (
      <div className="empty-state">
        <Loader2 size={32} className="spinner" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
        <p>Loading Admin Area…</p>
      </div>
    )
  }

  const TABS = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'issues', label: 'User Issue Reports', icon: AlertCircle },
  ]

  return (
    <div className="fade-in" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Area</h1>
          <p className="page-subtitle">Manage users, view reports, and oversee system activity</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Users', value: stats?.users || 0, icon: Users, color: '#6366f1' },
          { label: 'User Reports', value: stats?.user_issues || 0, icon: AlertCircle, color: '#eab308' },
          { label: 'Test Sessions', value: stats?.sessions || 0, icon: Database, color: '#a78bfa' },
          { label: 'Automated Bugs', value: stats?.automated_bugs || 0, icon: ShieldAlert, color: '#ef4444' }
        ].map((stat, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: `${stat.color}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${stat.color}30`
            }}>
              <stat.icon size={20} color={stat.color} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabClick(t.id)}
            style={{
              padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              fontWeight: activeTab === t.id ? 600 : 500, fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {activeTab === 'users' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="primary" style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '0.2em 0.5em', borderRadius: 4,
                      background: u.role === 'ADMIN' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                      color: u.role === 'ADMIN' ? '#ef4444' : '#6366f1', border: `1px solid ${u.role === 'ADMIN' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.is_active ? (
                      <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 500 }}>Active</span>
                    ) : (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 500 }}>Inactive</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'issues' && (
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
              {issues.map(ui => {
                const colors = {
                  'Critical': { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
                  'High': { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)' },
                  'Medium': { color: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.3)' },
                  'Low': { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)' }
                }
                const sevCfg = colors[ui.severity] || {}
                return (
                  <tr key={ui.id}>
                    <td className="primary">
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{ui.title}</div>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ui.location}</td>
                    <td>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                        color: sevCfg.color, background: sevCfg.bg, border: `1px solid ${sevCfg.border}`,
                        borderRadius: 4, padding: '0.12em 0.5em',
                      }}>{ui.severity?.toUpperCase()}</span>
                    </td>
                    <td style={{ fontSize: '0.75rem', fontWeight: 500, color: ui.status === 'Open' ? '#6366f1' : 'var(--text-muted)' }}>{ui.status}</td>
                    <td>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.1)',
                        border: '1px solid rgba(167,139,250,0.3)', borderRadius: 4, padding: '0.15em 0.55em',
                      }}>User Report</span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={11} /> {new Date(ui.created_at).toLocaleDateString()}</div>
                    </td>
                    <td>
                      <Link to={`/issues/${ui.id}`} className="btn-secondary" style={{ textDecoration: 'none', fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}>
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {issues.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No user issues reported yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
