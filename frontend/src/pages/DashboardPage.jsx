import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  TestTube2, CheckCircle2, XCircle, Bug, AlertOctagon, Globe,
  TrendingUp, Clock, ExternalLink, Activity, ArrowRight, MessageSquareWarning
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { sessionsApi, issuesApi } from '../services/api'

const SEV_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#60a5fa'
}

const STATUS_CFG = {
  completed: { label: 'Completed', color: '#22c55e', cls: 'badge-passed' },
  running:   { label: 'Running',   color: '#a78bfa', cls: 'badge-running' },
  pending:   { label: 'Pending',   color: '#eab308', cls: 'badge-pending' },
  failed:    { label: 'Failed',    color: '#ef4444', cls: 'badge-failed' },
}

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="stat-card fade-in">
      <div className="stat-card-icon" style={{ background: `${color}15` }}>
        <Icon size={18} color={color} />
      </div>
      <div className="stat-card-value" style={{ color }}>{value ?? '—'}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [userIssueCount, setUserIssueCount] = useState(null)

  useEffect(() => {
    sessionsApi.list()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    issuesApi.list()
      .then(issues => setUserIssueCount(issues.length))
      .catch(() => setUserIssueCount(0))
  }, [])

  const stats = useMemo(() => {
    const total = sessions.length
    const passed = sessions.filter(s => s.status === 'completed' && s.total_issues === 0).length
    const failed = sessions.filter(s => s.status === 'failed').length
    const bugs = sessions.reduce((a, s) => a + (s.total_issues || 0), 0)
    const critical = sessions.reduce((a, s) => a + (s.critical_issues || 0), 0)
    const pages = sessions.reduce((a, s) => a + (s.pages_crawled || 0), 0)
    return { total, passed, failed, bugs, critical, pages }
  }, [sessions])

  // Bar chart data — last 10 sessions
  const barData = useMemo(() => {
    return sessions.slice(0, 10).reverse().map((s, i) => ({
      name: `#${i + 1}`,
      issues: s.total_issues || 0,
      pages: s.pages_crawled || 0,
    }))
  }, [sessions])

  // Pie chart data — issue severity
  const pieData = useMemo(() => {
    const totals = { critical: 0, high: 0, medium: 0, low: 0 }
    sessions.forEach(s => {
      totals.critical += s.critical_issues || 0
      totals.high     += s.high_issues     || 0
      totals.medium   += s.medium_issues   || 0
      totals.low      += s.low_issues      || 0
    })
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: SEV_COLORS[k] }))
  }, [sessions])

  // Latest issues from most recent completed session
  const [latestSession, setLatestSession] = useState(null)
  useEffect(() => {
    const recent = sessions.find(s => s.status === 'completed')
    if (recent) {
      sessionsApi.get(recent.id)
        .then(setLatestSession)
        .catch(() => {})
    }
  }, [sessions])

  const recentSessions = sessions.slice(0, 5)

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Loading your QA activity…</p>
          </div>
        </div>
        <div className="stats-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card"><div className="skeleton" style={{ height: 60 }} /></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{sessions.length} test sessions recorded</p>
        </div>
        <Link to="/new-test" className="btn-primary" style={{ textDecoration: 'none' }}>
          <TestTube2 size={15} /> New Test
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        <StatCard icon={TestTube2}    label="Total Tests"           value={stats.total}          color="#a78bfa" />
        <StatCard icon={CheckCircle2} label="Passed"                value={stats.passed}         color="#22c55e" />
        <StatCard icon={XCircle}      label="Failed"                value={stats.failed}         color="#ef4444" />
        <StatCard icon={Bug}          label="Bugs Found"            value={stats.bugs}           color="#f97316" />
        <StatCard icon={AlertOctagon} label="Critical Issues"       value={stats.critical}       color="#ef4444" />
        <StatCard icon={Globe}        label="Pages Explored"        value={stats.pages}          color="#60a5fa" />
        <StatCard icon={MessageSquareWarning} label="User Reported Issues" value={userIssueCount ?? '—'} color="#a78bfa" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1rem', marginBottom: '1.25rem' }}>
        {/* Bar chart */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
            Issues per Session
          </h3>
          {barData.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <TrendingUp size={32} className="empty-state-icon" />
              <p>Run tests to see charts</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={14}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.78rem' }}
                  cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                />
                <Bar dataKey="issues" fill="#6366f1" radius={[4,4,0,0]} name="Issues" />
                <Bar dataKey="pages"  fill="#0ea5e9" radius={[4,4,0,0]} name="Pages" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
            Bug Severity
          </h3>
          {pieData.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <Bug size={32} className="empty-state-icon" />
              <p>No bugs found yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.78rem' }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.72rem' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Recent sessions */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Recent Activity
            </h3>
            <Link to="/history" style={{ fontSize: '0.72rem', color: '#a78bfa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {recentSessions.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <Activity size={28} className="empty-state-icon" />
              <p>No sessions yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentSessions.map(s => {
                const cfg = STATUS_CFG[s.status] || STATUS_CFG.pending
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 0.75rem',
                    background: 'rgba(15,20,32,0.5)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                        {s.url}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
                        {new Date(s.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                    {s.status === 'completed' && (
                      <Link to={`/results/${s.id}`} style={{ color: 'var(--text-muted)', display: 'flex' }}>
                        <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Latest issues */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Latest Issues
            </h3>
            {latestSession && (
              <Link to={`/bugs/${latestSession.id}`} style={{ fontSize: '0.72rem', color: '#a78bfa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                View all <ArrowRight size={11} />
              </Link>
            )}
          </div>
          {!latestSession || latestSession.issues?.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <Bug size={28} className="empty-state-icon" />
              <p>No issues in latest session</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {latestSession.issues.slice(0, 5).map((issue, i) => (
                <div key={issue.id || i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.55rem 0.75rem',
                  background: 'rgba(15,20,32,0.5)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${SEV_COLORS[issue.severity] || SEV_COLORS.info}`,
                }}>
                  <span className={`badge badge-${issue.severity || 'info'}`}>{issue.severity?.toUpperCase() || 'INFO'}</span>
                  <span style={{ fontSize: '0.78rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {issue.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
