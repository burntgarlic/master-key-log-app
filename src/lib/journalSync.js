import { supabase } from './supabaseClient.js'
import { getJournalEntries, setJournalEntries } from './journalStorage.js'

const TABLE = 'journal_entries'
const DEBOUNCE_MS = 1500

let currentUserId = null
let debounceTimer = null

function toRow(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    entry_date: entry.date,
    week: entry.week ?? null,
    session_id: entry.sessionId ?? null,
    title: entry.title ?? null,
    body: entry.body,
    created_at: entry.createdAt || new Date().toISOString(),
    updated_at: entry.updatedAt || new Date().toISOString(),
  }
}

function fromRow(row) {
  return {
    id: row.id,
    date: row.entry_date,
    week: row.week,
    sessionId: row.session_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function pushJournal(userId) {
  if (!supabase || !userId) return
  const entries = getJournalEntries()
  if (entries.length === 0) return
  const { error } = await supabase.from(TABLE).upsert(entries.map((e) => toRow(e, userId)))
  if (error) console.error('Journal sync: failed to push entries', error)
}

// Call after any local mutation (create/edit) while signed in. Debounced so
// a burst of edits coalesces into one upsert.
export function scheduleJournalSync() {
  if (!supabase || !currentUserId) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => pushJournal(currentUserId), DEBOUNCE_MS)
}

// Deletes propagate immediately rather than riding the debounce — there's
// no "upsert" analog for removal, so a deleted entry has to be told apart
// from "just hasn't synced yet" or it'll reappear from the cloud on the
// next login merge.
export async function deleteJournalEntryCloud(id) {
  if (!supabase || !currentUserId) return
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) console.error('Journal sync: failed to delete entry', error)
}

// Union by id, same spirit as the session merge — except journal entries
// are editable (sessions are append-only), so an id collision can't just
// pick either side arbitrarily. Whichever copy has the later updatedAt
// wins, so an edit made on one device doesn't get clobbered by a stale
// copy from another.
function mergeEntries(localEntries, cloudEntries) {
  const byId = new Map()
  for (const e of cloudEntries) byId.set(e.id, e)
  for (const e of localEntries) {
    const existing = byId.get(e.id)
    if (!existing || new Date(e.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(e.id, e)
    }
  }
  return [...byId.values()]
}

export async function syncJournalOnLogin(userId) {
  if (!supabase) return
  currentUserId = userId

  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId)
  if (error) {
    console.error('Journal sync: failed to load cloud entries', error)
    return
  }

  const cloud = (data || []).map(fromRow)
  const local = getJournalEntries()
  const merged = mergeEntries(local, cloud)

  setJournalEntries(merged)
  await pushJournal(userId)
}

export function clearJournalSyncUser() {
  currentUserId = null
  clearTimeout(debounceTimer)
}
