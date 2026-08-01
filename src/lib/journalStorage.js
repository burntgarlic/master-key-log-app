const JOURNAL_KEY = 'mk_journal_entries'

export function getJournalEntries() {
  const raw = localStorage.getItem(JOURNAL_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function setJournalEntries(entries) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries))
}

export function addJournalEntry(entry) {
  const next = [...getJournalEntries(), entry]
  setJournalEntries(next)
  return next
}

export function updateJournalEntry(id, changes) {
  const next = getJournalEntries().map((e) =>
    e.id === id ? { ...e, ...changes, updatedAt: new Date().toISOString() } : e,
  )
  setJournalEntries(next)
  return next
}

export function deleteJournalEntry(id) {
  const next = getJournalEntries().filter((e) => e.id !== id)
  setJournalEntries(next)
  return next
}
