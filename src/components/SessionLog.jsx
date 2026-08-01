import { useMemo, useState } from 'react'
import './SessionLog.css'
import {
  getSessions,
  addSession,
  getPendingSessionMinutes,
  clearPendingSessionMinutes,
  getCurrentWeek,
  setCurrentWeek,
} from '../lib/storage.js'
import { scheduleSync } from '../lib/cloudSync.js'
import { manualText, parseWeeks, extractWeekBrief } from '../lib/manual.js'

const SCORE_LABELS = ['Scattered', 'Restless', 'Workable', 'Settled', 'Absorbed']
const WEEKS_TOTAL = 26
const TICKS_TO_UNLOCK = 7

function todayLocalISO() {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function csvEscape(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function sessionsToCSV(sessions) {
  const header = 'date,minutes,score,note,week'
  const rows = sessions.map((s) =>
    [s.date, s.minutes, s.score, csvEscape(s.note), s.week].join(','),
  )
  return [header, ...rows].join('\n')
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function AttentionTrend({ sessions }) {
  const points = useMemo(
    () =>
      sessions
        .slice()
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .slice(-30),
    [sessions],
  )

  if (points.length < 2) return null

  const width = 280
  const height = 60
  const padX = 6
  const padY = 8
  const xStep = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0
  const yFor = (score) => height - padY - ((score - 1) / 4) * (height - padY * 2)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(padX + i * xStep).toFixed(1)} ${yFor(p.score).toFixed(1)}`)
    .join(' ')

  return (
    <div className="trend-block">
      <h2 className="trend-title">Attention trend</h2>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="trend-svg"
        role="img"
        aria-label="Attention score trend over recent sessions"
      >
        <path className="trend-line" d={path} />
        {points.map((p, i) => (
          <circle key={p.id} className="trend-dot" cx={padX + i * xStep} cy={yFor(p.score)} r="2.5">
            <title>{`${p.date}: ${p.score}/5`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

function WeekBrief({ week }) {
  const [expanded, setExpanded] = useState(false)
  if (!week) return null

  const { essence, practice } = extractWeekBrief(week.body)

  return (
    <div className="week-brief">
      <button
        type="button"
        className="week-brief-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span>
          Week {week.number} — {week.title}
        </span>
        <span className="week-brief-chevron" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>
      {expanded && (
        <div className="week-brief-body">
          {essence && (
            <p className="week-brief-essence">
              <strong>Essence:</strong> {essence}
            </p>
          )}
          {practice && <p className="week-brief-practice">{practice}</p>}
        </div>
      )}
    </div>
  )
}

export default function SessionLog() {
  const [sessions, setSessions] = useState(() => getSessions())
  const [activeWeek, setActiveWeek] = useState(() => getCurrentWeek())
  const [date, setDate] = useState(todayLocalISO)
  const [minutes, setMinutes] = useState(() => {
    const pending = getPendingSessionMinutes()
    return pending ? String(pending) : ''
  })
  const [score, setScore] = useState(null)
  const [note, setNote] = useState('')
  const [unlockMessage, setUnlockMessage] = useState(null)

  const weeks = useMemo(() => parseWeeks(manualText), [])
  const activeWeekData = weeks.find((w) => w.number === activeWeek)

  const ticksThisWeek = sessions.filter((s) => s.week === activeWeek).length

  function handleSubmit(e) {
    e.preventDefault()
    const minutesValue = Math.round(Number(minutes))
    if (!date || !Number.isFinite(minutesValue) || minutesValue <= 0 || !score) return

    const cleanNote = note.trim().split(/\s+/)[0] || ''
    const entry = {
      id: crypto.randomUUID(),
      date,
      minutes: minutesValue,
      score,
      note: cleanNote,
      week: activeWeek,
    }

    const updated = addSession(entry)
    setSessions(updated)
    clearPendingSessionMinutes()

    const ticks = updated.filter((s) => s.week === activeWeek).length
    if (ticks >= TICKS_TO_UNLOCK && activeWeek < WEEKS_TOTAL) {
      const next = activeWeek + 1
      setCurrentWeek(next)
      setUnlockMessage(`Week ${activeWeek} complete — Week ${next} unlocked.`)
      setActiveWeek(next)
    } else {
      setUnlockMessage(null)
    }

    setDate(todayLocalISO())
    setMinutes('')
    setScore(null)
    setNote('')
    scheduleSync()
  }

  function handleExportJSON() {
    downloadFile('master-key-sessions.json', JSON.stringify(sessions, null, 2), 'application/json')
  }

  function handleExportCSV() {
    downloadFile('master-key-sessions.csv', sessionsToCSV(sessions), 'text/csv')
  }

  const history = useMemo(
    () => sessions.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [sessions],
  )

  return (
    <div className="log-screen">
      <WeekBrief week={activeWeekData} />

      <div className="week-tracker">
        <div className="week-tracker-header">
          <span>
            Week <strong>{activeWeek}</strong>
          </span>
          <span className="tick-count">{Math.min(ticksThisWeek, TICKS_TO_UNLOCK)}/{TICKS_TO_UNLOCK} sessions</span>
        </div>
        <div className="tick-boxes">
          {Array.from({ length: TICKS_TO_UNLOCK }, (_, i) => (
            <span key={i} className={`tick-box${i < ticksThisWeek ? ' filled' : ''}`} />
          ))}
        </div>
        {unlockMessage && <p className="unlock-message">{unlockMessage}</p>}
      </div>

      <form className="log-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <label className="field">
          <span>Minutes</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
          />
        </label>

        <div className="field">
          <span>Attention (1–5)</span>
          <div className="score-picker">
            {SCORE_LABELS.map((label, i) => {
              const value = i + 1
              return (
                <button
                  type="button"
                  key={value}
                  className={`score-btn${score === value ? ' active' : ''}`}
                  onClick={() => setScore(value)}
                  title={label}
                  aria-label={`${value} — ${label}`}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>

        <label className="field">
          <span>One-word note</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. calm, restless"
          />
        </label>

        <button type="submit" className="log-submit-btn">
          Log session
        </button>
      </form>

      <AttentionTrend sessions={sessions} />

      <div className="export-row">
        <button className="export-btn" onClick={handleExportJSON} disabled={sessions.length === 0}>
          Export JSON
        </button>
        <button className="export-btn" onClick={handleExportCSV} disabled={sessions.length === 0}>
          Export CSV
        </button>
      </div>

      <div className="history">
        <h2 className="history-title">History ({sessions.length})</h2>
        {history.length === 0 ? (
          <p className="no-history">No sessions logged yet.</p>
        ) : (
          <ul className="history-list">
            {history.map((s) => (
              <li key={s.id} className="history-item">
                <span className="history-date">{s.date}</span>
                <span className="history-week">Wk {s.week}</span>
                <span className="history-minutes">{s.minutes} min</span>
                <span className="history-score">{s.score}/5</span>
                <span className="history-note">{s.note}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
