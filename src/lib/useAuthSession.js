import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { syncOnLogin, clearSyncUser } from './cloudSync.js'

// Tracks the Supabase auth session and drives cloud sync off its changes.
// When supabase is null (env vars not configured), this is a no-op that
// reports supabaseEnabled: false so callers can render nothing rather than a
// broken login form — the app stays fully local-only in that case.
export function useAuthSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session?.user) syncOnLogin(data.session.user.id)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        syncOnLogin(newSession.user.id)
      } else {
        clearSyncUser()
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  return { session, loading, supabaseEnabled: Boolean(supabase) }
}
