import {defineConfig} from '@playwright/test';

// Builds the site and tests it in a real browser. Run: bun run test
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  use: {baseURL: 'http://localhost:4173', acceptDownloads: true},
  webServer: {command: 'bun run build && bunx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120000},
});
