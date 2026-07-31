const PENDING_SESSION_KEY = 'mk_pending_session_minutes'

export function setPendingSessionMinutes(minutes) {
  localStorage.setItem(PENDING_SESSION_KEY, String(minutes))
}

export function getPendingSessionMinutes() {
  const raw = localStorage.getItem(PENDING_SESSION_KEY)
  return raw ? Number(raw) : null
}

export function clearPendingSessionMinutes() {
  localStorage.removeItem(PENDING_SESSION_KEY)
}

const CURRENT_WEEK_KEY = 'mk_current_week'

// The active week (1-26). Session Log owns advancing this on the 7-tick
// unlock rule; the Manual just reads it to surface the current week.
export function getCurrentWeek() {
  const raw = localStorage.getItem(CURRENT_WEEK_KEY)
  const week = raw ? Number(raw) : 1
  return Number.isInteger(week) && week >= 1 && week <= 26 ? week : 1
}

export function setCurrentWeek(week) {
  localStorage.setItem(CURRENT_WEEK_KEY, String(week))
}

const SESSIONS_KEY = 'mk_sessions'

export function getSessions() {
  const raw = localStorage.getItem(SESSIONS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addSession(session) {
  const next = [...getSessions(), session]
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(next))
  return next
}

// Overwrites the whole sessions array — used to apply a cloud download or a
// merge result, as opposed to addSession's single-entry append.
export function setSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}
