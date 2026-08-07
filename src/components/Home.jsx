import { useMemo } from 'react'
import './Home.css'
import { getSessions, getCurrentWeek, getPracticeLength, getPracticeStyle, setAutoStartPractice } from '../lib/storage.js'
import { manualText, parseWeeks, extractWeekBrief, extractPhase, extractSeeds } from '../lib/manual.js'
import { primeChime } from '../lib/chime.js'

const TICKS_TO_UNLOCK = 7

const QUICK_ACTIONS = [
  { id: 'timer', icon: '⏱', label: 'Time a session', subtitle: 'stopwatch or countdown' },
  { id: 'journal', icon: '📔', label: 'Journal', subtitle: 'Capture a reflection' },
  { id: 'chat', icon: '💬', label: 'Ask the guide', subtitle: 'Talk it through' },
  { id: 'manual', icon: '📖', label: 'Read the week', subtitle: 'Browse the manual' },
]

const FALLBACK_SEED = 'Take three slow breaths and notice what settles.'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function todayLongDate() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

// Deterministic pick so "today's seed" is stable across re-renders and
// re-opening the tab within the same day, but rotates day to day — no
// extra storage needed for it.
function seedForToday(seeds) {
  if (seeds.length === 0) return FALLBACK_SEED
  const today = new Date()
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  return seeds[dayOfYear % seeds.length]
}

// New default landing tab. Pulls entirely from data other tabs already
// own (sessions, current week, practice settings, the manual content) —
// no new backend, no new stored state beyond the one-shot autostart flag
// the "Begin practice" button sets for Timer.jsx to pick up.
export default function Home({ onNavigate }) {
  const sessions = useMemo(() => getSessions(), [])
  const currentWeek = getCurrentWeek()
  const weeks = useMemo(() => parseWeeks(manualText), [])
  const weekData = weeks.find((w) => w.number === currentWeek)

  const essence = useMemo(() => (weekData ? extractWeekBrief(weekData.body).essence : null), [weekData])
  const phase = useMemo(() => (weekData ? extractPhase(weekData.body) : null), [weekData])
  const seeds = useMemo(() => (weekData ? extractSeeds(weekData.body) : []), [weekData])
  const seed = useMemo(() => seedForToday(seeds), [seeds])

  const ticksThisWeek = sessions.filter((s) => s.week === currentWeek).length
  const practiceStyle = getPracticeStyle()
  const practiceLength = getPracticeLength()
  const beginLabel = practiceStyle === 'stopwatch' ? 'Begin practice' : `Begin practice · ${practiceLength} min`

  function handleBeginPractice() {
    // Unlocks the chime's AudioContext synchronously inside this click's
    // user gesture — Timer.jsx only mounts after the tab switch completes,
    // which is too late for some browsers' autoplay policy to still count
    // as "triggered by a gesture".
    primeChime()
    setAutoStartPractice()
    onNavigate('timer')
  }

  return (
    <div className="home-screen">
      <div className="home-header">
        <h1 className="home-greeting">{greeting()}</h1>
        <p className="home-date">{todayLongDate()}</p>
      </div>

      <div className="hero-card">
        {weekData ? (
          <>
            <span className="hero-week-label">
              Week {currentWeek}
              {phase ? ` · Phase ${phase}` : ''}
            </span>
            <h2 className="hero-week-title">{weekData.title}</h2>
            {essence && <p className="hero-essence">{essence}</p>}

            <button type="button" className="hero-begin-btn" onClick={handleBeginPractice}>
              {beginLabel}
            </button>

            <div className="hero-week-tracker">
              <div className="week-dots">
                {Array.from({ length: TICKS_TO_UNLOCK }, (_, i) => (
                  <span key={i} className={`week-dot${i < ticksThisWeek ? ' filled' : ''}`} />
                ))}
              </div>
              <span className="hero-tick-count">
                {Math.min(ticksThisWeek, TICKS_TO_UNLOCK)}/{TICKS_TO_UNLOCK} sessions
              </span>
            </div>
          </>
        ) : (
          <p className="hero-essence">Start your practice to see this week's focus here.</p>
        )}
      </div>

      <div className="quick-actions-grid">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            className="quick-action-card"
            onClick={() => onNavigate(action.id)}
          >
            <span className="quick-action-icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="quick-action-label">{action.label}</span>
            <span className="quick-action-subtitle">{action.subtitle}</span>
          </button>
        ))}
      </div>

      {seed && (
        <div className="seed-card">
          <span className="seed-label">Today's seed</span>
          <p className="seed-text">{seed}</p>
        </div>
      )}
    </div>
  )
}
