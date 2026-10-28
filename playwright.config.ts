import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against a real OpenCloud with the app installed and basic auth
 * enabled for the API calls that prepare the test data (see README, "Development").
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 120_000,
  use: {
    baseURL: process.env.OPENCLOUD_URL || 'https://localhost:9200',
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // a browser installed outside of this project, e.g. one matching another Playwright version
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {}
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
