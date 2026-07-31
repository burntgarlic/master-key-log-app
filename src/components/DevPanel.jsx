import { useState } from 'react'
import './DevPanel.css'
import { getCurrentWeek, setCurrentWeek, addSession, resetAllProgress } from '../lib/storage.js'

const SAMPLE_NOTES = ['calm', 'restless', 'settled', 'scattered', 'absorbed', 'workable', 'steady']

function seedSampleSessions(week) {
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    addSession({
      id: crypto.randomUUID(),
      date: d.toISOString().slice(0, 10),
      minutes: 15 + ((i * 3) % 20),
      score: (i % 5) + 1,
      note: SAMPLE_NOTES[i % SAMPLE_NOTES.length],
      week,
    })
  }
}

export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const [weekInput, setWeekInput] = useState(() => String(getCurrentWeek()))

  function handleJumpToWeek(e) {
    e.preventDefault()
    const n = Math.round(Number(weekInput))
    if (!Number.isFinite(n) || n < 1 || n > 26) return
    setCurrentWeek(n)
    window.location.reload()
  }

  function handleSeed() {
    seedSampleSessions(getCurrentWeek())
    window.location.reload()
  }

  function handleReset() {
    const ok = window.confirm(
      'Reset all progress? This clears every logged session, the active week, and any pending Timer handoff.',
    )
    if (!ok) return
    resetAllProgress()
    window.location.reload()
  }

  return (
    <div className="dev-panel">
      <button
        type="button"
        className="dev-panel-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        🛠 Dev
      </button>

      {open && (
        <div className="dev-panel-body">
          <p className="dev-panel-label">Debug panel · {import.meta.env.VITE_VERCEL_ENV}</p>

          <form className="dev-panel-row" onSubmit={handleJumpToWeek}>
            <input
              id="dev-week-input"
              type="number"
              min="1"
              max="26"
              value={weekInput}
              onChange={(e) => setWeekInput(e.target.value)}
              aria-label="Week number"
            />
            <button type="submit">Jump to week</button>
          </form>

          <button type="button" className="dev-panel-action" onClick={handleSeed}>
            Seed sample sessions
          </button>

          <button type="button" className="dev-panel-action danger" onClick={handleReset}>
            Reset all progress
          </button>
        </div>
      )}
    </div>
  )
}
