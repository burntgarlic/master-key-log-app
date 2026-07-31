import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Vercel sets VERCEL_ENV ("production" | "preview" | "development") as a
  // plain build-time env var, not one Vite exposes to the client (only
  // VITE_-prefixed vars reach import.meta.env). Re-expose it under a VITE_
  // name via `define` so it's statically inlined as a literal string at
  // build time — that's what lets the dev panel's usage below be dead-code
  // eliminated in production rather than merely hidden at runtime.
  // Locally (no Vercel), VERCEL_ENV is unset, so this falls back to
  // 'development', which is what makes the panel show on localhost too.
  define: {
    'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV || 'development'),
  },
  server: {
    // The run-skill's Playwright driver writes screenshots/downloads under
    // .claude/skills/*/screenshots/. On Windows, a file landing there mid-write
    // (e.g. a Playwright download) can hit the dev server's fs.watch() with an
    // EBUSY error that isn't caught — Vite is not just slow to pick it up, it
    // crashes the whole process. Excluding the directory avoids that watch
    // entirely.
    watch: {
      ignored: ['**/.claude/**'],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Master Key',
        short_name: 'MasterKey',
        description: 'A daily practice companion for the 26-week Master Key attention curriculum.',
        start_url: '/',
        display: 'standalone',
        background_color: '#14151a',
        theme_color: '#14151a',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,md}'],
      },
    }),
  ],
})
