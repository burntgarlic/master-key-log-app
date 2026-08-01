import { supabase } from './supabaseClient.js'
import { getSessions, setSessions, getCurrentWeek, setCurrentWeek } from './storage.js'

const TABLE = 'progress'
const DEBOUNCE_MS = 1500

let currentUserId = null
let debounceTimer = null

function readLocalProgress() {
  return { sessions: getSessions(), currentWeek: getCurrentWeek() }
}

function applyLocalProgress({ sessions, currentWeek }) {
  setSessions(sessions)
  setCurrentWeek(currentWeek)
}

// Union of both session lists by id. Every session gets its id from
// crypto.randomUUID() at creation time on whichever device logged it, so an
// id collision only ever means "the same session, already synced" — this
// can never silently drop a session that exists on just one side.
function mergeSessions(localSessions, cloudSessions) {
  const byId = new Map()
  for (const s of cloudSessions) byId.set(s.id, s)
  for (const s of localSessions) byId.set(s.id, s)
  return [...byId.values()]
}

async function pushProgress(userId) {
  if (!supabase || !userId) return
  const { error } = await supabase.from(TABLE).upsert({
    id: userId,
    data: readLocalProgress(),
    updated_at: new Date().toISOString(),
  })
  if (error) console.error('Cloud sync: failed to push progress', error)
}

// Call after any local mutation (adding a session, a week unlock) while a
// user is signed in. Debounced so a burst of changes coalesces into one
// upsert instead of one request per keystroke/action.
export function scheduleSync() {
  if (!supabase || !currentUserId) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => pushProgress(currentUserId), DEBOUNCE_MS)
}

// Runs once when a session becomes active (fresh sign-in, or an existing
// session restored on load). Reconciles local vs cloud progress, writes the
// reconciled result back to both sides, then leaves currentUserId set so
// subsequent scheduleSync() calls push to the right row.
//
// Merge rules:
//   - cloud empty, local has data  -> seed the cloud from local (local wins, nothing to merge)
//   - cloud has data, local empty  -> adopt the cloud's data onto this device
//   - both have data               -> union sessions by id (never drops either side's
//                                     sessions), current week = max(local, cloud) since
//                                     it only ever advances forward
//   - neither has data             -> nothing to do
export async function syncOnLogin(userId) {
  if (!supabase) return
  currentUserId = userId

  const { data, error } = await supabase.from(TABLE).select('data').eq('id', userId).maybeSingle()
  if (error) {
    console.error('Cloud sync: failed to load cloud progress', error)
    return
  }

  const cloud = data?.data ?? null
  const local = readLocalProgress()
  const cloudHasData = Array.isArray(cloud?.sessions) && cloud.sessions.length > 0
  const localHasData = local.sessions.length > 0

  let merged = local
  if (!cloudHasData && localHasData) {
    merged = local
  } else if (cloudHasData && !localHasData) {
    merged = { sessions: cloud.sessions, currentWeek: cloud.currentWeek ?? 1 }
  } else if (cloudHasData && localHasData) {
    merged = {
      sessions: mergeSessions(local.sessions, cloud.sessions),
      currentWeek: Math.max(local.currentWeek, cloud.currentWeek ?? 1),
    }
  }

  applyLocalProgress(merged)
  await pushProgress(userId)
}

export function clearSyncUser() {
  currentUserId = null
  clearTimeout(debounceTimer)
}
