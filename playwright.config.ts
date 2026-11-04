import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:5197',
    viewport: { width: 1440, height: 900 },
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5197 --strictPort',
    url: 'http://127.0.0.1:5197',
    reuseExistingServer: true,
  },
});
