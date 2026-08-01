// Optional, additive: ranks journal entries by meaning via the Gemini-backed
// /api/journal-search endpoint. Keyword search (in Journal.jsx) never
// depends on this — it works standalone offline or if this rejects.
export async function smartSearchJournal(query, entries) {
  if (!navigator.onLine) {
    throw new Error('Smart search needs a connection.')
  }

  const res = await fetch('/api/journal-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      entries: entries.map((e) => ({ id: e.id, date: e.date, title: e.title, body: e.body })),
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Request failed (${res.status})`)
  }

  const data = await res.json()
  return Array.isArray(data.ids) ? data.ids : []
}
