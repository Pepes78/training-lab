import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages sirve este proyecto bajo la ruta del repositorio, y esa ruta
// distingue mayusculas: el repo es "training-lab" en minusculas.
// En dev usamos '/' para que localhost funcione sin prefijo.
const base = '/training-lab/'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? base : '/',
  resolve: {
    // decodeURIComponent es imprescindible: la ruta del proyecto contiene espacios
    // ("OneDrive - Siemens AG") y sin decodificar llegan como %20 y no resuelve.
    alias: {
      '@': decodeURIComponent(
        new URL('./src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts pesa mas que el resto de la app junto. Separarlo permite que
        // el navegador cachee el grafico aparte del codigo que si cambia a menudo.
        manualChunks: {
          charts: ['recharts'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Training Lab',
        short_name: 'Training Lab',
        description: 'Entrenamiento basado en evidencia: rutinas configurables, tracking por serie y analitica de progresion',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Los GIF de demostracion vienen de la CDN de ExerciseDB: cachear bajo demanda
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/static\.exercisedb\.dev\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-media',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}))
