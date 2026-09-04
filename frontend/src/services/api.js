/**
 * API service layer — all backend communication lives here.
 * Gemini API key is NEVER sent from frontend.
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessionsApi = {
  /** Create a new test session from a website URL and start the pipeline */
  create: (url, maxPages = 5) =>
    api.post('/sessions', { url, max_pages: maxPages }).then(r => r.data),

  /** Create a session from a public Git repository — cloned and analysed server-side */
  createFromGithub: (repoUrl) =>
    api.post('/sessions/github', { repo_url: repoUrl }, { timeout: 240000 }).then(r => r.data),

  /** Create a session from an uploaded project ZIP */
  createFromZip: (file, onUploadProgress) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post('/sessions/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
        onUploadProgress,
      })
      .then(r => r.data)
  },

  /** Get all sessions */
  list: () => api.get('/sessions').then(r => r.data),

  /** Get one session with all issues */
  get: (sessionId) => api.get(`/sessions/${sessionId}`).then(r => r.data),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  htmlUrl:  (sessionId) => `/api/reports/${sessionId}/html`,
  jsonUrl:  (sessionId) => `/api/reports/${sessionId}/json`,
  pdfUrl:   (sessionId) => `/api/reports/${sessionId}/pdf`,
}

// ── Health ────────────────────────────────────────────────────────────────────
export const checkHealth = () => api.get('/health').then(r => r.data)

// ── WebSocket helper ──────────────────────────────────────────────────────────
/**
 * Open a WebSocket connection to stream live progress for a session.
 * @param {string} sessionId
 * @param {(msg: object) => void} onMessage
 * @returns {() => void} cleanup function
 */
export function connectProgressSocket(sessionId, onMessage) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  const ws = new WebSocket(`${protocol}://${host}/api/sessions/ws/${sessionId}`)

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (e) {
      console.warn('WS parse error', e)
    }
  }

  ws.onerror = (e) => console.error('WebSocket error', e)

  return () => {
    if (ws.readyState === WebSocket.OPEN) ws.close()
  }
}

// ── User Issue Reports ────────────────────────────────────────────────────────
export const issuesApi = {
  /**
   * Submit a new user issue report (multipart/form-data with optional screenshot).
   * @param {FormData} formData
   */
  create: (formData) =>
    api.post('/issues', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }).then(r => r.data),

  /** List all user-submitted issue reports */
  list: () => api.get('/issues').then(r => r.data),

  /** Get a single user-submitted issue report by ID */
  get: (issueId) => api.get(`/issues/${issueId}`).then(r => r.data),
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data).then(r => r.data),
  login: (data) => api.post('/auth/login', data).then(r => r.data),
  adminLogin: (data) => api.post('/auth/admin-login', data).then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
}

// ── Admin ──────────────────────────────────────────────────────────────────────
export const adminApi = {
  getUsers: () => api.get('/admin/users').then(r => r.data),
  getIssues: () => api.get('/admin/issues').then(r => r.data),
  getStats: () => api.get('/admin/stats').then(r => r.data),
}

export default api
