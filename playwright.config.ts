import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  retries: 2,
  reporter: [['html'], ['junit', { outputFile: 'junit.xml' }]],
  use: {
    testIdAttribute: 'data-test',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
});
