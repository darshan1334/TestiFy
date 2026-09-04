import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Download, FileText, FileJson } from 'lucide-react'
import { sessionsApi, reportsApi } from '../services/api'
import ResultsPanel from '../components/ResultsPanel'
import StatsBar from '../components/StatsBar'

export default function ReportPage() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await sessionsApi.get(sessionId)
      setSession(data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [sessionId])

  if (loading) return (
    <div className="empty-state">
      <div className="skeleton" style={{ width: 200, height: 20, margin: '0 auto 0.75rem' }} />
      <div className="skeleton" style={{ width: 120, height: 16, margin: '0 auto' }} />
    </div>
  )

  if (error) return (
    <div className="empty-state">
      <h3 style={{ color: 'var(--critical)', marginBottom: '0.5rem' }}>Error</h3>
      <p>{error}</p>
      <Link to="/reports" style={{ color: '#a78bfa', marginTop: '1rem', display: 'inline-block' }}>← Back to Reports</Link>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <Link to="/reports" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontSize: '0.8rem' }}>
              <ArrowLeft size={13} /> Reports
            </Link>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.1rem' }}>{session?.url}</h1>
          <p className="page-subtitle">Session {sessionId?.slice(0, 8)}…</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={load} className="btn-secondary">
            <RefreshCw size={13} /> Refresh
          </button>
          <a href={reportsApi.htmlUrl(sessionId)} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ textDecoration: 'none' }}>
            <FileText size={13} /> HTML
          </a>
          <a href={reportsApi.pdfUrl(sessionId)} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ textDecoration: 'none' }}>
            <Download size={13} /> PDF
          </a>
          <a href={reportsApi.jsonUrl(sessionId)} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ textDecoration: 'none' }}>
            <FileJson size={13} /> JSON
          </a>
        </div>
      </div>

      {session && <ResultsPanel session={session} />}
    </div>
  )
}
