import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cloud sync is additive — the app must keep working fully offline/logged-out,
// including on a fresh checkout before .env.local is filled in. createClient()
// throws on an empty/invalid URL, so skip creating a client entirely rather
// than let that take down the whole app; every caller treats a null client as
// "cloud sync unavailable" and falls back to local-only behavior.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
