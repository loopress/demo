import {defineConfig} from '@playwright/test'

// No test here drives a browser: these are CLI + WP REST API workflow tests, so there's no
// `use: { ... }` browser config and no reporter/trace noise meant for UI debugging.
export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: './tests/e2e',
  timeout: 30_000,
})
