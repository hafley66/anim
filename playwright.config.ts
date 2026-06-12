import { defineConfig } from '@playwright/test'

// `npm run test:e2e` — starts (or reuses) the vite dev server, same convention
// as bin/shoot-atlas.mjs. Override the target with URL.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: process.env.URL || 'http://localhost:5173/',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
