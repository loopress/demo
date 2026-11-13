import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Needs `cd markdown-export-for-llms-html-to-markdown-wordpress-rest-api && lps composer push && lps api push`
// to have run against the instance first.
const route = (id: number | string) => `/?rest_route=/loopress-api/v1/markdown/${id}`

const blocks = `<!-- wp:heading --><h2 class="wp-block-heading">Why</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Read the <a href="https://loopress.dev">docs</a>, <em>then</em> ship. Café ☕</p><!-- /wp:paragraph -->
<!-- wp:list --><ul><li>Git</li><li>CI</li></ul><!-- /wp:list -->
<!-- wp:code --><pre class="wp-block-code"><code>lps api push</code></pre><!-- /wp:code -->`

test.describe('markdown export route', () => {
  let published: number
  let draft: number
  let locked: number

  test.beforeAll(async ({requestUtils}) => {
    const create = (title: string, status: string, extra: Record<string, unknown> = {}) =>
      requestUtils.rest<{id: number}>({
        data: {content: blocks, status, title, ...extra},
        method: 'POST',
        path: '/wp/v2/posts',
      })
    published = (await create('Shipping notes', 'publish')).id
    draft = (await create('Secret draft', 'draft')).id
    locked = (await create('Locked', 'publish', {password: 'pw'})).id
  })

  test.afterAll(async ({requestUtils}) => {
    for (const id of [published, draft, locked]) {
      await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/posts/${id}`})
    }
  })

  test('serves a published post as Markdown', async ({request}) => {
    const response = await request.get(route(published))
    test.skip(response.status() === 404 && (await response.text()).includes('rest_no_route'), 'recipe not pushed')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/markdown')
    const body = await response.text()
    expect(body).toContain('# Shipping notes')
    expect(body).toContain('## Why')
    expect(body).toContain('[docs](https://loopress.dev)')
    expect(body).toContain('*then*')
    expect(body).toContain('Café ☕')
    expect(body).toMatch(/^- +Git$/m)
    expect(body).toContain('```\nlps api push\n```')
    expect(body).not.toContain('<')
  })

  test('answers 404 for a draft, a password-protected post, an unknown and an invalid id', async ({request}) => {
    for (const id of [draft, locked, 99999999, 'abc']) {
      const response = await request.get(route(id), {failOnStatusCode: false})
      test.skip(response.status() === 404 && (await response.text()).includes('rest_no_route'), 'recipe not pushed')
      expect(response.status(), String(id)).toBe(404)
      expect(await response.json()).toMatchObject({code: 'not_found'})
    }
  })
})
