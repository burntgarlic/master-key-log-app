import { precacheAndRoute } from 'workbox-precaching'

// injectManifest gives us our own SW source, which means WE are responsible
// for skipWaiting/clients.claim() — unlike generateSW, vite-plugin-pwa does
// NOT inject this automatically just because registerType is 'autoUpdate'.
// Without it, a newly deployed SW sits in "waiting" until every open tab
// for this origin is closed, so the OLD SW (from before push support
// existed, or from an earlier iteration of it) stays active and simply
// never receives push events with the current handler — this is the
// single most common reason "push works via DevTools/curl but nothing
// shows up" during development.
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// vite-plugin-pwa (injectManifest strategy) replaces this at build time with
// the actual list of built assets to precache — this is what preserves the
// existing offline-caching behavior from the old generateSW setup.
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  // Logged unconditionally, before anything else, so DevTools' service
  // worker console shows whether the event fired at all and exactly what
  // bytes arrived — independent of whether JSON parsing below succeeds.
  const rawText = event.data ? event.data.text() : null
  console.log('[sw] push event received. raw payload:', rawText)

  let payload = null
  if (event.data) {
    try {
      payload = event.data.json()
    } catch (err) {
      console.log('[sw] push payload is not valid JSON, falling back:', err.message)
    }
  } else {
    console.log('[sw] push event had no event.data at all')
  }
  payload = payload || {}

  const title = payload.title || 'Master Key'
  const options = {
    body: payload.body || rawText || 'You have a new notification.',
    icon: payload.icon || '/icons/icon.svg',
    badge: payload.icon || '/icons/icon.svg',
    data: { url: (payload.data && payload.data.url) || '/' },
  }

  console.log('[sw] showing notification:', title, options)

  // Always shows something — missing/malformed data falls back rather
  // than bailing, and everything (including the fallback path) is inside
  // waitUntil so the SW isn't terminated before showNotification resolves.
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl)
            } catch {
              // Some browsers restrict cross-origin/opaque navigate calls —
              // the client is still focused, which is the important part.
            }
          }
          return
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
