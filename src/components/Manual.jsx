import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import './Manual.css'
import { manualText, parseWeeks, buildSearchIndex, searchWeeks } from '../lib/manual.js'
import { getCurrentWeek } from '../lib/storage.js'

function makeSnippet(text, query, radius = 70) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, radius * 2)
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + query.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

export default function Manual({ deepLinkWeek }) {
  const weeks = useMemo(() => parseWeeks(manualText), [])
  const searchIndex = useMemo(() => buildSearchIndex(weeks), [weeks])
  const currentWeek = getCurrentWeek()

  // A notification's deep link (?week=N, consumed once in App.jsx) opens
  // straight to that week instead of the current one.
  const [selectedWeek, setSelectedWeek] = useState(deepLinkWeek || currentWeek)
  const [query, setQuery] = useState('')
  const [pendingHighlight, setPendingHighlight] = useState(null)
  const bodyRef = useRef(null)

  const results = useMemo(() => searchWeeks(searchIndex, query), [searchIndex, query])
  const activeWeek = weeks.find((w) => w.number === selectedWeek)

  function goToWeek(number, highlightText) {
    setSelectedWeek(number)
    setPendingHighlight(highlightText || null)
  }

  useEffect(() => {
    if (!pendingHighlight || !bodyRef.current) return undefined
    const needle = pendingHighlight.toLowerCase()
    const candidates = bodyRef.current.querySelectorAll('p, li')
    const match = [...candidates].find((el) => el.textContent.toLowerCase().includes(needle))
    if (!match) return undefined
    match.scrollIntoView({ behavior: 'smooth', block: 'center' })
    match.classList.add('search-hit')
    const timer = setTimeout(() => match.classList.remove('search-hit'), 2200)
    return () => clearTimeout(timer)
  }, [selectedWeek, pendingHighlight])

  return (
    <div className="manual-screen">
      <div className="current-week-banner">
        <span>
          Current week: <strong>{currentWeek}</strong>
        </span>
        {selectedWeek !== currentWeek && (
          <button className="jump-current-btn" onClick={() => goToWeek(currentWeek)}>
            Jump to current week
          </button>
        )}
      </div>

      <input
        type="search"
        className="manual-search"
        placeholder="Search the manual…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.trim() && (
        <div className="search-results">
          {results.length === 0 ? (
            <p className="no-results">No matches for "{query.trim()}".</p>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                className="search-result"
                onClick={() => {
                  const q = query.trim()
                  setQuery('')
                  goToWeek(r.week, q)
                }}
              >
                <span className="result-week">
                  Week {r.week} — {r.title}
                </span>
                <span className="result-snippet">{makeSnippet(r.text, query.trim())}</span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="week-nav" role="listbox" aria-label="Jump to week">
        {weeks.map((w) => (
          <button
            key={w.number}
            role="option"
            aria-selected={w.number === selectedWeek}
            className={`week-chip${w.number === selectedWeek ? ' active' : ''}${w.number === currentWeek ? ' is-current' : ''}`}
            onClick={() => goToWeek(w.number)}
          >
            {w.number}
          </button>
        ))}
      </div>

      <div className="week-body" ref={bodyRef}>
        {activeWeek ? <ReactMarkdown>{activeWeek.body}</ReactMarkdown> : <p>Week not found.</p>}
      </div>
    </div>
  )
}
