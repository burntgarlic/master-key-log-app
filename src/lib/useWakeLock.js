import { useEffect, useRef } from 'react'

// Requests a screen wake lock while `active` is true, and re-acquires it
// after the tab regains visibility (the spec releases the lock automatically
// when the page is hidden, e.g. the phone screen locks mid-session).
export function useWakeLock(active) {
  const lockRef = useRef(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let cancelled = false

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          lock.release().catch(() => {})
          return
        }
        lockRef.current = lock
      } catch {
        // Wake Lock not available or denied — fail silently, timer still works.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !lockRef.current) {
        acquire()
      }
    }

    acquire()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [active])
}
