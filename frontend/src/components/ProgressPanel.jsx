import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

const PHASE_LABELS = {
  initialising:      'Initialising',
  exploring:         'Crawling Website',
  analysing:         'Classifying Issues',
  ai_analysis:       'AI Analysis (Gemini)',
  generating_report: 'Generating Report',
  completed:         'Complete',
  failed:            'Failed',
}

const PHASES_ORDER = ['initialising', 'exploring', 'analysing', 'ai_analysis', 'generating_report', 'completed']

export default function ProgressPanel({ phase, message, progress, status }) {
  const currentIndex = PHASES_ORDER.indexOf(phase)

  return (
    <div className="glass-card fade-in" style={{ padding: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Test Progress
        </h3>
        <span style={{
          fontSize: '0.8rem', fontWeight: 700,
          color: status === 'failed' ? 'var(--critical)' : status === 'completed' ? 'var(--low)' : '#a78bfa',
        }}>
          {progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar" style={{ marginBottom: '1.5rem' }}>
        <div
          className="progress-fill"
          style={{
            width: `${progress}%`,
            background: status === 'failed'
              ? 'var(--critical)'
              : status === 'completed'
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : 'linear-gradient(90deg, #6366f1, #a78bfa)',
          }}
        />
      </div>

      {/* Phase steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {PHASES_ORDER.filter(p => p !== 'completed').map((p, i) => {
          const isDone = currentIndex > i || status === 'completed'
          const isCurrent = currentIndex === i && status === 'running'
          return (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? 'rgba(34,197,94,0.15)' : isCurrent ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isDone ? 'rgba(34,197,94,0.4)' : isCurrent ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                transition: 'all 0.3s',
              }}>
                {isDone ? (
                  <CheckCircle size={12} color="#22c55e" />
                ) : isCurrent ? (
                  <Loader2 size={12} color="#a78bfa" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)' }} />
                )}
              </div>
              <span style={{
                fontSize: '0.82rem',
                color: isDone ? '#22c55e' : isCurrent ? '#a78bfa' : 'var(--text-muted)',
                fontWeight: isCurrent ? 600 : 400,
                transition: 'color 0.3s',
              }}>
                {PHASE_LABELS[p]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Current message */}
      <div style={{
        padding: '0.75rem 1rem',
        background: status === 'failed' ? 'rgba(239,68,68,0.05)' : 'rgba(99,102,241,0.05)',
        border: `1px solid ${status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.15)'}`,
        borderRadius: 8,
        fontSize: '0.8rem',
        color: status === 'failed' ? 'var(--critical)' : 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        {status === 'failed' ? <XCircle size={12} style={{ display: 'inline', marginRight: 6 }} /> : null}
        {message || 'Waiting…'}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
