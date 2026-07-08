import {readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

const SNIPPETS_ENDPOINT = 'loopress/v1/snippets'

interface GlobalConfig {
  currentProject: {env: string; id: string} | null
  projects: Record<string, {environments: Record<string, {token: string; url: string}>}>
}

// Reads the same ~/.loopress/config.json the `lps` CLI reads, so tests hit the exact site/
// credentials a real push/pull would use without duplicating loopress.json parsing.
function currentSite(): {token: string; url: string} {
  const configPath = join(homedir(), '.loopress', 'config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as GlobalConfig
  if (!config.currentProject) throw new Error(`No current project configured in ${configPath}`)

  const project = config.projects[config.currentProject.id]
  const env = project.environments[config.currentProject.env]
  return {token: env.token, url: env.url}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {token, url} = currentSite()
  const response = await fetch(`${url}/wp-json/${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(token).toString('base64')}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`WP REST ${init.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`)
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export interface WpSnippet {
  active: boolean
  code: string
  id: number
  name: string
  [key: string]: unknown
}

export function listSnippets(): Promise<WpSnippet[]> {
  return request<WpSnippet[]>(SNIPPETS_ENDPOINT)
}

export function getSnippet(id: number): Promise<WpSnippet> {
  return request<WpSnippet>(`${SNIPPETS_ENDPOINT}/${id}`)
}

export function createSnippet(payload: Partial<WpSnippet>): Promise<WpSnippet> {
  return request<WpSnippet>(SNIPPETS_ENDPOINT, {
    body: JSON.stringify(payload),
    method: 'POST',
  })
}

export function updateSnippet(id: number, payload: Partial<WpSnippet>): Promise<WpSnippet> {
  return request<WpSnippet>(`${SNIPPETS_ENDPOINT}/${id}`, {
    body: JSON.stringify(payload),
    method: 'PUT',
  })
}
