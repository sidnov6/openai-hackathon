import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// jsdom gives the mock adapter a localStorage, which its persistence layer needs.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
