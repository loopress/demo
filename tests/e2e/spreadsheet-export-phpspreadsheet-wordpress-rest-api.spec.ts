import {execFileSync} from 'node:child_process'
import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {request, type APIRequestContext} from '@playwright/test'
import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Project: spreadsheet-export-phpspreadsheet-wordpress-rest-api/ (lps composer push, activate WooCommerce, lps api push).
// The spec creates its own completed order through the WooCommerce REST API, so it does not depend on seeded data.
const route = '/index.php?rest_route=/loopress-api/v1/orders-export'
const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Reads one file out of the .xlsx (a ZIP) with the system `unzip`: no extra dependency.
function readEntry(xlsx: Buffer, entry: string): string {
  const file = join(mkdtempSync(join(tmpdir(), 'orders-xlsx-')), 'orders.xlsx')
  writeFileSync(file, xlsx)
  return execFileSync('unzip', ['-p', file, entry], {encoding: 'utf8'})
}

// A plain fetch with an application password: Playwright's request context did not send these credentials to the route.
type Caller = {get: (path: string) => Promise<Response>}
const basic = (baseURL: string, user: string, password: string): Caller => ({
  get: (path) => fetch(baseURL + path, {headers: {Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`}}),
})

test.describe('spreadsheet export', () => {
  let admin: Caller
  let anon: APIRequestContext
  let subscriber: Caller
  let deployed = false
  let orderId = 0
  let userId = 0
  let adminAppId = ''

  test.beforeAll(async ({requestUtils}, info) => {
    const baseURL = info.project.use.baseURL
    anon = await request.newContext({baseURL})

    const probe = await anon.get(route)
    // The shared E2E workflow only boots WordPress: without the route and WooCommerce there is nothing to test.
    deployed = (await probe.json()).code !== 'rest_no_route'
    if (!deployed) return

    const order = await requestUtils.rest<{id: number}>({
      data: {billing: {email: 'spec-buyer@example.com'}, line_items: [], fee_lines: [{name: 'Spec fee', total: '123.45'}], status: 'completed'},
      method: 'POST',
      path: '/wc/v3/orders',
    })
    orderId = order.id

    // Cookie sessions need a nonce on raw requests, so the admin and the subscriber both call the route with an application password.
    const adminApp = await requestUtils.rest<{password: string; uuid: string}>({data: {name: 'spec'}, method: 'POST', path: '/wp/v2/users/me/application-passwords'})
    adminAppId = adminApp.uuid
    admin = basic(baseURL!, process.env.WP_USERNAME!, adminApp.password)

    const user = await requestUtils.createUser({email: `spec-sub-${Date.now()}@example.com`, password: 'spec-Subscriber-1', username: `spec-sub-${Date.now()}`})
    userId = user.id
    const app = await requestUtils.rest<{password: string}>({
      data: {name: 'spec'},
      method: 'POST',
      path: `/wp/v2/users/${userId}/application-passwords`,
    })
    subscriber = basic(baseURL!, user.username, app.password)
  })

  test.beforeEach(() => {
    test.skip(!deployed, 'the recipe route is not pushed to this site')
  })

  test.afterAll(async ({requestUtils}) => {
    if (orderId) await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wc/v3/orders/${orderId}`})
    if (userId) await requestUtils.rest({method: 'DELETE', params: {force: true, reassign: 1}, path: `/wp/v2/users/${userId}`})
    if (adminAppId) await requestUtils.rest({method: 'DELETE', path: `/wp/v2/users/me/application-passwords/${adminAppId}`})
    await anon.dispose()
  })

  test('an admin gets a real .xlsx with one row per completed order', async ({requestUtils}) => {
    const response = await admin.get(route)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(xlsxType)
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="orders-\d{4}-\d{2}-\d{2}\.xlsx"$/)

    const body = Buffer.from(await response.arrayBuffer())
    expect(body.subarray(0, 2).toString('latin1')).toBe('PK')

    const sheet = readEntry(body, 'xl/worksheets/sheet1.xml')
    const strings = readEntry(body, 'xl/sharedStrings.xml')
    expect(strings).toContain('Order ID')
    expect(strings).toContain('spec-buyer@example.com')

    const completed = await requestUtils.rest<unknown[]>({params: {per_page: 100, status: 'completed'}, path: '/wc/v3/orders'})
    expect(sheet.match(/<row /g)).toHaveLength(completed.length + 1)

    // The spec's order: its id in column A, its total in column C, stored as a number.
    const row = sheet.match(new RegExp(`<row [^>]*><c r="A\\d+"><v>${orderId}</v></c>.*?</row>`))
    expect(row?.[0]).toMatch(/<c r="C\d+"><v>123\.45<\/v><\/c>/)
  })

  test('a non-admin user is refused', async () => {
    const response = await subscriber.get(route)
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('rest_forbidden')
  })

  test('an anonymous caller is refused', async () => {
    const response = await anon.get(route)
    expect(response.status()).toBe(401)
    expect((await response.json()).code).toBe('rest_forbidden')
  })
})
