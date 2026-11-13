import {createHmac} from 'node:crypto'
import {request, type APIRequestContext} from '@playwright/test'
import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Project: stripe-webhook-signature-verification-wordpress-rest-api/ (lps composer push && lps api push).
// No Stripe account: the spec signs the payload itself with Stripe's scheme, t=<timestamp>,v1=<HMAC-SHA256 of "t.payload">.
// The webhook secret is a site secret, never in the repo. Set the same value on the site
// (`wp option update stripe_webhook_secret <secret>`) and export it as STRIPE_WEBHOOK_SECRET.
const secret = process.env.STRIPE_WEBHOOK_SECRET
const route = '/index.php?rest_route=/loopress-api/v1/stripe-webhook'

const payload = JSON.stringify({data: {object: {metadata: {order_id: '0'}}}, id: 'evt_test_1', object: 'event', type: 'checkout.session.completed'})

function sign(body: string, timestamp: number, key: string): string {
  return `t=${timestamp},v1=${createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex')}`
}

test.describe('stripe webhook signature', () => {
  let anon: APIRequestContext
  let deployed = false

  test.beforeAll(async ({}, info) => {
    anon = await request.newContext({baseURL: info.project.use.baseURL})
    // The shared E2E workflow only boots WordPress, it does not run `lps api push`: without the route there is nothing to test.
    deployed = (await (await anon.post(route, {data: '{}', headers: {'Content-Type': 'application/json'}})).json()).code !== 'rest_no_route'
  })

  test.beforeEach(() => {
    test.skip(!deployed, 'the recipe route is not pushed to this site')
    test.skip(!secret, 'STRIPE_WEBHOOK_SECRET is not exported')
  })

  test.afterAll(async () => {
    await anon.dispose()
  })

  const send = (body: string, signature?: string) =>
    anon.post(route, {data: body, headers: {'Content-Type': 'application/json', ...(signature ? {'Stripe-Signature': signature} : {})}})

  const now = () => Math.floor(Date.now() / 1000)

  test('accepts a payload signed with the secret', async () => {
    const response = await send(payload, sign(payload, now(), secret!))
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ok: true, type: 'checkout.session.completed'})
  })

  test('refuses a wrong signature, a modified body, an old timestamp and a missing header', async () => {
    const refused = async (response: Awaited<ReturnType<typeof send>>) => {
      expect(response.status()).toBe(401)
      expect((await response.json()).code).toBe('rest_forbidden')
    }

    await refused(await send(payload, sign(payload, now(), 'whsec_not_the_site_secret')))
    await refused(await send(payload.replace('evt_test_1', 'evt_test_2'), sign(payload, now(), secret!)))
    await refused(await send(payload, sign(payload, now() - 600, secret!)))
    await refused(await send(payload))
  })
})
