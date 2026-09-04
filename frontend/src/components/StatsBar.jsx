import { RadialBarChart, RadialBar, Cell, PieChart, Pie, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const SEV_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
}

const HEALTH_CONFIG = {
  Good:     { color: '#22c55e', emoji: '✅' },
  Fair:     { color: '#eab308', emoji: '⚠️' },
  Poor:     { color: '#f97316', emoji: '🔶' },
  Critical: { color: '#ef4444', emoji: '🔴' },
  Unknown:  { color: '#8892a4', emoji: '❓' },
}

export default function StatsBar({ session }) {
  const { overall_health, ai_summary, pages_crawled, total_issues,
          critical_issues, high_issues, medium_issues, low_issues,
          performance_score, accessibility_score } = session

  const health = HEALTH_CONFIG[overall_health] || HEALTH_CONFIG.Unknown

  const pieData = [
    { name: 'Critical', value: critical_issues, color: SEV_COLORS.critical },
    { name: 'High',     value: high_issues,     color: SEV_COLORS.high },
    { name: 'Medium',   value: medium_issues,   color: SEV_COLORS.medium },
    { name: 'Low',      value: low_issues,       color: SEV_COLORS.low },
  ].filter(d => d.value > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* AI Summary */}
      <div className="glass-card fade-in" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{health.emoji}</span>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overall Health</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: health.color }}>{overall_health}</div>
          </div>
        </div>
        {ai_summary && (
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
            {ai_summary}
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <StatCard label="Pages Crawled" value={pages_crawled} color="#a78bfa" />
        <StatCard label="Total Issues" value={total_issues} color="#f1f5f9" />
        <StatCard label="Critical" value={critical_issues} color={SEV_COLORS.critical} />
        <StatCard label="High" value={high_issues} color={SEV_COLORS.high} />
        <StatCard label="Medium" value={medium_issues} color={SEV_COLORS.medium} />
        <StatCard label="Low" value={low_issues} color={SEV_COLORS.low} />
      </div>

      {/* Score indicators */}
      {(performance_score !== null || accessibility_score !== null) && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Scores</h4>
          {performance_score !== null && (
            <ScoreRow label="Performance" value={performance_score} />
          )}
          {accessibility_score !== null && (
            <ScoreRow label="Accessibility" value={accessibility_score} />
          )}
        </div>
      )}

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Issue Breakdown</h4>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.78rem' }}
                formatter={(val, name) => [val, name]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.75rem' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value ?? 0}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.2rem' }}>{label}</div>
    </div>
  )
}

function ScoreRow({ label, value }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444'
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{pct}/100</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
