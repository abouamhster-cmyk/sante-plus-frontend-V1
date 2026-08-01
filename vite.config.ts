// 📁 vite.config.ts
 
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `mode` permet d'appliquer certaines options uniquement en production.
export default defineConfig(({ mode }) => ({
  // ============================================================
  // 🔇 SUPPRESSION DES LOGS EN PRODUCTION
  // ============================================================
  // Le front contenait plus de 500 appels console.*, dont beaucoup affichaient
  // des identifiants utilisateur, des jetons et des données patients dans la
  // console du navigateur — visibles par n'importe qui via F12.
  // esbuild les supprime du bundle de production, sans toucher au code source
  // ni au comportement en développement.
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'masked-icon.svg',
        'firebase-messaging-sw.js', 
        'notification.mp3',           
      ],
      manifest: {
        name: 'Santé Plus Services',
        short_name: 'Santé Plus',
        description: 'Accompagnement humain et coordination à domicile',
        theme_color: '#1a4a3a',
        background_color: '#f5f0e8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: '/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: '/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // ✅ CORRECTIF : Augmente la limite de cache pour le gros fichier bundle (index-js)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://sante-plus-backend-v1.onrender.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // ✅ Optimisation : Découpage automatique des gros fichiers et relèvement du seuil d'alerte
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'; // Sépare les bibliothèques lourdes
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    // Pas de sourcemap en production : elle exposerait tout votre code source
    // original aux visiteurs. Activez-la ponctuellement pour déboguer.
    sourcemap: false,
  },
}));
