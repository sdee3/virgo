import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      devOptions: {
        enabled: false,
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Virgo — One-Card Tarot Reading',
        short_name: 'Virgo',
        description: 'Pull a single tarot card blessed by the Creator of All That Is.',
        theme_color: '#0f1b2d',
        background_color: '#0f1b2d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // The @2x cards are large; keep them out of the precache and cache
        // them on demand the first time a high-DPR device requests one.
        globIgnores: ['**/cards/2x/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/cards/2x/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images-2x',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@convex-api': path.resolve(__dirname, '../backend/convex/_generated/api.js'),
    },
  },
  server: {
    host: '0.0.0.0',
    fs: {
      allow: ['..'],
    },
  },
})
