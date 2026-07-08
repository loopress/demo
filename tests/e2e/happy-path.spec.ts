import {expect, test} from '@playwright/test'
import {execSync} from 'node:child_process'
import {readFileSync, rmSync, writeFileSync} from 'node:fs'

import {runCli} from './helpers/cli'
import {restoreCleanState} from './helpers/restore'
import {findPulledFiles} from './helpers/snippets-dir'
import {createSnippet, getSnippet} from './helpers/wp-client'

test.describe('happy path', () => {
  test.beforeAll(() => {
    restoreCleanState()
  })

  test('pull, edit, and push round-trips a snippet through WordPress', async () => {
    const seed = await createSnippet({
      active: true,
      code: "echo 'before';",
      name: 'E2E Happy Path',
      type: 'php',
    })

    let pulledFiles: string[] = []
    try {
      const pull = runCli('snippet pull')
      expect(pull.exitCode, pull.stderr).toBe(0)

      pulledFiles = findPulledFiles(seed.id)
      expect(pulledFiles, 'pull should write a code file and a sidecar .json for the seeded snippet').toHaveLength(2)

      // Working tree should only reflect this one snippet's two new files, nothing else.
      const status = execSync('git status --porcelain -- snippets', {encoding: 'utf8'})
      const statusLines = status.trim().split('\n').filter(Boolean)
      expect(statusLines).toHaveLength(2)
      for (const line of statusLines) expect(line).toContain(`${seed.id}-`)

      const codeFile = pulledFiles.find((path) => path.endsWith('.php'))!
      const localCode = readFileSync(codeFile, 'utf8')
      writeFileSync(codeFile, localCode.replace('before', 'after'))

      const push = runCli('snippet push')
      expect(push.exitCode, push.stderr).toBe(0)

      const remote = await getSnippet(seed.id)
      expect(remote.code).toContain('after')
    } finally {
      for (const path of pulledFiles) rmSync(path, {force: true})
    }
  })
})
