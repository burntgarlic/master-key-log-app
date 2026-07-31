import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
