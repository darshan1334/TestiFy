import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, Upload, X, FileText,
  AlignLeft, MapPin, Gauge, Image, Send, Loader2
} from 'lucide-react'
import { issuesApi } from '../services/api'

const LOCATIONS = [
  'Dashboard',
  'New Test',
  'Test History',
  'Test Results',
  'Bugs',
  'Analytics',
  'Reports',
  'Security Scan',
  'Settings',
  'Other',
]

const SEVERITIES = [
  { value: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
  { value: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)' },
  { value: 'Medium',   color: '#eab308', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.3)' },
  { value: 'Low',      color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)' },
]

function FormField({ label, required, hint, error, children }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label style={{
        display: 'block',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: '0.4rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label}
        {required && (
          <span style={{ color: '#ef4444', marginLeft: '0.3rem' }}>*</span>
        )}
        {hint && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 400, marginLeft: '0.5rem', textTransform: 'none', letterSpacing: 0 }}>
            {hint}
          </span>
        )}
      </label>
      {children}
      {error && (
        <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <AlertTriangle size={11} />
          {error}
        </div>
      )}
    </div>
  )
}

export default function ReportIssuePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    severity: '',
  })
  const [screenshot, setScreenshot] = useState(null)
  const [screenshotPreview, setScreenshotPreview] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [globalError, setGlobalError] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors(fe => ({ ...fe, [name]: undefined }))
    }
  }

  function handleScreenshotSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      setFieldErrors(fe => ({ ...fe, screenshot: 'Only image files (JPG, PNG, GIF, WebP, BMP, SVG) are allowed.' }))
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setFieldErrors(fe => ({ ...fe, screenshot: 'Screenshot must be 10 MB or smaller.' }))
      return
    }

    setScreenshot(file)
    const reader = new FileReader()
    reader.onload = ev => setScreenshotPreview(ev.target.result)
    reader.readAsDataURL(file)
    if (fieldErrors.screenshot) {
      setFieldErrors(fe => ({ ...fe, screenshot: undefined }))
    }
  }

  function removeScreenshot() {
    setScreenshot(null)
    setScreenshotPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function validate() {
    const errs = {}
    if (!form.title.trim()) {
      errs.title = 'Issue Title is required.'
    } else if (form.title.trim().length > 500) {
      errs.title = 'Issue Title must be 500 characters or fewer.'
    }

    if (!form.description.trim()) {
      errs.description = 'Issue Description is required.'
    }

    if (!form.location) {
      errs.location = 'Please select where the issue occurred.'
    }

    if (!form.severity) {
      errs.severity = 'Please select a severity level.'
    }

    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setGlobalError(null)

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title.trim())
      fd.append('description', form.description.trim())
      fd.append('location', form.location)
      fd.append('severity', form.severity)
      if (screenshot) {
        fd.append('screenshot', screenshot)
      }

      const result = await issuesApi.create(fd)
      setSubmitted(result)
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (detail && typeof detail === 'object') {
        setFieldErrors(detail)
      } else {
        setGlobalError(
          typeof detail === 'string'
            ? detail
            : 'Failed to submit issue. Please check your inputs and try again.'
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setSubmitted(null)
    setForm({ title: '', description: '', location: '', severity: '' })
    setScreenshot(null)
    setScreenshotPreview(null)
    setFieldErrors({})
    setGlobalError(null)
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="fade-in" style={{ maxWidth: 560, margin: '0 auto', paddingTop: '2rem' }}>
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem',
          }}>
            <CheckCircle2 size={32} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Issue Submitted Successfully
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.7 }}>
            Your issue report has been recorded. It is identified with source <strong>User Report</strong> and will be reviewed by an administrator.
          </p>
          <div style={{
            background: 'rgba(15,20,32,0.6)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.72rem',
            color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace',
            marginBottom: '1.5rem', textAlign: 'left',
          }}>
            Issue ID: {submitted.id}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              id="view-issue-btn"
              className="btn-primary"
              onClick={() => navigate(`/issues/${submitted.id}`)}
            >
              View Issue Details
            </button>
            <button
              id="report-another-btn"
              className="btn-secondary"
              onClick={handleReset}
            >
              Report Another Issue
            </button>
          </div>
        </div>
      </div>
    )
  }

  const selSev = SEVERITIES.find(s => s.value === form.severity)

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Report an Issue</h1>
          <p className="page-subtitle">Report a problem, bug, or unexpected behavior encountered inside TestiFy</p>
        </div>
      </div>

      {/* Global error banner */}
      {globalError && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          fontSize: '0.82rem', color: '#fca5a5',
        }}>
          <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
          {globalError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="glass-card" style={{ padding: '1.75rem 2rem' }}>

          {/* 1. Issue Title */}
          <FormField
            label="Issue Title"
            required
            hint="e.g. Test execution is stuck"
            error={fieldErrors.title}
          >
            <div style={{ position: 'relative' }}>
              <FileText size={15} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
              <input
                id="field-issue-title"
                type="text"
                name="title"
                className="input-field"
                style={{ paddingLeft: '2.25rem', borderColor: fieldErrors.title ? '#ef4444' : undefined }}
                placeholder="e.g. Test execution is stuck"
                value={form.title}
                onChange={handleChange}
                maxLength={500}
                disabled={submitting}
              />
            </div>
          </FormField>

          {/* 2. Issue Description */}
          <FormField
            label="Issue Description"
            required
            hint="e.g. The test execution remains on the loading screen and does not complete."
            error={fieldErrors.description}
          >
            <div style={{ position: 'relative' }}>
              <AlignLeft size={15} style={{
                position: 'absolute', left: 12, top: 13,
                color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
              <textarea
                id="field-description"
                name="description"
                className="input-field"
                style={{
                  paddingLeft: '2.25rem', minHeight: 120, resize: 'vertical',
                  borderColor: fieldErrors.description ? '#ef4444' : undefined,
                }}
                placeholder="Describe the issue in detail — what happened, steps to reproduce, or any error messages displayed…"
                value={form.description}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>
          </FormField>

          {/* 3 & 4. Where did the issue occur? + Severity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

            {/* 3. Where did the issue occur? */}
            <FormField
              label="Where did the issue occur?"
              required
              error={fieldErrors.location}
            >
              <div style={{ position: 'relative' }}>
                <MapPin size={15} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1,
                }} />
                <select
                  id="field-location"
                  name="location"
                  className="input-field select-field"
                  style={{
                    paddingLeft: '2.25rem',
                    borderColor: fieldErrors.location ? '#ef4444' : undefined,
                    appearance: 'none',
                  }}
                  value={form.location}
                  onChange={handleChange}
                  disabled={submitting}
                >
                  <option value="">Select location…</option>
                  {LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </FormField>

            {/* 4. Severity */}
            <FormField
              label="Severity"
              required
              error={fieldErrors.severity}
            >
              <div style={{ position: 'relative' }}>
                <Gauge size={15} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: selSev?.color || 'var(--text-muted)', pointerEvents: 'none', zIndex: 1,
                }} />
                <select
                  id="field-severity"
                  name="severity"
                  className="input-field select-field"
                  style={{
                    paddingLeft: '2.25rem',
                    borderColor: selSev ? selSev.border : (fieldErrors.severity ? '#ef4444' : undefined),
                    color: selSev?.color || 'var(--text-primary)',
                    appearance: 'none',
                  }}
                  value={form.severity}
                  onChange={handleChange}
                  disabled={submitting}
                >
                  <option value="">Select severity…</option>
                  {SEVERITIES.map(s => (
                    <option key={s.value} value={s.value}>{s.value}</option>
                  ))}
                </select>
              </div>
            </FormField>
          </div>

          {/* 5. Screenshot / Evidence */}
          <FormField
            label="Screenshot / Evidence"
            hint="optional — JPG, PNG, GIF, WebP, BMP, SVG · max 10 MB"
            error={fieldErrors.screenshot}
          >
            {screenshotPreview ? (
              <div style={{
                position: 'relative', borderRadius: 10, overflow: 'hidden',
                border: '1px solid var(--border)', background: 'rgba(15,20,32,0.5)',
              }}>
                <img
                  src={screenshotPreview}
                  alt="Screenshot preview"
                  style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }}
                />
                <button
                  type="button"
                  onClick={removeScreenshot}
                  disabled={submitting}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'rgba(15,20,32,0.85)', border: '1px solid var(--border)',
                    borderRadius: '50%', width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-secondary)',
                  }}
                  title="Remove screenshot"
                >
                  <X size={14} />
                </button>
                <div style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.7rem', color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {screenshot?.name}
                </div>
              </div>
            ) : (
              <div
                id="screenshot-dropzone"
                style={{
                  border: `1.5px dashed ${fieldErrors.screenshot ? '#ef4444' : 'rgba(99,102,241,0.3)'}`,
                  borderRadius: 10, padding: '1.75rem 1rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                  cursor: submitting ? 'not-allowed' : 'pointer', background: 'rgba(99,102,241,0.02)',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onClick={() => { if (!submitting) fileInputRef.current?.click() }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'rgba(99,102,241,0.06)' }}
                onDragLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.02)' }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.style.background = 'rgba(99,102,241,0.02)'
                  if (submitting) return
                  const file = e.dataTransfer.files?.[0]
                  if (file) {
                    const dt = new DataTransfer()
                    dt.items.add(file)
                    if (fileInputRef.current) {
                      fileInputRef.current.files = dt.files
                      handleScreenshotSelect({ target: { files: dt.files } })
                    }
                  }
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={20} color="#a78bfa" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    Click to browse or drag and drop
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    PNG, JPG, WebP, GIF up to 10 MB
                  </div>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              id="field-screenshot"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleScreenshotSelect}
              disabled={submitting}
            />
          </FormField>

          {/* 6. Submit Button */}
          <div style={{ marginTop: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              disabled={submitting}
            >
              Clear
            </button>
            <button
              id="submit-issue-btn"
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{ minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="spinner" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send size={15} />
                  Submit Issue
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
