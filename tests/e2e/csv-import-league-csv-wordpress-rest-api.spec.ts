import {readFileSync} from 'node:fs'
import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Needs `cd csv-import-league-csv-wordpress-rest-api && lps composer push && lps cpt push && lps api push`
// to have run against the instance first.
const route = '/?rest_route=/loopress-api/v1/import-products'
const csv = readFileSync(
  new URL('../../csv-import-league-csv-wordpress-rest-api/products.csv', import.meta.url),
  'utf8',
)

// The suite's admin cookies are applied to every new context by default: a Basic-auth caller must start without them.
const anonymous = (playwright: any) => playwright.request.newContext({baseURL: process.env.WP_BASE_URL, storageState: {cookies: [], origins: []}})

type Login = {id: number; auth: string}

test.describe('CSV import route', () => {
  const users: Record<string, Login> = {}
  const imported: number[] = []
  const suffix = Date.now()
  const skus = [`WDG-001`, `WDG-002`]

  test.beforeAll(async ({requestUtils}) => {
    for (const role of ['editor', 'subscriber']) {
      const username = `csv_${role}_${suffix}`
      const user = await requestUtils.rest<{id: number}>({
        data: {email: `${username}@example.com`, password: 'Pa55word!x', roles: [role], username},
        method: 'POST',
        path: '/wp/v2/users',
      })
      const app = await requestUtils.rest<{password: string}>({
        data: {name: 'csv-spec'},
        method: 'POST',
        path: `/wp/v2/users/${user.id}/application-passwords`,
      })
      users[role] = {auth: Buffer.from(`${username}:${app.password}`).toString('base64'), id: user.id}
    }
  })

  test.afterAll(async ({requestUtils}) => {
    for (const id of imported) {
      await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/catalog-product/${id}`})
    }
    for (const {id} of Object.values(users)) {
      await requestUtils.rest({method: 'DELETE', params: {force: true, reassign: 1}, path: `/wp/v2/users/${id}`})
    }
  })

  const post = (request: any, auth: string | null, body: Record<string, string>) =>
    request.post(route, {
      failOnStatusCode: false,
      form: body,
      headers: auth ? {Authorization: `Basic ${auth}`} : {},
    })

  test('imports valid rows as drafts, rejects the invalid one, then refuses duplicates', async ({playwright, requestUtils}) => {
    const request = await anonymous(playwright)
    // Start from a clean slate: a previous run may have left the SKUs behind.
    const existing = await requestUtils.rest<{id: number}[]>({
      params: {search: '', status: 'any', per_page: 100},
      path: '/wp/v2/catalog-product',
    }).catch(() => [])
    for (const {id} of existing) {
      const post = await requestUtils.rest<{title: {raw: string}}>({params: {context: 'edit'}, path: `/wp/v2/catalog-product/${id}`})
      if (['Widget, large', 'Café crème'].includes(post.title.raw)) {
        await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/catalog-product/${id}`})
      }
    }

    const response = await post(request, users.editor.auth, {csv})
    test.skip(response.status() === 404 && (await response.text()).includes('rest_no_route'), 'recipe not pushed')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.created).toHaveLength(2)
    expect(body.errors).toEqual(['row 3: missing sku or invalid price'])
    imported.push(...body.created)

    const titles: string[] = []
    for (const id of body.created) {
      const item = await requestUtils.rest<{status: string; title: {raw: string}}>({
        params: {context: 'edit'},
        path: `/wp/v2/catalog-product/${id}`,
      })
      expect(item.status).toBe('draft')
      titles.push(item.title.raw)
    }
    expect(titles).toEqual(['Widget, large', 'Café crème'])

    const again = await (await post(request, users.editor.auth, {csv})).json()
    expect(again.created).toEqual([])
    expect(again.errors).toEqual([
      `row 1: sku ${skus[0]} already exists`,
      `row 2: sku ${skus[1]} already exists`,
      'row 3: missing sku or invalid price',
    ])
  })

  test('refuses a caller below editor and an anonymous one', async ({playwright}) => {
    const request = await anonymous(playwright)
    const sub = await post(request, users.subscriber.auth, {csv})
    test.skip(sub.status() === 404, 'recipe not pushed')
    expect(sub.status()).toBe(403)
    expect([401, 403]).toContain((await post(request, null, {csv})).status())
  })

  test('answers 400 for a missing csv and a wrong header, 413 over the row cap', async ({playwright}) => {
    const request = await anonymous(playwright)
    const missing = await post(request, users.editor.auth, {})
    test.skip(missing.status() === 404, 'recipe not pushed')
    expect(missing.status()).toBe(400)
    expect(await missing.json()).toMatchObject({code: 'missing_csv'})
    const wrong = await post(request, users.editor.auth, {csv: 'a,b\n1,2\n'})
    expect(wrong.status()).toBe(400)
    expect(await wrong.json()).toMatchObject({code: 'invalid_header'})
    // Over the row cap: refused whole, nothing is half imported.
    const rows = Array.from({length: 1001}, (_, i) => `BIG-${i},n,1`).join('\n')
    const big = await post(request, users.editor.auth, {csv: `sku,name,price\n${rows}\n`})
    expect(big.status()).toBe(413)
    expect(await big.json()).toMatchObject({code: 'too_many_rows'})
  })
})
