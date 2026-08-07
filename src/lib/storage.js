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

const PENDING_SESSION_TIME_KEY = 'mk_pending_session_time'

// Companion to the minutes handoff above: the Timer's actual captured start
// time (see Timer.jsx's sessionStartRef), read once by the Log form as the
// default for its Time field and then cleared, same lifecycle as minutes.
export function setPendingSessionStartTime(time) {
  localStorage.setItem(PENDING_SESSION_TIME_KEY, time)
}

export function getPendingSessionStartTime() {
  return localStorage.getItem(PENDING_SESSION_TIME_KEY)
}

export function clearPendingSessionStartTime() {
  localStorage.removeItem(PENDING_SESSION_TIME_KEY)
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

const DELETED_SESSION_IDS_KEY = 'mk_deleted_session_ids'

// Map of { [sessionId]: deletedAtISOString }. Sessions sync via a union
// merge (local ∪ cloud by id), so a plain delete would resurrect the moment
// another device's stale copy re-enters that union — the tombstone set is
// what the merge excludes against, so a delete actually sticks everywhere.
export function getDeletedSessionIds() {
  const raw = localStorage.getItem(DELETED_SESSION_IDS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function setDeletedSessionIds(map) {
  localStorage.setItem(DELETED_SESSION_IDS_KEY, JSON.stringify(map || {}))
}

// Removes a session locally and tombstones its id so cloud sync's merge
// never brings it back. Returns the updated sessions array.
export function deleteSession(id) {
  const tombstones = getDeletedSessionIds()
  tombstones[id] = new Date().toISOString()
  setDeletedSessionIds(tombstones)

  const remaining = getSessions().filter((s) => s.id !== id)
  setSessions(remaining)
  return remaining
}

// Dev-panel only: wipes every session, the active week, any pending Timer
// handoff, and the delete tombstone set, back to a blank-install state.
export function resetAllProgress() {
  localStorage.removeItem(SESSIONS_KEY)
  localStorage.removeItem(CURRENT_WEEK_KEY)
  localStorage.removeItem(PENDING_SESSION_KEY)
  localStorage.removeItem(PENDING_SESSION_TIME_KEY)
  localStorage.removeItem(DELETED_SESSION_IDS_KEY)
}

const GUEST_MODE_KEY = 'mk_guest_mode'

// Persists "Continue without an account" so the startup login gate doesn't
// reappear on every reload once someone's chosen offline/guest mode.
export function getGuestMode() {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true'
}

export function setGuestMode(value) {
  if (value) {
    localStorage.setItem(GUEST_MODE_KEY, 'true')
  } else {
    localStorage.removeItem(GUEST_MODE_KEY)
  }
}
