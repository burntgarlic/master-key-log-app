import { useState } from 'react'
import './AuthPanel.css'
import { supabase } from '../lib/supabaseClient.js'
import { useAuthSession } from '../lib/useAuthSession.js'

export default function AuthPanel() {
  const { session, loading, supabaseEnabled } = useAuthSession()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null) // null | 'sending' | 'sent' | 'error'

  // Cloud sync isn't configured for this deployment (no VITE_SUPABASE_* env
  // vars) — stay silent rather than show a login form that can't work.
  if (!supabaseEnabled || loading) return null

  if (session?.user) {
    return (
      <div className="auth-panel">
        <span className="auth-email">{session.user.email}</span>
        <button type="button" className="auth-signout-btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    )
  }

  async function handleSendLink(e) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <form className="auth-panel" onSubmit={handleSendLink}>
      <input
        type="email"
        className="auth-email-input"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit" className="auth-send-btn" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Email me a login link'}
      </button>
      {status === 'sent' && <p className="auth-status">Check your email for the link.</p>}
      {status === 'error' && <p className="auth-status error">Something went wrong. Try again.</p>}
    </form>
  )
}
