import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use a different filename so Monetag's sw.js at /sw.js is preserved
      filename: 'pwa-sw.js',
      includeAssets: ['favicon.ico', 'MyFreehandFont5.otf', 'icons/*.png', 'music.mp3'],
      manifest: {
        name: 'thoughts jar',
        short_name: 'thoughts jar',
        description: 'a tiny home for wandering thoughts',
        theme_color: '#F6E27A',
        background_color: '#FBF5E8',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
});
