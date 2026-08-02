import { precacheAndRoute } from 'workbox-precaching'

// vite-plugin-pwa (injectManifest strategy) replaces this at build time with
// the actual list of built assets to precache — this is what preserves the
// existing offline-caching behavior from the old generateSW setup.
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Master Key', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Master Key'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon.svg',
    badge: payload.icon || '/icons/icon.svg',
    data: { url: (payload.data && payload.data.url) || '/' },
  }

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
