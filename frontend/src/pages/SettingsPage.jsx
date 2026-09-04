import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon, Shield, Cpu, Bell, Globe,
  Sliders, Save, RefreshCw, Check, Sparkles, Terminal
} from 'lucide-react'
import { checkHealth } from '../services/api'

export default function SettingsPage() {
  const [health, setHealth] = useState(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [saved, setSaved] = useState(false)

  // Config state (stored locally in client for persistence/customization)
  const [activeTab, setActiveTab] = useState('general')
  const [config, setConfig] = useState({
    defaultBrowser: 'Chromium',
    defaultDepth: 5,
    concurrency: 2,
    timeoutSec: 30,
    enableAccessibility: true,
    enablePerformance: true,
    enableApiTesting: false,
    enableVisualDiff: false,
    geminiModel: 'gemini-1.5-pro',
    temperature: 0.2,
    webhookUrl: '',
    autoExportReport: true,
    themePreset: 'dark-violet',
  })

  async function fetchHealth() {
    setLoadingHealth(true)
    try {
      const data = await checkHealth()
      setHealth(data)
    } catch (e) {
      setHealth({ status: 'offline', error: e.message })
    } finally {
      setLoadingHealth(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const savedConf = localStorage.getItem('testify_settings')
    if (savedConf) {
      try {
        setConfig(prev => ({ ...prev, ...JSON.parse(savedConf) }))
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  function handleSave(e) {
    e.preventDefault()
    localStorage.setItem('testify_settings', JSON.stringify(config))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="fade-in" style={{ maxWidth: 880, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure AI Agent defaults, Playwright execution, and system preferences</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary"
          style={{ padding: '0.6rem 1.25rem' }}
        >
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: '1.5rem', width: 'fit-content' }}>
        {[
          { id: 'general', label: 'General & Runner', icon: Sliders },
          { id: 'ai', label: 'AI Agent & LLM', icon: Cpu },
          { id: 'system', label: 'Backend & Status', icon: Terminal },
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <form onSubmit={handleSave}>
        {/* TAB 1: General & Runner */}
        {activeTab === 'general' && (
          <div className="glass-card fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Testing Execution Defaults
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Set default parameters used when initiating automated browser crawling sessions.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Default Browser Engine
                </label>
                <select
                  className="select-field"
                  style={{ width: '100%' }}
                  value={config.defaultBrowser}
                  onChange={e => setConfig({ ...config, defaultBrowser: e.target.value })}
                >
                  <option value="Chromium">Chromium (Google Chrome / Edge)</option>
                  <option value="Firefox">Mozilla Firefox</option>
                  <option value="WebKit">WebKit (Safari Engine)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Default Max Pages: <span style={{ color: '#a78bfa' }}>{config.defaultDepth}</span>
                </label>
                <input
                  type="range" min={1} max={25}
                  value={config.defaultDepth}
                  onChange={e => setConfig({ ...config, defaultDepth: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#6366f1', marginTop: '0.5rem' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  <span>1 page</span><span>25 pages</span>
                </div>
              </div>
            </div>

            <hr />

            <div>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Default Autonomous Modules
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { key: 'enableAccessibility', label: 'WCAG 2.1 Accessibility Suite', sub: 'Runs Axe-core & structural ARIA analysis' },
                  { key: 'enablePerformance', label: 'Performance & Web Vitals', sub: 'Measures LCP, FID, CLS and network waterfall' },
                  { key: 'enableApiTesting', label: 'Network Interception & API Watcher', sub: 'Tracks broken 4xx/5xx requests and failed CORS' },
                  { key: 'enableVisualDiff', label: 'Visual Layout Consistency', sub: 'Detects overlapping DOM elements and viewport overflow' },
                ].map(mod => (
                  <label
                    key={mod.key}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.85rem 1rem', background: 'rgba(15,20,32,0.5)',
                      border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>{mod.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{mod.sub}</div>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={config[mod.key]}
                        onChange={e => setConfig({ ...config, [mod.key]: e.target.checked })}
                      />
                      <span className="toggle-track" />
                      <span className="toggle-thumb" />
                    </label>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI Agent & LLM */}
        {activeTab === 'ai' && (
          <div className="glass-card fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Gemini Cognitive Engine
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                The AI Agent uses Google Gemini for autonomous DOM synthesis, root cause analysis, and severity classification.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Model Version
                </label>
                <select
                  className="select-field"
                  style={{ width: '100%' }}
                  value={config.geminiModel}
                  onChange={e => setConfig({ ...config, geminiModel: e.target.value })}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra Fast & Efficient)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Code Reasoning)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Default Standard)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Sampling Temperature: <span style={{ color: '#a78bfa' }}>{config.temperature}</span>
                </label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={config.temperature}
                  onChange={e => setConfig({ ...config, temperature: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#6366f1', marginTop: '0.5rem' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  <span>0.0 (Deterministic)</span><span>1.0 (Creative)</span>
                </div>
              </div>
            </div>

            <div style={{
              padding: '1rem',
              borderRadius: 10,
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
            }}>
              <Sparkles size={18} color="#a78bfa" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.78rem', color: '#c4b5fd', lineHeight: 1.6 }}>
                <strong>Security Notice:</strong> The Google Gemini API Key is maintained securely in the backend server environment (`.env`). The client never exposes raw credentials.
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Backend & Status */}
        {activeTab === 'system' && (
          <div className="glass-card fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Backend Server Diagnostics
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Real-time connectivity and service health with FastAPI backend.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchHealth}
                disabled={loadingHealth}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem' }}
              >
                <RefreshCw size={13} className={loadingHealth ? 'spin' : ''} />
                Refresh Status
              </button>
            </div>

            <div style={{
              background: 'rgba(15,20,32,0.6)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Service Status</div>
                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: health?.status === 'ok' ? '#22c55e' : 'var(--critical)',
                  marginTop: '0.2rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem'
                }}>
                  <span className={`status-dot ${health?.status === 'ok' ? 'online' : 'offline'}`} />
                  {health?.status === 'ok' ? 'Active & Healthy' : 'Disconnected'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>API Version</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {health?.version || '1.0.0'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Gemini Model</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#a78bfa', marginTop: '0.2rem' }}>
                  {health?.gemini_model || 'Configured via .env'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Database Engine</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  SQLite (Async SQLAlchemy)
                </div>
              </div>
            </div>

            <hr />

            <div>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Webhook Alert Integration
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Receive immediate Slack / Discord alerts when critical severity regressions are detected.
              </p>
              <input
                type="url"
                className="input-field"
                placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
                value={config.webhookUrl}
                onChange={e => setConfig({ ...config, webhookUrl: e.target.value })}
              />
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
