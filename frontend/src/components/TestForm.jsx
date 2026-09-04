import { useState } from 'react'
import { Search, Globe, Settings2, ChevronDown, ChevronUp } from 'lucide-react'

export default function TestForm({ onSubmit, isRunning }) {
  const [url, setUrl] = useState('')
  const [maxPages, setMaxPages] = useState(5)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [urlError, setUrlError] = useState('')

  function validateUrl(value) {
    try {
      const u = new URL(value)
      if (!['http:', 'https:'].includes(u.protocol)) return 'URL must use http or https'
      return ''
    } catch {
      return 'Please enter a valid URL (e.g. https://example.com)'
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const error = validateUrl(url)
    if (error) { setUrlError(error); return }
    setUrlError('')
    onSubmit(url.trim(), maxPages)
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Target URL
        </label>
        <div style={{ position: 'relative' }}>
          <Globe size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            id="target-url"
            type="text"
            className="input-field"
            style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
            placeholder="https://example.com"
            value={url}
            onChange={e => { setUrl(e.target.value); if (urlError) setUrlError('') }}
            disabled={isRunning}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {urlError && (
          <p style={{ color: 'var(--critical)', fontSize: '0.78rem', marginTop: '0.4rem' }}>{urlError}</p>
        )}
      </div>

      {/* Advanced options toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: '0.8rem', padding: 0, marginBottom: '1rem',
        }}
      >
        <Settings2 size={13} />
        Advanced options
        {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {showAdvanced && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(99,102,241,0.04)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Max pages to crawl: <span style={{ color: '#a78bfa' }}>{maxPages}</span>
          </label>
          <input
            type="range" min={1} max={20} value={maxPages}
            onChange={e => setMaxPages(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#6366f1' }}
            disabled={isRunning}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            <span>1 (fast)</span><span>20 (thorough)</span>
          </div>
        </div>
      )}

      <button
        id="start-test-btn"
        type="submit"
        className="btn-primary"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
        disabled={isRunning || !url}
      >
        {isRunning ? (
          <>
            <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'inline-block' }} />
            Testing in progress…
          </>
        ) : (
          <>
            <Search size={16} />
            Run AI Test
          </>
        )}
      </button>
    </form>
  )
}
