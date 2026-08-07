// Shared time-of-day helpers for session records. A session's time is
// stored as a plain "HH:MM" 24-hour local string — no date, no timezone —
// deliberately simple, paired with the existing plain `date` string field,
// and it's exactly the native value format of <input type="time">, so no
// conversion is needed between what's stored and what the form binds to.

export function toLocalTimeString(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function nowLocalTime() {
  return toLocalTimeString(new Date())
}

// "14:05" -> "2:05pm", for the subtle history-row display. Returns null for
// missing/malformed input rather than throwing — sessions logged before
// this feature existed have no time at all, and that's left as unknown
// rather than fabricated.
export function formatTimeOfDay(time) {
  if (!time) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match) return null
  const hour24 = Number(match[1])
  const minute = Number(match[2])
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null
  const period = hour24 >= 12 ? 'pm' : 'am'
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')}${period}`
}
