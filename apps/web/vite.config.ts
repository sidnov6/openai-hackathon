import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Homi web app.
// The dev server proxies /api to the Fastify backend in apps/api so the browser uses
// same-origin cookies. Without that server the app runs on the clearly-labelled mock
// transport; see src/api/transport.ts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
})
