const MODEL = 'gemini-3.6-flash'
const MAX_ENTRIES = 200
const MAX_BODY_CHARS = 2000
const MAX_RESULTS = 50

function buildPrompt(query, entries) {
  return [
    'You are ranking someone\'s personal journal entries by relevance to a search query, based on',
    'meaning rather than exact keyword matches.',
    '',
    `Query: ${query}`,
    '',
    'Entries (JSON array of {id, date, title, body}):',
    JSON.stringify(entries),
    '',
    'Return the "id" values of entries genuinely relevant to the query\'s meaning, most relevant',
    'first. Omit entries that are not relevant. If none are relevant, return an empty array.',
  ].join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' })
    return
  }

  const { query, entries } = req.body || {}
  if (typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'Expected a non-empty "query" string.' })
    return
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(200).json({ ids: [] })
    return
  }

  const trimmedEntries = entries.slice(0, MAX_ENTRIES).map((e) => ({
    id: String(e?.id ?? ''),
    date: e?.date ?? '',
    title: e?.title || '',
    body: typeof e?.body === 'string' ? e.body.slice(0, MAX_BODY_CHARS) : '',
  }))
  const validIds = new Set(trimmedEntries.map((e) => e.id))

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(query, trimmedEntries) }] }],
          generationConfig: {
            temperature: 0.2,
            // Structured output — Gemini is constrained to emit exactly a
            // JSON array of strings, which is what makes this reliable
            // enough to ship without a hand-rolled parser/repair step.
            responseMimeType: 'application/json',
            responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
          },
        }),
      },
    )

    const data = await geminiRes.json()

    if (!geminiRes.ok) {
      res.status(geminiRes.status).json({ error: data?.error?.message || 'Gemini request failed.' })
      return
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '[]'
    let ids
    try {
      ids = JSON.parse(text)
    } catch {
      ids = []
    }
    if (!Array.isArray(ids)) ids = []

    // Never trust the model's output blindly: drop anything that wasn't in
    // the input set, dedupe, cap length.
    const seen = new Set()
    const result = []
    for (const id of ids) {
      if (validIds.has(id) && !seen.has(id)) {
        seen.add(id)
        result.push(id)
        if (result.length >= MAX_RESULTS) break
      }
    }

    res.status(200).json({ ids: result })
  } catch {
    res.status(500).json({ error: 'Failed to reach Gemini.' })
  }
}
