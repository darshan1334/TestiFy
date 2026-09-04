import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart2, TrendingUp, Bug, Globe, Activity } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts'
import { sessionsApi } from '../services/api'

const SEV_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#60a5fa'
}

const CAT_COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f97316', '#eab308', '#a78bfa', '#ec4899', '#14b8a6']
const CATEGORIES = ['broken_link', 'js_error', 'accessibility', 'performance', 'form', 'navigation', 'ui', 'api', 'other']

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: '0.76rem',
    color: 'var(--text-primary)',
  },
  cursor: { fill: 'rgba(99,102,241,0.05)' },
}

export default function AnalyticsPage() {
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    sessionsApi.list()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const completed = sessions.filter(s => s.status === 'completed')

  // Summary stats
  const summary = useMemo(() => ({
    totalTests:  sessions.length,
    avgIssues:   completed.length ? Math.round(completed.reduce((a, s) => a + s.total_issues, 0) / completed.length) : 0,
    totalBugs:   sessions.reduce((a, s) => a + (s.total_issues || 0), 0),
    totalPages:  sessions.reduce((a, s) => a + (s.pages_crawled || 0), 0),
    avgPerf:     completed.filter(s => s.performance_score).length
                   ? Math.round(completed.filter(s => s.performance_score).reduce((a, s) => a + s.performance_score, 0) / completed.filter(s => s.performance_score).length)
                   : null,
    avgA11y:     completed.filter(s => s.accessibility_score).length
                   ? Math.round(completed.filter(s => s.accessibility_score).reduce((a, s) => a + s.accessibility_score, 0) / completed.filter(s => s.accessibility_score).length)
                   : null,
  }), [sessions, completed])

  // Line chart: issues over time
  const lineData = useMemo(() => {
    return [...completed].reverse().slice(-15).map((s, i) => ({
      name: `#${i + 1}`,
      issues: s.total_issues || 0,
      pages:  s.pages_crawled || 0,
    }))
  }, [completed])

  // Severity pie
  const sevPie = useMemo(() => {
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

  // Health distribution bar
  const healthBar = useMemo(() => {
    const counts = { Good: 0, Fair: 0, Poor: 0, Critical: 0 }
    completed.forEach(s => { if (s.overall_health && counts[s.overall_health] !== undefined) counts[s.overall_health]++ })
    return Object.entries(counts).map(([k, v]) => ({ name: k, value: v }))
  }, [completed])

  if (loading) {
    return (
      <div className="fade-in">
        <div className="page-header"><h1 className="page-title">Analytics</h1></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 90 }} />)}
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="fade-in">
        <div className="page-header"><h1 className="page-title">Analytics</h1><p className="page-subtitle">Trends and insights across all test sessions</p></div>
        <div className="empty-state">
          <BarChart2 size={52} className="empty-state-icon" />
          <h3>No data yet</h3>
          <p><Link to="/new-test" style={{ color: '#a78bfa' }}>Run your first test to see analytics →</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Analytics</h1><p className="page-subtitle">{sessions.length} sessions · {completed.length} completed</p></div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Tests',   value: summary.totalTests, color: '#a78bfa', icon: Activity },
          { label: 'Avg Issues',    value: summary.avgIssues,  color: '#f97316', icon: Bug },
          { label: 'Total Bugs',    value: summary.totalBugs,  color: '#ef4444', icon: Bug },
          { label: 'Pages Scanned', value: summary.totalPages, color: '#0ea5e9', icon: Globe },
          ...(summary.avgPerf !== null ? [{ label: 'Avg Performance', value: `${summary.avgPerf}`, color: '#22c55e', icon: TrendingUp }] : []),
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-icon" style={{ background: `${color}15` }}><Icon size={17} color={color} /></div>
            <div className="stat-card-value" style={{ color }}>{value}</div>
            <div className="stat-card-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Line: issues over time */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>Issues Over Time</h3>
          {lineData.length < 2 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem' }}>Need more sessions for trend data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="issues" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} name="Issues" />
                <Line type="monotone" dataKey="pages"  stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 3 }} name="Pages" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie: severity distribution */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>Severity Distribution</h3>
          {sevPie.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem' }}>No issues recorded</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sevPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {sevPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.72rem' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Health distribution */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
          Session Health Distribution
        </h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={healthBar} barSize={40}>
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="value" name="Sessions" radius={[6, 6, 0, 0]}>
              {healthBar.map((entry, i) => (
                <Cell key={i} fill={{ Good: '#22c55e', Fair: '#eab308', Poor: '#f97316', Critical: '#ef4444' }[entry.name] || '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
