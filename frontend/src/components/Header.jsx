import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Wifi, WifiOff, User } from 'lucide-react'
import { checkHealth } from '../services/api'

const PAGE_TITLES = {
  '/':          { title: 'Dashboard',    sub: 'Overview of your QA activity' },
  '/new-test':  { title: 'New Test',     sub: 'Start an AI-powered test session' },
  '/history':   { title: 'Test History', sub: 'All previous test sessions' },
  '/results':   { title: 'Test Results', sub: 'Detailed test results' },
  '/bugs':      { title: 'Bugs',         sub: 'Detected issues and bugs' },
  '/analytics': { title: 'Analytics',    sub: 'Trends and insights' },
  '/reports':   { title: 'Reports',      sub: 'Generated reports' },
  '/settings':  { title: 'Settings',     sub: 'App configuration' },
}

export default function Header() {
  const { pathname } = useLocation()
  const [online, setOnline] = useState(null) // null = checking

  // derive page title
  let meta = PAGE_TITLES[pathname]
  if (!meta) {
    // match /results/:id, /bugs/:id, /report/:id
    const base = '/' + pathname.split('/')[1]
    meta = PAGE_TITLES[base] || { title: 'TestiFy', sub: '' }
  }

  useEffect(() => {
    let alive = true
    async function check() {
      try {
        await checkHealth()
        if (alive) setOnline(true)
      } catch {
        if (alive) setOnline(false)
      }
    }
    check()
    const id = setInterval(check, 30000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return (
    <header className="top-header">
      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
          {meta.title}
        </div>
        {meta.sub && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {meta.sub}
          </div>
        )}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        {/* Backend status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          padding: '0.3rem 0.75rem',
          background: 'rgba(15,20,32,0.6)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          fontSize: '0.72rem',
          color: online === null ? 'var(--text-muted)' : online ? '#22c55e' : 'var(--critical)',
        }}>
          {online === null ? (
            <span className="status-dot pending" />
          ) : online ? (
            <Wifi size={11} />
          ) : (
            <WifiOff size={11} />
          )}
          {online === null ? 'Checking…' : online ? 'API Online' : 'API Offline'}
        </div>

        {/* User avatar placeholder */}
        <div style={{
          width: 32, height: 32,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(99,102,241,0.3)',
          cursor: 'pointer',
        }}>
          <User size={15} color="white" />
        </div>
      </div>
    </header>
  )
}
