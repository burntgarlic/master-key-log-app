import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read once at cold-start rather than per-request. Kept as a single variable
// passed into the request below — swapping providers/models later only ever
// touches the fetch call, never how context is assembled.
const MANUAL_TEXT = readFileSync(join(__dirname, '..', 'src', 'content', 'manual.md'), 'utf-8')

const MODEL = 'gemini-3.6-flash'
const MAX_HISTORY = 20

function buildSystemInstruction(currentWeek) {
  return [
    'You are a guide for the Master Key practice, a 26-week attention-training curriculum.',
    'Answer using the manual text below as your source of truth — quote or paraphrase it rather than',
    'relying on outside knowledge of Haanel\'s 1916 "Master Key System" or generic self-help advice.',
    currentWeek ? `The user is currently on Week ${currentWeek} of the curriculum.` : null,
    'Be concise, warm, and practical. If asked something the manual does not cover, say so plainly',
    'rather than inventing an answer.',
    '',
    '--- MANUAL START ---',
    MANUAL_TEXT,
    '--- MANUAL END ---',
  ]
    .filter(Boolean)
    .join('\n')
}

function toGeminiContents(messages) {
  return messages
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
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

  const { messages, currentWeek } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Expected a non-empty "messages" array.' })
    return
  }

  const contents = toGeminiContents(messages)
  if (contents.length === 0) {
    res.status(400).json({ error: 'No valid messages to send.' })
    return
  }

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
          system_instruction: { parts: [{ text: buildSystemInstruction(currentWeek) }] },
          contents,
          generationConfig: { temperature: 0.6 },
        }),
      },
    )

    const data = await geminiRes.json()

    if (!geminiRes.ok) {
      res.status(geminiRes.status).json({ error: data?.error?.message || 'Gemini request failed.' })
      return
    }

    const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
    if (!reply) {
      res.status(502).json({ error: 'Gemini returned an empty response.' })
      return
    }

    res.status(200).json({ reply })
  } catch {
    res.status(500).json({ error: 'Failed to reach Gemini.' })
  }
}
