import './AccountBar.css'
import { supabase } from '../lib/supabaseClient.js'

// Small persistent indicator shown above the tab content once past the
// login gate (signed in or guest) — lets a guest see they're not syncing
// and upgrade to a real account without losing their place in the app.
export default function AccountBar({ session, onSignInClick }) {
  if (session?.user) {
    return (
      <div className="account-bar">
        <span className="account-email">{session.user.email}</span>
        <button type="button" className="account-signout-btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="account-bar">
      <span className="account-guest-label">Guest mode — not syncing</span>
      <button type="button" className="account-signin-btn" onClick={onSignInClick}>
        Sign in
      </button>
    </div>
  )
}
