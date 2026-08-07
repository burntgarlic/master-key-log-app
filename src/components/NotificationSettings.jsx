import { useEffect, useState } from 'react'
import './NotificationSettings.css'
import { supabase } from '../lib/supabaseClient.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function NotificationSettings({ session }) {
  const [expanded, setExpanded] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [frequency, setFrequency] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [testStatus, setTestStatus] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const pushSupported =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const iosBlocked = isIos() && !isStandalone()

  useEffect(() => {
    if (!session?.user) {
      setLoaded(true)
      return
    }
    let cancelled = false
    async function loadExisting() {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('enabled, frequency_per_week')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setEnabled(data.enabled)
        setFrequency(data.frequency_per_week ?? 3)
      }
      setLoaded(true)
    }
    loadExisting()
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  async function handleEnable() {
    setError(null)
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notification permission was not granted.')
        return
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const { error: upsertError } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: session.user.id,
          endpoint: subscription.endpoint,
          subscription: subscription.toJSON(),
          enabled: true,
          frequency_per_week: frequency,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        { onConflict: 'endpoint' },
      )
      if (upsertError) throw upsertError

      setEnabled(true)
    } catch (err) {
      setError(err.message || 'Could not enable notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    setError(null)
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        // Scoped to this device's own endpoint — a user_id-only update would
        // silently disable every other device this user has notifications
        // enabled on too (push_subscriptions has one row per endpoint, not
        // per user).
        await supabase.from('push_subscriptions').update({ enabled: false }).eq('endpoint', subscription.endpoint)
        await subscription.unsubscribe()
      }
      // No local subscription object: this device has no endpoint to scope
      // a disable to (never subscribed here, or it already lapsed) —
      // deliberately not falling back to a user-wide update, since that
      // would reach every other device on file, not just this one.
      setEnabled(false)
    } catch (err) {
      setError(err.message || 'Could not disable notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFrequencyChange(e) {
    const value = Number(e.target.value)
    setFrequency(value)
    if (!enabled || !session?.user) return
    await supabase.from('push_subscriptions').update({ frequency_per_week: value }).eq('user_id', session.user.id)
  }

  async function handleTestNudge() {
    setTestStatus('sending')
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession()
      const res = await fetch('/api/send-test-nudge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.access_token}`,
        },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Request failed (${res.status})`)
      }
      setTestStatus('sent')
    } catch (err) {
      setTestStatus(err.message || 'Failed to send test nudge.')
    }
  }

  // Supabase not configured for this deployment: notifications have nothing
  // to store subscriptions in, so stay silent rather than show a section
  // that can never work — same pattern as AuthPanel/DevPanel. Checked after
  // all hooks above run unconditionally, since `supabase` is a frozen
  // module-scope constant that never changes mid-render for a given build,
  // but keeping the hook calls unconditional avoids relying on that at all.
  if (!supabase) return null

  return (
    <div className="notification-settings">
      <button
        type="button"
        className="notification-settings-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span>🔔 Notifications</span>
        <span className="notification-settings-chevron" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="notification-settings-body">
          {!session?.user ? (
            <p className="notification-settings-note">
              Sign in to enable daily practice nudges — they're personalized to your current week and
              sent from the server, so they need an account.
            </p>
          ) : !pushSupported ? (
            <p className="notification-settings-note">
              This browser doesn't support push notifications.
            </p>
          ) : iosBlocked ? (
            <p className="notification-settings-note">
              On iPhone/iPad, notifications only work once this app is added to your Home Screen
              (Safari → Share → Add to Home Screen) and opened from there — requires iOS 16.4 or
              later. Open it from the Home Screen icon to enable nudges.
            </p>
          ) : !loaded ? (
            <p className="notification-settings-note">Loading…</p>
          ) : (
            <>
              <label className="notification-toggle-row">
                <span>Daily micro-practice nudges</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={busy}
                  onChange={(e) => (e.target.checked ? handleEnable() : handleDisable())}
                />
              </label>

              <label className="notification-frequency-row">
                <span>Frequency (per week)</span>
                <select value={frequency} onChange={handleFrequencyChange} disabled={busy}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              {enabled && (
                <button type="button" className="test-nudge-btn" onClick={handleTestNudge} disabled={testStatus === 'sending'}>
                  {testStatus === 'sending' ? 'Sending…' : 'Send me a test nudge now'}
                </button>
              )}
              {testStatus === 'sent' && <p className="notification-status">Test nudge sent — check your notifications.</p>}
              {testStatus && testStatus !== 'sending' && testStatus !== 'sent' && (
                <p className="notification-status error">{testStatus}</p>
              )}

              {error && <p className="notification-status error">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
