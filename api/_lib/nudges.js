import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// A separate, minimal manual parser for server-side (plain Node/Vercel) use.
// src/lib/manual.js can't be reused here — it imports manual.md via Vite's
// `?raw` suffix, which only works inside Vite's own bundler, not a bare
// Node/Vercel serverless function.
const MANUAL_TEXT = readFileSync(join(__dirname, '..', '..', 'src', 'content', 'manual.md'), 'utf-8')

const WEEK_HEADING_RE = /^##\s+Week\s+(\d+)\s+—\s+(.+)$/
const SEEDS_RE = /\*\*Contemplation seeds\.\*\*\s*\n((?:-\s.+\n?)+)/

function parseWeeks(text) {
  const lines = text.split('\n')
  const headings = []
  lines.forEach((line, index) => {
    const match = line.match(WEEK_HEADING_RE)
    if (match) headings.push({ index, number: Number(match[1]), title: match[2].trim() })
  })
  return headings.map((heading, i) => {
    const start = heading.index
    const end = i + 1 < headings.length ? headings[i + 1].index : lines.length
    return { number: heading.number, title: heading.title, body: lines.slice(start, end).join('\n') }
  })
}

function extractSeeds(body) {
  const match = body.match(SEEDS_RE)
  if (!match) return []
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^-\s*/, '').trim())
    .filter(Boolean)
}

const WEEKS = parseWeeks(MANUAL_TEXT)
const NUDGES_BY_WEEK = new Map(
  WEEKS.map((w) => [w.number, { title: w.title, seeds: extractSeeds(w.body) }]),
)
const WEEK_COUNT = WEEKS.length

const FALLBACK_SEED = 'Take three slow breaths and notice what settles.'

// Picks a micro-practice nudge. Mostly from the user's current week; ~20%
// of the time (only once past week 1, since there's nothing earlier to
// pull from) picks a random earlier week instead, for variety.
export function pickNudge(currentWeek) {
  const clampedCurrent = Math.min(WEEK_COUNT, Math.max(1, Math.round(currentWeek) || 1))

  let week = clampedCurrent
  if (clampedCurrent > 1 && Math.random() < 0.2) {
    week = 1 + Math.floor(Math.random() * (clampedCurrent - 1))
  }

  const entry = NUDGES_BY_WEEK.get(week)
  const seeds = entry?.seeds?.length ? entry.seeds : [FALLBACK_SEED]
  const text = seeds[Math.floor(Math.random() * seeds.length)]

  return {
    week,
    title: entry?.title || `Week ${week}`,
    text,
  }
}
