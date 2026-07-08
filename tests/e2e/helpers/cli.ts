import {execSync} from 'node:child_process'

export interface CliResult {
  exitCode: number
  stderr: string
  stdout: string
}

// `lps` is installed globally by setup-ci's "Install Loopress CLI" step (or by hand for local runs).
// execSync throws on a non-zero exit, so this normalizes both outcomes into one return shape,
// letting tests assert on failures (e.g. the auth-error scenario) without a try/catch of their own.
export function runCli(command: string): CliResult {
  try {
    const stdout = execSync(`lps ${command}`, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})
    return {exitCode: 0, stderr: '', stdout}
  } catch (error) {
    const failure = error as {status: null | number; stderr: Buffer | string; stdout: Buffer | string}
    return {
      exitCode: failure.status ?? 1,
      stderr: failure.stderr.toString(),
      stdout: failure.stdout.toString(),
    }
  }
}
