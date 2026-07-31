import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
