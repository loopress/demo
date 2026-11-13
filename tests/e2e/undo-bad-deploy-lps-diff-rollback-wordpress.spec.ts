import {expect, test} from '@wordpress/e2e-test-utils-playwright'
import {execFileSync} from 'node:child_process'
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'

// Replays the recipe's story with the real `lps` CLI against the instance it is configured for:
// push, an edit outside Loopress, `lps diff`, a bad push, `lps menu rollback`.
// It works on a copy of undo-bad-deploy-lps-diff-rollback-wordpress/ in a temp directory, so the
// project's own files and snapshots are never touched. Skipped when `lps` is not installed.
const lps = process.env.LPS_BIN ?? 'lps'
const fixture = fileURLToPath(new URL('../../undo-bad-deploy-lps-diff-rollback-wordpress', import.meta.url))

type Result = {output: string; status: number}

test.describe('Undo a bad deploy', () => {
  test.setTimeout(120_000)
  const suffix = Date.now()
  const pages: number[] = []
  let project = ''
  let menuId = 0

  const run = (...args: string[]): Result => {
    try {
      return {output: execFileSync(lps, args, {cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}), status: 0}
    } catch (error: any) {
      return {output: `${error.stdout ?? ''}${error.stderr ?? ''}`, status: error.status ?? 1}
    }
  }

  test.beforeAll(async ({requestUtils}) => {
    project = mkdtempSync(join(tmpdir(), 'undo-deploy-'))
    cpSync(fixture, project, {recursive: true})
    const version = (() => {
      try {
        return execFileSync(lps, ['--version'], {encoding: 'utf8'})
      } catch {
        return ''
      }
    })()
    test.skip(!version, '`lps` is not installed')

    // The menu items point at pages by slug, so they have to exist.
    for (const slug of ['about', 'services', 'contact']) {
      const existing = await requestUtils.rest<Array<{id: number}>>({params: {slug, status: 'any'}, path: '/wp/v2/pages'})
      if (existing.length === 0) {
        const page = await requestUtils.rest<{id: number}>({data: {slug, status: 'publish', title: slug}, method: 'POST', path: '/wp/v2/pages'})
        pages.push(page.id)
      }
    }
  })

  test.afterAll(async ({requestUtils}) => {
    if (menuId) await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/menus/${menuId}`}).catch(() => null)
    for (const id of pages) await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/pages/${id}`}).catch(() => null)
    if (project) rmSync(project, {force: true, recursive: true})
  })

  test('shows an outside edit, refuses to overwrite it, and rolls a bad push back', async ({requestUtils}) => {
    const titles = async () => {
      const items = await requestUtils.rest<Array<{title: {raw: string}; menu_order: number; object: string; type: string}>>({
        params: {context: 'edit', menus: menuId, orderby: 'menu_order', order: 'asc', per_page: 100},
        path: '/wp/v2/menu-items',
      })
      return items.map((item) => (item.type === 'custom' ? item.title.raw : item.object))
    }

    // 1. The first deploy creates the menu from the repo.
    const first = run('menu', 'push')
    // Same failure as the `lps plugin push` step of the Loopress CI job: the CI config has no environment type yet.
    test.skip(first.output.includes('has no type'), 'lps is not configured with a typed environment for this instance')
    expect(first.status, first.output).toBe(0)
    const menus = await requestUtils.rest<Array<{id: number}>>({params: {slug: 'main'}, path: '/wp/v2/menus'})
    menuId = menus[0].id
    expect(await titles()).toEqual(['page', 'page', 'page'])
    expect(run('diff', '--only', 'menu').status).toBe(0)

    // 2. Someone adds an item in wp-admin: diff reports drift, and a push refuses to overwrite it.
    await requestUtils.rest({data: {menu_order: 4, menus: menuId, status: 'publish', title: `Summer sale ${suffix}`, type: 'custom', url: '/sale'}, method: 'POST', path: '/wp/v2/menu-items'})
    const drift = run('diff', '--only', 'menu')
    expect(drift.status).toBe(1)
    expect(drift.output).toContain(`Summer sale ${suffix}`)
    const refused = run('menu', 'push')
    expect(refused.status).not.toBe(0)
    expect(refused.output).toContain('outside Loopress')

    // 3. Pull brings the edit into the files, and the next push goes through.
    expect(run('menu', 'pull', '--yes').status).toBe(0)
    expect(run('diff', '--only', 'menu').status).toBe(0)
    expect(run('menu', 'push').status).toBe(0)

    // 4. A bad push drops the Services and Contact links.
    const file = join(project, 'menus', 'main.json')
    const menu = JSON.parse(readFileSync(file, 'utf8'))
    menu.items = [menu.items[0], menu.items[3]]
    writeFileSync(file, `${JSON.stringify(menu, null, 2)}\n`)
    expect(run('menu', 'push').status).toBe(0)
    expect(await titles()).toEqual(['page', `Summer sale ${suffix}`])

    // 5. Rollback restores the snapshot taken right before that push, a dry run changes nothing.
    const dry = run('menu', 'rollback', '--dry-run')
    expect(dry.status).toBe(0)
    expect(await titles()).toEqual(['page', `Summer sale ${suffix}`])
    const rollback = run('menu', 'rollback')
    expect(rollback.status, rollback.output).toBe(0)
    expect(await titles()).toEqual(['page', 'page', 'page', `Summer sale ${suffix}`])
  })
})
