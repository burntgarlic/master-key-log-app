import { useEffect, useRef, useState } from 'react'
import './AccountMenu.css'
import NotificationSettings from './NotificationSettings.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { getThemePreference, setThemePreference } from '../lib/theme.js'

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

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

function ThemeControl() {
  // Local state here is purely so the pressed segment updates immediately;
  // the actual persisted/applied source of truth is localStorage + the
  // data-theme attribute, both written by setThemePreference.
  const [pref, setPref] = useState(getThemePreference)

  function choose(value) {
    setThemePreference(value)
    setPref(value)
  }

  return (
    <div className="theme-control">
      <span className="theme-control-label">Appearance</span>
      <div className="theme-control-options" role="radiogroup" aria-label="Theme">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={pref === opt.value}
            className={`theme-option-btn${pref === opt.value ? ' active' : ''}`}
            onClick={() => choose(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Replaces the old full-width AccountBar with a single avatar button in the
// top-right corner. Tapping it opens a dropdown holding everything that used
// to live in the bar (email, sign out / sign in) plus NotificationSettings,
// relocated here from the Log tab, plus app-wide settings (theme, practice
// defaults) that have nothing to do with auth. Unlike the auth-specific
// section, those always render — a guest, or a deployment with no Supabase
// configured at all, still gets a theme and practice preferences — so this
// component (and its avatar trigger) is no longer conditional on
// supabaseEnabled the way the old AccountBar was; only the content inside
// the panel is.
export default function AccountMenu({ session, onSignInClick, supabaseEnabled }) {
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
          aria-label={user ? `Account menu — signed in as ${user.email}` : 'Account menu'}
        >
          {user ? initialFor(user.email) : <GuestIcon />}
        </button>

        {open && (
          <div className="account-menu-panel">
            {supabaseEnabled && (
              <>
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

                <div className="account-menu-divider" />
              </>
            )}

            <ThemeControl />
          </div>
        )}
      </div>
    </div>
  )
}
