import {defineConfig} from '@playwright/test'
import {fileURLToPath} from 'node:url'

// Matches the defaults `loopress/setup-ci` boots WordPress with. Override these if pointing at a
// different instance (see README.md).
process.env.WP_BASE_URL ??= 'http://localhost:8080'
process.env.WP_USERNAME ??= 'admin'
process.env.WP_PASSWORD ??= 'admin'

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  globalSetup: fileURLToPath(new URL('./tests/e2e/global-setup.ts', import.meta.url)),
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.WP_BASE_URL,
    storageState: './tests/e2e/.auth/admin.json',
  },
})
