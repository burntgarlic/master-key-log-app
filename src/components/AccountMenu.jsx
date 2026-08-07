import { useEffect, useRef, useState } from 'react'
import './AccountMenu.css'
import NotificationSettings from './NotificationSettings.jsx'
import { supabase } from '../lib/supabaseClient.js'

// Generic person glyph for guests — there's no email yet to derive initials
// from.
function GuestIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="currentColor" />
    </svg>
  )
}

function initialFor(email) {
  return email ? email[0].toUpperCase() : '?'
}

// Replaces the old full-width AccountBar with a single avatar button in the
// top-right corner. Tapping it opens a dropdown holding everything that used
// to live in the bar (email, sign out / sign in) plus NotificationSettings,
// relocated here from the Log tab. All of that behavior — sign in/out,
// notification enable/disable, frequency, test nudge — is untouched; this
// component only decides where it's rendered and when the panel is visible.
export default function AccountMenu({ session, onSignInClick }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const user = session?.user

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="account-menu-bar">
      <div className="account-menu" ref={rootRef}>
        <button
          type="button"
          className="account-menu-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={user ? `Account menu — signed in as ${user.email}` : 'Account menu — sign in'}
        >
          {user ? initialFor(user.email) : <GuestIcon />}
        </button>

        {open && (
          <div className="account-menu-panel">
            {user ? (
              <>
                <p className="account-menu-email">{user.email}</p>
                <button type="button" className="account-menu-signout-btn" onClick={() => supabase.auth.signOut()}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <p className="account-menu-guest-label">Guest mode — not syncing</p>
                <button type="button" className="account-menu-signin-btn" onClick={onSignInClick}>
                  Sign in
                </button>
              </>
            )}

            <div className="account-menu-divider" />

            <NotificationSettings session={session} />
          </div>
        )}
      </div>
    </div>
  )
}
