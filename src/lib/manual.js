import manualRaw from '../content/manual.md?raw'

export const manualText = manualRaw

const WEEK_HEADING_RE = /^##\s+Week\s+(\d+)\s+—\s+(.+)$/

// Splits the manual into its 26 week sections by scanning for
// "## Week N — Title" headings. Everything from one heading up to (but
// not including) the next is that week's body, so each week can be
// rendered as its own standalone markdown document.
export function parseWeeks(text) {
  const lines = text.split('\n')
  const headings = []
  lines.forEach((line, index) => {
    const match = line.match(WEEK_HEADING_RE)
    if (match) headings.push({ index, number: Number(match[1]), title: match[2].trim() })
  })

  return headings.map((heading, i) => {
    const start = heading.index
    const end = i + 1 < headings.length ? headings[i + 1].index : lines.length
    let sliceEnd = end
    while (sliceEnd > start && lines[sliceEnd - 1].trim() === '') sliceEnd--
    while (sliceEnd > start && lines[sliceEnd - 1].trim() === '---') sliceEnd--
    return {
      number: heading.number,
      title: heading.title,
      body: lines.slice(start, sliceEnd).join('\n').trim(),
    }
  })
}

// Pulls just the Essence line and The Practice paragraph out of a week's
// body — the two fields short enough to show inline above the Session Log
// form without rendering the week's full markdown.
export function extractWeekBrief(body) {
  const essenceMatch = body.match(/\*\*Essence:\*\*\s*([^\n]+)/)
  const practiceMatch = body.match(/\*\*The practice\.\*\*\s*([\s\S]+?)\n\s*\n/)
  return {
    essence: essenceMatch ? essenceMatch[1].trim() : null,
    practice: practiceMatch ? practiceMatch[1].trim() : null,
  }
}

// "**Phase I · Foundation**" -> "I · Foundation", for the Home dashboard's
// hero card ("Week N · Phase ...").
export function extractPhase(body) {
  const match = body.match(/\*\*Phase\s+([^\n*]+)\*\*/)
  return match ? match[1].trim() : null
}

// Same extraction api/_lib/nudges.js does server-side for push notification
// text — duplicated rather than imported because that file can't import
// this one (it runs as a bare Node/Vercel function and reads manual.md via
// fs.readFileSync, not Vite's `?raw` import). Used here for the Home
// dashboard's "Today's seed" card, so both surfaces draw from the exact
// same underlying seed list per week, just parsed on different sides.
export function extractSeeds(body) {
  const match = body.match(/\*\*Contemplation seeds\.\*\*\s*\n((?:-\s.+\n?)+)/)
  if (!match) return []
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^-\s*/, '').trim())
    .filter(Boolean)
}

function stripMarkdown(text) {
  return text
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^-\s+/gm, '')
    .trim()
}

// A flat list of searchable paragraph-level blocks across all weeks, built
// once and reused for every keystroke in the search box.
export function buildSearchIndex(weeks) {
  const blocks = []
  for (const week of weeks) {
    const paragraphs = week.body.split(/\n\s*\n/)
    for (const paragraph of paragraphs) {
      const plain = stripMarkdown(paragraph)
      if (plain.length < 2) continue
      blocks.push({ week: week.number, title: week.title, text: plain })
    }
  }
  return blocks
}

export function searchWeeks(index, query, limit = 40) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return index.filter((block) => block.text.toLowerCase().includes(q)).slice(0, limit)
}
