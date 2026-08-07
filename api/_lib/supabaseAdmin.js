import { createClient } from '@supabase/supabase-js'

// Server-only. The Supabase URL isn't secret (it's the public API host, same
// value the client uses as VITE_SUPABASE_URL — Vercel exposes every env var
// to serverless functions via process.env regardless of the VITE_ prefix,
// which only controls what Vite inlines into the *browser* bundle), but the
// service role key bypasses RLS entirely and must never reach the client.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null

// Verifies the bearer token from an Authorization header against Supabase
// Auth and returns the user, or null if missing/invalid/expired. Works with
// the service-role client — auth.getUser(token) validates the token itself
// rather than relying on RLS.
export async function getUserFromRequest(req) {
  if (!supabaseAdmin) return null
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
