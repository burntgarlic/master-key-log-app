import './LoginGate.css'
import { supabase } from '../lib/supabaseClient.js'

// Shown before the main app when Supabase is configured and there's no
// session yet. Google OAuth redirects the whole tab to Google and back —
// the return trip is handled by supabase-js itself (detectSessionInUrl is
// on by default), which fires onAuthStateChange once it parses the
// redirect URL; useAuthSession (mounted at the App root) picks that up and
// re-renders past this gate automatically.
export default function LoginGate({ onContinueOffline }) {
  function handleGoogleSignIn() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="login-gate">
      <div className="login-gate-card">
        <h1 className="login-gate-title">Master Key</h1>
        <p className="login-gate-subtitle">
          Sign in to sync your practice across devices, or continue without an account.
        </p>
        <button type="button" className="google-signin-btn" onClick={handleGoogleSignIn}>
          Sign in with Google
        </button>
        <button type="button" className="continue-offline-btn" onClick={onContinueOffline}>
          Continue without an account
        </button>
      </div>
    </div>
  )
}
