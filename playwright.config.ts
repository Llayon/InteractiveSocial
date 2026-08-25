import { defineConfig, devices } from '@playwright/test'

const PORT = 5173

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev --port 5173 --host 127.0.0.1 --strictPort',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
  projects: [
    {
      name: '360x800',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: '390x844',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: '430x932',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 430, height: 932 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: '1280x800',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
})
