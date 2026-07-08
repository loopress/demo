import {expect, test} from '@playwright/test'
import {rmSync, writeFileSync} from 'node:fs'

import {runCli} from './helpers/cli'
import {restoreCleanState} from './helpers/restore'
import {findPulledFiles} from './helpers/snippets-dir'
import {createSnippet, getSnippet, updateSnippet} from './helpers/wp-client'

test.describe('conflicts', () => {
  test.beforeAll(() => {
    restoreCleanState()
  })

  // `snippet push` (src/commands/snippet/push.ts) does a blind PUT of the local payload: it never
  // reads current remote state first, so it can't tell a clean push from one that clobbers a
  // change made on WordPress after the last pull. This test asserts the SAFE behavior (remote
  // changes made between pull and push are preserved, or the push is refused) and is wrapped in
  // test.fail() because that safe behavior doesn't exist yet: today, push silently overwrites it.
  // Once conflict detection ships in the CLI, this test will start passing, Playwright will flag
  // it as an "unexpected pass", and test.fail() should be removed at that point.
  test.fail(true, 'the CLI has no conflict detection yet: push silently overwrites concurrent remote edits')

  test('a remote edit made after pull is not silently overwritten by push', async () => {
    const seed = await createSnippet({
      active: true,
      code: "echo 'seed';",
      name: 'E2E Conflict',
      type: 'php',
    })

    let pulledFiles: string[] = []
    try {
      const pull = runCli('snippet pull')
      expect(pull.exitCode, pull.stderr).toBe(0)
      pulledFiles = findPulledFiles(seed.id)

      const codeFile = pulledFiles.find((path) => path.endsWith('.php'))!
      writeFileSync(codeFile, "echo 'local edit';")

      // Someone else changes the snippet on WordPress directly, after our pull.
      await updateSnippet(seed.id, {code: "echo 'concurrent remote edit';"})

      const push = runCli('snippet push')

      // Desired safe behavior: push refuses to clobber the concurrent change.
      expect(push.exitCode, 'push should fail instead of silently overwriting a concurrent remote edit').not.toBe(0)
      const remote = await getSnippet(seed.id)
      expect(remote.code, 'the concurrent remote edit should survive the push').toContain('concurrent remote edit')
    } finally {
      for (const path of pulledFiles) rmSync(path, {force: true})
    }
  })
})
