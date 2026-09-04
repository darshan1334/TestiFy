import { Zap, Shield, Activity, Globe, Brain, FileText } from 'lucide-react'
import TestForm from '../components/TestForm'
import ProgressPanel from '../components/ProgressPanel'
import ResultsPanel from '../components/ResultsPanel'
import { useTestSession } from '../hooks/useTestSession'

export default function HomePage() {
  const { status, phase, message, progress, session, error, startTest, reset } = useTestSession()

  const isRunning = status === 'running' || status === 'submitting'
  const isCompleted = status === 'completed'
  const isFailed = status === 'failed'

  return (
    <div className="grid-bg" style={{ minHeight: 'calc(100vh - 60px)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Hero section */}
        {status === 'idle' && (
          <div className="fade-in" style={{ textAlign: 'center', marginBottom: '3rem' }}>
            {/* Glow orb */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 1.5rem',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 60px rgba(99,102,241,0.5), 0 0 120px rgba(99,102,241,0.2)',
            }}>
              <Zap size={36} color="white" fill="white" />
            </div>

            <h1 className="gradient-text" style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.75rem', lineHeight: 1.1 }}>
              AI Testing Agent
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 2.5rem', lineHeight: 1.65 }}>
              Enter any URL to autonomously test for broken links, JS errors, accessibility violations, performance issues and more — powered by Gemini AI.
            </p>

            {/* Feature pills */}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
              {[
                { icon: <Globe size={13} />, label: 'Smart Crawling' },
                { icon: <Shield size={13} />, label: 'Accessibility' },
                { icon: <Activity size={13} />, label: 'Performance' },
                { icon: <Brain size={13} />, label: 'Gemini AI' },
                { icon: <FileText size={13} />, label: 'HTML Reports' },
              ].map(({ icon, label }) => (
                <span key={label} style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.9rem',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 20, fontSize: '0.78rem', color: '#a78bfa',
                }}>
                  {icon}{label}
                </span>
              ))}
            </div>

            {/* Form centered */}
            <div style={{ maxWidth: 580, margin: '0 auto' }}>
              <TestForm onSubmit={startTest} isRunning={isRunning} />
            </div>
          </div>
        )}

        {/* Running / failed state */}
        {(isRunning || isFailed) && (
          <div className="fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {isFailed ? '❌ Test Failed' : '🧪 Testing in Progress'}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {session?.url || '…'}
                </p>
              </div>
              {isFailed && (
                <button onClick={reset} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                  Try Again
                </button>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <TestForm onSubmit={startTest} isRunning={isRunning} />
            </div>

            <ProgressPanel phase={phase} message={isFailed ? error : message} progress={progress} status={status} />
          </div>
        )}

        {/* Completed state */}
        {isCompleted && session && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  ✅ Test Complete
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {session.url}
                </p>
              </div>
              <button onClick={reset} className="btn-primary" style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}>
                Test Another URL
              </button>
            </div>
            <ResultsPanel session={session} />
          </div>
        )}
      </div>
    </div>
  )
}
