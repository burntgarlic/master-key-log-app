import { supabase } from './supabaseClient.js'
import {
  getSessions,
  setSessions,
  getCurrentWeek,
  setCurrentWeek,
  getDeletedSessionIds,
  setDeletedSessionIds,
} from './storage.js'

const TABLE = 'progress'
const DEBOUNCE_MS = 1500

let currentUserId = null
let debounceTimer = null

function readLocalProgress() {
  return {
    sessions: getSessions(),
    currentWeek: getCurrentWeek(),
    deletedSessionIds: getDeletedSessionIds(),
  }
}

function applyLocalProgress({ sessions, currentWeek, deletedSessionIds }) {
  setSessions(sessions)
  setCurrentWeek(currentWeek)
  setDeletedSessionIds(deletedSessionIds || {})
}

// Union of both session lists by id, MINUS anything in the tombstone set.
// Every session gets its id from crypto.randomUUID() at creation time, so a
// same-id collision only ever means "the same session" — union never drops
// a session that exists on just one side. Tombstones are what let a delete
// actually stick: without them, the very union that keeps sessions safe
// would also resurrect one you just deleted, the moment the other side's
// (stale, not-yet-synced) copy re-enters the merge.
function mergeSessions(localSessions, cloudSessions, tombstones) {
  const byId = new Map()
  for (const s of cloudSessions) byId.set(s.id, s)
  for (const s of localSessions) byId.set(s.id, s)
  for (const id of Object.keys(tombstones)) byId.delete(id)
  return [...byId.values()]
}

async function pushProgress(userId) {
  if (!supabase || !userId) return
  try {
    const { error } = await supabase.from(TABLE).upsert({
      id: userId,
      data: readLocalProgress(),
      updated_at: new Date().toISOString(),
    })
    if (error) console.error('Cloud sync: failed to push progress', error)
  } catch (err) {
    // Typically offline. localStorage already holds the change durably —
    // nothing is queued-and-lost here, because every push sends the whole
    // current local state, not a diff. The next scheduleSync() call, the
    // 'online' listener below, or the next login's syncOnLogin will push
    // this same (still current) state again.
    console.error('Cloud sync: failed to push progress (will retry later)', err)
  }
}

// Call after any local mutation (adding a session, deleting one, a week
// unlock) while a user is signed in. Debounced so a burst of changes
// coalesces into one upsert instead of one request per action.
export function scheduleSync() {
  if (!supabase || !currentUserId) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => pushProgress(currentUserId), DEBOUNCE_MS)
}

// Runs when a session becomes active (fresh sign-in, an existing session
// restored on load) and again whenever the browser comes back online.
// Reconciles local vs cloud progress, writes the reconciled result back to
// both sides, then leaves currentUserId set so subsequent scheduleSync()
// calls push to the right row.
//
// Merge rule: union sessions by id (never drops either side's sessions),
// then remove anything in the merged tombstone set (union of both sides'
// deletedSessionIds) — so a session deleted on any device stays gone
// everywhere, even though the union step would otherwise resurrect it from
// a device that hadn't synced the delete yet. Current week = max(local,
// cloud), since it only ever advances forward and a delete must never
// regress it.
export async function syncOnLogin(userId) {
  if (!supabase) return
  currentUserId = userId

  let cloud = null
  let cloudLoadFailed = false
  try {
    const { data, error } = await supabase.from(TABLE).select('data').eq('id', userId).maybeSingle()
    if (error) {
      console.error('Cloud sync: failed to load cloud progress', error)
      cloudLoadFailed = true
    } else {
      cloud = data?.data ?? null
    }
  } catch (err) {
    console.error('Cloud sync: failed to load cloud progress (offline?)', err)
    cloudLoadFailed = true
  }

  if (!cloudLoadFailed) {
    const local = readLocalProgress()
    const mergedTombstones = { ...(cloud?.deletedSessionIds ?? {}), ...local.deletedSessionIds }
    const mergedSessions = mergeSessions(local.sessions, cloud?.sessions ?? [], mergedTombstones)
    const currentWeek = Math.max(local.currentWeek, cloud?.currentWeek ?? 1)
    applyLocalProgress({ sessions: mergedSessions, currentWeek, deletedSessionIds: mergedTombstones })
  }

  // Always attempt to push current local state, even if the pull/merge step
  // failed — local is always current and safe to push as-is. This is what
  // lets a log/delete made while offline propagate as soon as a push
  // actually succeeds, without needing the pull to succeed first.
  await pushProgress(userId)
}

export function clearSyncUser() {
  currentUserId = null
  clearTimeout(debounceTimer)
}

// Reconciles + pushes as soon as connectivity returns, so offline changes
// (including deletes) propagate without waiting for the next app open or
// login. Re-running syncOnLogin is safe/idempotent — it always merges from
// current local + cloud state — so no dedup guard is needed here.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (currentUserId) syncOnLogin(currentUserId)
  })
}
