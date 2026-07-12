import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const BUILD_ID = new Date().toISOString()

function buildIdPlugin(buildId) {
  return {
    name: 'build-id',
    config() {
      return {
        define: {
          __BUILD_ID__: JSON.stringify(buildId),
        },
      }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-id.txt',
        source: buildId,
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    buildIdPlugin(BUILD_ID),
    VitePWA({
      devOptions: {
        enabled: false,
      },
      registerType: 'autoUpdate',
      injectRegister: false,
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
        // Installability only — no offline shell; always fetch fresh HTML/JS/CSS.
        globPatterns: ['**/*.{ico,png,svg}'],
        globIgnores: ['**/cards/**'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'script' ||
              request.destination === 'style',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.convex\.cloud\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.clerk\.accounts\.dev\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.clerk\.com\/.*/i,
            handler: 'NetworkOnly',
          },
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
