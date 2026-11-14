import {execSync} from 'node:child_process'
import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Needs `cd qr-code-generation-wordpress-rest-api && lps composer push && lps cpt push && lps meta push && lps api push`
// to have run against the instance first.
//
// `_customer_id` is protected post meta: WordPress refuses to write it over REST, and rightly so, it is the
// access rule. Only the buyer test needs it set, through WP-CLI: set WP_CLI to the command that runs it against the
// instance under test (e.g. WP_CLI="wpbox wp"). Without it that one test is skipped.
const anonymous = (playwright: any) => playwright.request.newContext({baseURL: process.env.WP_BASE_URL, storageState: {cookies: [], origins: []}})

test.describe('Ticket QR code route', () => {
  const suffix = Date.now()
  const users: number[] = []
  let ticketId = 0
  let buyerId = 0
  let buyerAuth = ''
  let otherAuth = ''
  let adminAuth = ''

  async function createUser(requestUtils: any, name: string, role = 'subscriber') {
    const username = `${name}_${suffix}`
    const user = await requestUtils.rest({
      data: {email: `${username}@example.com`, password: 'Pa55word!x', roles: [role], username},
      method: 'POST',
      path: '/wp/v2/users',
    })
    users.push(user.id)
    const app = await requestUtils.rest({data: {name: 'qr-spec'}, method: 'POST', path: `/wp/v2/users/${user.id}/application-passwords`})
    return {auth: Buffer.from(`${username}:${app.password}`).toString('base64'), id: user.id as number}
  }

  test.beforeAll(async ({requestUtils}) => {
    const buyer = await createUser(requestUtils, 'buyer')
    buyerAuth = buyer.auth
    buyerId = buyer.id
    otherAuth = (await createUser(requestUtils, 'other')).auth
    adminAuth = (await createUser(requestUtils, 'boss', 'administrator')).auth
    const ticket = await requestUtils
      .rest<{id: number}>({
        data: {status: 'publish', title: `Ticket ${suffix}`},
        method: 'POST',
        path: '/wp/v2/ticket',
      })
      .catch(() => null)
    test.skip(!ticket, 'the ticket post type is not pushed: run `lps cpt push && lps meta push` in qr-code-generation-wordpress-rest-api/')
    ticketId = ticket!.id
  })

  test.afterAll(async ({requestUtils}) => {
    if (ticketId) {
      await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/ticket/${ticketId}`})
    }
    for (const id of users) {
      await requestUtils.rest({method: 'DELETE', params: {force: true, reassign: 1}, path: `/wp/v2/users/${id}`})
    }
  })

  const route = (id: number | string) => `/?rest_route=/loopress-api/v1/ticket-qr/${id}`

  async function expectPng(response: any) {
    expect(response.status()).toBe(200)
    const {data_uri: dataUri} = await response.json()
    expect(dataUri).toMatch(/^data:image\/png;base64,/)
    const png = Buffer.from(dataUri.split(',')[1], 'base64')
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  }

  test('the buyer gets a PNG data URI', async ({playwright}) => {
    test.skip(!process.env.WP_CLI, 'set WP_CLI to a command running WP-CLI on the instance, to set the ticket\'s protected _customer_id')
    execSync(`${process.env.WP_CLI} post meta update ${ticketId} _customer_id ${buyerId}`, {stdio: 'pipe'})
    const request = await anonymous(playwright)
    await expectPng(await request.get(route(ticketId), {headers: {Authorization: `Basic ${buyerAuth}`}}))
    await request.dispose()
  })

  test('an admin gets it too', async ({playwright}) => {
    const request = await anonymous(playwright)
    await expectPng(await request.get(route(ticketId), {headers: {Authorization: `Basic ${adminAuth}`}}))
    await request.dispose()
  })

  test('another logged-in user is refused', async ({playwright}) => {
    const request = await anonymous(playwright)
    const res = await request.get(route(ticketId), {failOnStatusCode: false, headers: {Authorization: `Basic ${otherAuth}`}})
    expect(res.status()).toBe(403)
    await request.dispose()
  })

  test('an anonymous caller is refused', async ({playwright}) => {
    const request = await anonymous(playwright)
    const res = await request.get(route(ticketId), {failOnStatusCode: false})
    expect(res.status()).toBe(401)
    await request.dispose()
  })

  test('a missing ticket, a post that is not a ticket and a non-numeric id are a 404 for an admin', async ({playwright}) => {
    const request = await anonymous(playwright)
    for (const id of [999999, 1, 'abc']) {
      const res = await request.get(route(id), {failOnStatusCode: false, headers: {Authorization: `Basic ${adminAuth}`}})
      expect(res.status(), String(id)).toBe(404)
      expect((await res.json()).code).toBe('not_found')
    }
    await request.dispose()
  })
})
