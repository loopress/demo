import {expect, test} from '@playwright/test'
import {readFileSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

import {runCli} from './helpers/cli'
import {restoreCleanState} from './helpers/restore'

const CONFIG_PATH = join(homedir(), '.loopress', 'config.json')

test.describe('errors', () => {
  let originalConfig: string

  test.beforeAll(() => {
    restoreCleanState()
    originalConfig = readFileSync(CONFIG_PATH, 'utf8')
  })

  test.afterAll(() => {
    writeFileSync(CONFIG_PATH, originalConfig)
  })

  test('an invalid application password produces a clear error, not a crash', () => {
    const config = JSON.parse(originalConfig) as {
      currentProject: {env: string; id: string}
      projects: Record<string, {environments: Record<string, {token: string}>}>
    }
    const env = config.projects[config.currentProject.id].environments[config.currentProject.env]
    env.token = 'admin:revoked-application-password'
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))

    const pull = runCli('snippet pull')

    expect(pull.exitCode).not.toBe(0)
    expect(pull.stderr).toContain('Authentication failed')
    // A raw Node stack trace ("at Object... (file.js:12:34)") means the CLI let an exception
    // escape unhandled instead of reporting it through its own error formatting.
    expect(pull.stderr).not.toMatch(/\n\s+at .+:\d+:\d+/)
  })
})
