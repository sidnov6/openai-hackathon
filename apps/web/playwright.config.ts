import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-failure',
    // Headless Chrome has no GPU, so MapLibre needs a software WebGL implementation.
    // Without these the map cannot start and only the schematic fallback is exercised.
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    // Forced onto the mock transport. These specs assert the truthfulness of the UI
    // (sample data labelled, counts literal, absent clauses stated, no invented dates),
    // which must hold regardless of transport - and a live backend would make them
    // non-deterministic. The live path is exercised by running the app normally.
    command: 'VITE_API_TRANSPORT=mock pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    // `channel: 'chrome'` drives the locally installed Google Chrome instead of a
    // Playwright-managed Chromium download. Drop the channel to use the bundled browser.
    { name: 'desktop', testMatch: /journey\.spec\.ts/, use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', testMatch: /journey\.spec\.ts/, use: { ...devices['Pixel 5'], channel: 'chrome' } },
    // Proves the app still works where WebGL is unavailable: the map degrades to the
    // schematic plot and the rest of the journey is unaffected.
    {
      name: 'no-webgl',
      testMatch: /(no-webgl|_dbg)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', launchOptions: { args: ['--disable-gpu', '--disable-webgl'] } },
    },
  ],
})
