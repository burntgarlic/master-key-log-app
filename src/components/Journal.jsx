import { useMemo, useState } from 'react'
import './Journal.css'
import {
  getJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from '../lib/journalStorage.js'
import { scheduleJournalSync, deleteJournalEntryCloud } from '../lib/journalSync.js'
import { smartSearchJournal } from '../lib/journalSmartSearch.js'
import { getCurrentWeek, getSessions } from '../lib/storage.js'

function todayLocalISO() {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function makeSnippet(text, query, radius = 60) {
  if (!query.trim()) return text.length > 140 ? text.slice(0, 140) + '…' : text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.length > 140 ? text.slice(0, 140) + '…' : text
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + query.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

function Highlighted({ text, query }) {
  const q = query.trim()
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

export default function Journal() {
  const [entries, setEntries] = useState(() => getJournalEntries())
  const [date, setDate] = useState(todayLocalISO)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [linkedSessionId, setLinkedSessionId] = useState('')
  const [editingId, setEditingId] = useState(null)

  const [query, setQuery] = useState('')
  const [weekFilter, setWeekFilter] = useState('all')
  const [smartResults, setSmartResults] = useState(null)
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartError, setSmartError] = useState(null)

  const sessions = useMemo(() => getSessions(), [])
  const sessionsForDate = useMemo(() => sessions.filter((s) => s.date === date), [sessions, date])

  const weeksPresent = useMemo(
    () => [...new Set(entries.map((e) => e.week).filter((w) => w != null))].sort((a, b) => a - b),
    [entries],
  )

  function resetForm() {
    setDate(todayLocalISO())
    setTitle('')
    setBody('')
    setLinkedSessionId('')
    setEditingId(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!body.trim()) return

    if (editingId) {
      const updated = updateJournalEntry(editingId, {
        date,
        title: title.trim() || null,
        body: body.trim(),
        sessionId: linkedSessionId || null,
      })
      setEntries(updated)
    } else {
      const now = new Date().toISOString()
      const entry = {
        id: crypto.randomUUID(),
        date,
        week: getCurrentWeek(),
        sessionId: linkedSessionId || null,
        title: title.trim() || null,
        body: body.trim(),
        createdAt: now,
        updatedAt: now,
      }
      const updated = addJournalEntry(entry)
      setEntries(updated)
    }

    scheduleJournalSync()
    resetForm()
  }

  function handleEdit(entry) {
    setEditingId(entry.id)
    setDate(entry.date)
    setTitle(entry.title || '')
    setBody(entry.body)
    setLinkedSessionId(entry.sessionId || '')
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this journal entry? This cannot be undone.')) return
    const updated = deleteJournalEntry(id)
    setEntries(updated)
    deleteJournalEntryCloud(id)
    if (editingId === id) resetForm()
  }

  async function handleSmartSearch() {
    const q = query.trim()
    if (!q || entries.length === 0) return
    setSmartLoading(true)
    setSmartError(null)
    try {
      const ids = await smartSearchJournal(q, entries)
      setSmartResults(ids)
    } catch (err) {
      setSmartError(err.message || 'Smart search unavailable.')
      setSmartResults(null)
    } finally {
      setSmartLoading(false)
    }
  }

  function clearSmartResults() {
    setSmartResults(null)
    setSmartError(null)
  }

  const keywordFiltered = useMemo(() => {
    let list = entries
    if (weekFilter !== 'all') {
      list = list.filter((e) => e.week === Number(weekFilter))
    }
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q) ||
          e.date.includes(q),
      )
    }
    return list.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [entries, query, weekFilter])

  const displayedEntries = useMemo(() => {
    if (!smartResults) return keywordFiltered
    const byId = new Map(entries.map((e) => [e.id, e]))
    return smartResults.map((id) => byId.get(id)).filter(Boolean)
  }, [smartResults, keywordFiltered, entries])

  return (
    <div className="journal-screen">
      <form className="journal-form" onSubmit={handleSubmit}>
        {editingId && <p className="journal-editing-label">Editing entry</p>}

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <label className="field">
          <span>Title (optional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A short title"
          />
        </label>

        <label className="field">
          <span>Entry</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write freely…"
            rows={5}
            required
          />
        </label>

        {sessionsForDate.length > 0 && (
          <label className="field">
            <span>Link to a session logged this day</span>
            <select value={linkedSessionId} onChange={(e) => setLinkedSessionId(e.target.value)}>
              <option value="">— none —</option>
              {sessionsForDate.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.minutes} min · {s.score}/5{s.note ? ` · ${s.note}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="journal-form-actions">
          <button type="submit" className="journal-submit-btn">
            {editingId ? 'Save changes' : 'Add entry'}
          </button>
          {editingId && (
            <button type="button" className="journal-cancel-btn" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="journal-search-row">
        <input
          type="search"
          className="journal-search-input"
          placeholder="Search entries…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            clearSmartResults()
          }}
        />
        <select
          className="journal-week-filter"
          value={weekFilter}
          onChange={(e) => {
            setWeekFilter(e.target.value)
            clearSmartResults()
          }}
        >
          <option value="all">All weeks</option>
          {weeksPresent.map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      <div className="smart-search-row">
        <button
          type="button"
          className="smart-search-btn"
          onClick={handleSmartSearch}
          disabled={!query.trim() || entries.length === 0 || smartLoading}
        >
          {smartLoading ? 'Searching…' : 'Smart search'}
        </button>
        {smartResults && (
          <button type="button" className="smart-clear-btn" onClick={clearSmartResults}>
            Clear smart results
          </button>
        )}
      </div>
      {smartError && <p className="smart-error">{smartError}</p>}
      {smartResults && !smartError && (
        <p className="smart-results-label">
          {smartResults.length} smart result{smartResults.length === 1 ? '' : 's'} for "{query.trim()}"
        </p>
      )}

      <ul className="journal-list">
        {displayedEntries.length === 0 && (
          <p className="journal-empty">
            {entries.length === 0 ? 'No journal entries yet.' : 'No entries match.'}
          </p>
        )}
        {displayedEntries.map((entry) => (
          <li key={entry.id} className="journal-item">
            <div className="journal-item-header">
              <span className="journal-item-date">{entry.date}</span>
              {entry.week != null && <span className="journal-item-week">Wk {entry.week}</span>}
              {entry.sessionId && (
                <span className="journal-item-linked" title="Linked to a logged session">
                  🔗
                </span>
              )}
            </div>
            {entry.title && (
              <p className="journal-item-title">
                <Highlighted text={entry.title} query={query} />
              </p>
            )}
            <p className="journal-item-snippet">
              <Highlighted text={makeSnippet(entry.body, query)} query={query} />
            </p>
            <div className="journal-item-actions">
              <button type="button" className="journal-edit-btn" onClick={() => handleEdit(entry)}>
                Edit
              </button>
              <button type="button" className="journal-delete-btn" onClick={() => handleDelete(entry.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
