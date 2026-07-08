import {execSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// setup-ci is a sibling submodule of this repo inside loopress-monorepo, which is where this
// resolves for local development. Demo's own standalone CI doesn't check setup-ci out alongside
// this repo: it resets the database itself between test groups via the `loopress/setup-ci/restore`
// GitHub Action instead (see .github/workflows/e2e.yml), so restoreCleanState() below is a no-op
// there rather than a hard failure.
const DEFAULT_RESTORE_SCRIPT = join(__dirname, '../../../../setup-ci/scripts/restore-wordpress.sh')
const RESTORE_SCRIPT = process.env.LOOPRESS_RESTORE_SCRIPT ?? DEFAULT_RESTORE_SCRIPT

export function restoreCleanState(): void {
  if (!existsSync(RESTORE_SCRIPT)) {
    console.log(
      `[restore] no restore script at ${RESTORE_SCRIPT}, skipping (the CI workflow resets via loopress/setup-ci/restore instead)`,
    )
    return
  }

  execSync(`bash "${RESTORE_SCRIPT}"`, {env: process.env, stdio: 'inherit'})
}
