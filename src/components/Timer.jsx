import { useEffect, useRef, useState } from 'react'
import './Timer.css'
import { useWakeLock } from '../lib/useWakeLock.js'
import { primeChime, playChime } from '../lib/chime.js'
import { setPendingSessionMinutes, setPendingSessionStartTime } from '../lib/storage.js'
import { toLocalTimeString } from '../lib/time.js'

const PRESET_MINUTES = [15, 20, 30]

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

function useStopwatch() {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [running, setRunning] = useState(false)
  const baseRef = useRef(0)
  const startedAtRef = useRef(null)
  // The actual wall-clock moment Start was first pressed for this session —
  // distinct from startedAtRef above, which is a running-total bookkeeping
  // timestamp that gets overwritten on every resume. This one is set once
  // and holds through pause/resume, only clearing on Reset, so a paused-
  // and-resumed session still reports its true start rather than the last
  // resume point.
  const sessionStartRef = useRef(null)

  useEffect(() => {
    if (!running) return
    startedAtRef.current = Date.now()
    const id = setInterval(() => {
      setElapsedMs(baseRef.current + (Date.now() - startedAtRef.current))
    }, 200)
    return () => clearInterval(id)
  }, [running])

  function start() {
    primeChime()
    if (sessionStartRef.current === null) {
      sessionStartRef.current = new Date()
    }
    setRunning(true)
  }

  function pause() {
    const finalElapsed = baseRef.current + (Date.now() - startedAtRef.current)
    baseRef.current = finalElapsed
    setElapsedMs(finalElapsed)
    setRunning(false)
  }

  function reset() {
    setRunning(false)
    baseRef.current = 0
    setElapsedMs(0)
    sessionStartRef.current = null
  }

  return { elapsedMs, running, start, pause, reset, startedAt: sessionStartRef.current }
}

function useCountdown(onFinish) {
  const [durationMs, setDurationMs] = useState(PRESET_MINUTES[0] * 60000)
  const [remainingMs, setRemainingMs] = useState(PRESET_MINUTES[0] * 60000)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const baseRemainingRef = useRef(PRESET_MINUTES[0] * 60000)
  const startedAtRef = useRef(null)
  // Same "true first start, survives pause/resume" tracking as the
  // stopwatch's sessionStartRef — see its comment there.
  const sessionStartRef = useRef(null)

  useEffect(() => {
    if (!running) return
    startedAtRef.current = Date.now()
    const id = setInterval(() => {
      const sinceStart = Date.now() - startedAtRef.current
      const next = Math.max(0, baseRemainingRef.current - sinceStart)
      setRemainingMs(next)
      if (next <= 0) {
        clearInterval(id)
        setRunning(false)
        setFinished(true)
        onFinish?.()
      }
    }, 200)
    return () => clearInterval(id)
  }, [running])

  function selectDuration(ms) {
    setDurationMs(ms)
    setRemainingMs(ms)
    baseRemainingRef.current = ms
    setFinished(false)
    setRunning(false)
  }

  function start() {
    if (remainingMs <= 0) return
    primeChime()
    if (sessionStartRef.current === null) {
      sessionStartRef.current = new Date()
    }
    setFinished(false)
    setRunning(true)
  }

  function pause() {
    const sinceStart = Date.now() - startedAtRef.current
    const next = Math.max(0, baseRemainingRef.current - sinceStart)
    baseRemainingRef.current = next
    setRemainingMs(next)
    setRunning(false)
  }

  function reset() {
    setRunning(false)
    setFinished(false)
    setRemainingMs(durationMs)
    baseRemainingRef.current = durationMs
    sessionStartRef.current = null
  }

  return { durationMs, remainingMs, running, finished, selectDuration, start, pause, reset, startedAt: sessionStartRef.current }
}

export default function Timer({ onNavigate }) {
  const [mode, setMode] = useState('stopwatch')
  const stopwatch = useStopwatch()
  const countdown = useCountdown(() => {
    playChime()
    navigator.vibrate?.([200, 100, 200])
  })
  const [customMinutes, setCustomMinutes] = useState('')

  useWakeLock(stopwatch.running || countdown.running)

  function logStopwatchSession() {
    const minutes = Math.max(1, Math.round(stopwatch.elapsedMs / 60000))
    setPendingSessionMinutes(minutes)
    if (stopwatch.startedAt) setPendingSessionStartTime(toLocalTimeString(stopwatch.startedAt))
    onNavigate?.('log')
  }

  function logCountdownSession() {
    const elapsedMs = countdown.durationMs - countdown.remainingMs
    const minutes = Math.max(1, Math.round(elapsedMs / 60000))
    setPendingSessionMinutes(minutes)
    if (countdown.startedAt) setPendingSessionStartTime(toLocalTimeString(countdown.startedAt))
    onNavigate?.('log')
  }

  function applyCustomDuration() {
    const value = Math.round(Number(customMinutes))
    if (!Number.isFinite(value) || value <= 0) return
    countdown.selectDuration(Math.min(value, 180) * 60000)
  }

  const countdownStarted = countdown.remainingMs < countdown.durationMs
  const countdownStoppedEarly = countdownStarted && !countdown.running && !countdown.finished

  return (
    <div className="timer-screen">
      <div className="mode-toggle" role="tablist" aria-label="Timer mode">
        <button
          role="tab"
          aria-selected={mode === 'stopwatch'}
          className={`mode-btn${mode === 'stopwatch' ? ' active' : ''}`}
          onClick={() => setMode('stopwatch')}
        >
          Stopwatch
        </button>
        <button
          role="tab"
          aria-selected={mode === 'countdown'}
          className={`mode-btn${mode === 'countdown' ? ' active' : ''}`}
          onClick={() => setMode('countdown')}
        >
          Countdown
        </button>
      </div>

      {mode === 'stopwatch' ? (
        <div className="timer-panel">
          <div className="time-display" aria-live="off">{formatTime(stopwatch.elapsedMs)}</div>

          <div className="timer-controls">
            {!stopwatch.running ? (
              <button className="control-btn primary" onClick={stopwatch.start}>
                {stopwatch.elapsedMs > 0 ? 'Resume' : 'Start'}
              </button>
            ) : (
              <button className="control-btn primary" onClick={stopwatch.pause}>
                Pause
              </button>
            )}
            <button
              className="control-btn"
              onClick={stopwatch.reset}
              disabled={stopwatch.elapsedMs === 0 && !stopwatch.running}
            >
              Reset
            </button>
          </div>

          {!stopwatch.running && stopwatch.elapsedMs > 0 && (
            <button className="log-session-btn" onClick={logStopwatchSession}>
              Log this session ({Math.max(1, Math.round(stopwatch.elapsedMs / 60000))} min)
            </button>
          )}
        </div>
      ) : (
        <div className="timer-panel">
          <div className="time-display" aria-live="polite">{formatTime(countdown.remainingMs)}</div>

          {!countdownStarted && !countdown.running && (
            <>
              <div className="preset-row">
                {PRESET_MINUTES.map((mins) => (
                  <button
                    key={mins}
                    className={`preset-btn${countdown.durationMs === mins * 60000 ? ' active' : ''}`}
                    onClick={() => countdown.selectDuration(mins * 60000)}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
              <div className="custom-row">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="180"
                  placeholder="Custom minutes"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="custom-input"
                />
                <button className="control-btn" onClick={applyCustomDuration}>
                  Set
                </button>
              </div>
            </>
          )}

          <div className="timer-controls">
            {!countdown.running ? (
              <button
                className="control-btn primary"
                onClick={countdown.start}
                disabled={countdown.remainingMs <= 0}
              >
                {countdownStarted && !countdown.finished ? 'Resume' : 'Start'}
              </button>
            ) : (
              <button className="control-btn primary" onClick={countdown.pause}>
                Pause
              </button>
            )}
            <button
              className="control-btn"
              onClick={countdown.reset}
              disabled={!countdownStarted && !countdown.running}
            >
              Reset
            </button>
          </div>

          {countdown.finished && (
            <p className="finish-message">Session complete.</p>
          )}

          {(countdown.finished || countdownStoppedEarly) && (
            <button className="log-session-btn" onClick={logCountdownSession}>
              Log this session ({Math.max(1, Math.round((countdown.durationMs - countdown.remainingMs) / 60000))} min)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
