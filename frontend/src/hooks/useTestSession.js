/**
 * useTestSession — custom hook that manages the full test session lifecycle:
 *  1. Submit a target → create session via REST
 *  2. Connect WebSocket → stream progress updates
 *  3. Fallback poll → ensures real-time updates even during network/reconnects
 *  4. On completion → fetch full session data (issues, summary)
 *
 * A target is a website URL, a public Git repository, or an uploaded project
 * ZIP. All three create a session the same way and are then tracked identically.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { sessionsApi, connectProgressSocket } from '../services/api'

const INITIAL_STATE = {
  sessionId: null,
  status: 'idle',      // idle | submitting | running | completed | failed
  phase: null,
  message: '',
  progress: 0,
  session: null,       // full session object with issues
  error: null,
  sourceType: 'url',   // url | github | zip
  uploadPercent: 0,    // ZIP upload progress, before the pipeline starts
}

export function useTestSession() {
  const [state, setState] = useState(INITIAL_STATE)
  const cleanupWsRef = useRef(null)
  const pollTimerRef = useRef(null)
  const isCompletedRef = useRef(false)

  const updateState = useCallback((patch) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  const stopAll = useCallback(() => {
    if (cleanupWsRef.current) {
      try { cleanupWsRef.current() } catch (e) {}
      cleanupWsRef.current = null
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const finishSession = useCallback(async (sessionId) => {
    if (isCompletedRef.current) return
    isCompletedRef.current = true
    stopAll()

    try {
      const fullSession = await sessionsApi.get(sessionId)
      updateState({
        status: 'completed',
        phase: 'completed',
        progress: 100,
        message: 'Testing complete!',
        session: fullSession,
      })
    } catch (e) {
      updateState({ status: 'completed', phase: 'completed', progress: 100 })
    }
  }, [stopAll, updateState])

  /**
   * Shared lifecycle for every intake: create the session, then stream its
   * progress over a WebSocket with a polling safety net behind it.
   */
  const beginSession = useCallback(async (createSession, sourceType, submittingMessage) => {
    stopAll()
    isCompletedRef.current = false

    updateState({ ...INITIAL_STATE, status: 'submitting', sourceType, message: submittingMessage })

    try {
      const { id: sessionId } = await createSession()
      updateState({
        sessionId,
        status: 'running',
        phase: 'initialising',
        progress: 5,
        uploadPercent: 100,
        message: 'Session created. Launching AI agent…',
      })

      // 1. Connect WebSocket for instant streaming
      cleanupWsRef.current = connectProgressSocket(sessionId, async (msg) => {
        if (msg.type === 'progress') {
          updateState({
            phase: msg.phase,
            message: msg.message,
            progress: msg.progress,
          })

          if (msg.phase === 'completed') {
            await finishSession(sessionId)
          } else if (msg.phase === 'failed') {
            stopAll()
            updateState({ status: 'failed', phase: 'failed', error: msg.message })
          }
        }
      })

      // 2. Resilient status polling safety net every 2.5s
      pollTimerRef.current = setInterval(async () => {
        if (isCompletedRef.current) return
        try {
          const sess = await sessionsApi.get(sessionId)
          if (sess) {
            if (sess.status === 'completed') {
              await finishSession(sessionId)
            } else if (sess.status === 'failed') {
              stopAll()
              updateState({ status: 'failed', phase: 'failed', error: 'Testing failed' })
            }
          }
        } catch (e) {
          // ignore transient poll errors
        }
      }, 2500)

    } catch (err) {
      stopAll()
      updateState({
        status: 'failed',
        phase: 'failed',
        error: err?.response?.data?.detail || err.message || 'Failed to start session',
      })
    }
  }, [finishSession, stopAll, updateState])

  /** Start a session against a live website URL. */
  const startTest = useCallback((url, maxPages = 5) => (
    beginSession(() => sessionsApi.create(url, maxPages), 'url', 'Creating session…')
  ), [beginSession])

  /** Start a session against a public Git repository. */
  const startGithubTest = useCallback((repoUrl) => (
    beginSession(
      () => sessionsApi.createFromGithub(repoUrl),
      'github',
      'Cloning repository…',
    )
  ), [beginSession])

  /** Start a session against an uploaded project ZIP. */
  const startZipTest = useCallback((file) => (
    beginSession(
      () => sessionsApi.createFromZip(file, (evt) => {
        if (evt.total) {
          updateState({ uploadPercent: Math.round((evt.loaded / evt.total) * 100) })
        }
      }),
      'zip',
      'Uploading project archive…',
    )
  ), [beginSession, updateState])

  const reset = useCallback(() => {
    stopAll()
    isCompletedRef.current = false
    setState(INITIAL_STATE)
  }, [stopAll])

  useEffect(() => {
    return () => stopAll()
  }, [stopAll])

  return { ...state, startTest, startGithubTest, startZipTest, reset }
}
