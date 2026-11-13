import {createHmac} from 'node:crypto'
import {request, type APIRequestContext} from '@playwright/test'
import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Project: headless-draft-preview-php-jwt-wordpress-rest-api/ (lps composer push && lps api push).
// The signing key is a site secret, never in the repo. Export the same value the site uses
// (PREVIEW_JWT_SECRET constant or preview_jwt_secret option) as PREVIEW_JWT_SECRET to run the
// whole loop, including the expired token. Without it only the "not configured" answer is checked.
const secret = process.env.PREVIEW_JWT_SECRET
const base = '/index.php?rest_route=/loopress-api/v1'

const b64 = (value: object | Buffer): string => Buffer.from(value instanceof Buffer ? value : JSON.stringify(value)).toString('base64url')

function sign(claims: object, key: string): string {
  const head = b64({alg: 'HS256', typ: 'JWT'})
  const body = b64(claims)
  return `${head}.${body}.${b64(createHmac('sha256', key).update(`${head}.${body}`).digest())}`
}

test.describe('headless draft preview', () => {
  let anon: APIRequestContext
  let deployed = false

  test.beforeAll(async ({}, info) => {
    anon = await request.newContext({baseURL: info.project.use.baseURL})
    // The shared E2E workflow only boots WordPress, it does not run `lps api push`: without the routes there is nothing to test.
    deployed = (await (await anon.get(`${base}/preview/1`)).json()).code !== 'rest_no_route'
  })

  test.beforeEach(() => {
    test.skip(!deployed, 'the recipe routes are not pushed to this site')
  })

  test.afterAll(async () => {
    await anon.dispose()
  })

  test('a signed token opens one draft and nothing else', async ({requestUtils}) => {
    test.skip(!secret, 'PREVIEW_JWT_SECRET is not exported')

    const draft = await requestUtils.rest<{id: number}>({data: {status: 'draft', title: 'Our autumn roadmap', content: '<p>Soon</p>'}, method: 'POST', path: '/wp/v2/posts'})
    const other = await requestUtils.rest<{id: number}>({data: {status: 'draft', title: 'Other draft'}, method: 'POST', path: '/wp/v2/posts'})

    // A draft is private on the core route.
    expect((await anon.get(`/index.php?rest_route=/wp/v2/posts/${draft.id}`)).status()).toBe(401)

    const issued = await requestUtils.rest<{expires_in: number; token: string}>({method: 'POST', path: `/loopress-api/v1/preview-link/${draft.id}`})
    expect(issued.expires_in).toBe(900)

    const ok = await anon.get(`${base}/preview/${draft.id}&token=${issued.token}`)
    expect(ok.status()).toBe(200)
    expect(await ok.json()).toMatchObject({id: draft.id, status: 'draft', title: 'Our autumn roadmap'})

    const refused = [
      `${base}/preview/${other.id}&token=${issued.token}`, // a token for another post
      `${base}/preview/${draft.id}&token=${issued.token.slice(0, -1)}x`, // tampered
      `${base}/preview/${draft.id}&token=${sign({aud: 'draft-preview', exp: Math.floor(Date.now() / 1000) - 60, sub: draft.id}, secret!)}`, // expired
      `${base}/preview/${draft.id}&token=${sign({aud: 'other', exp: Math.floor(Date.now() / 1000) + 600, sub: draft.id}, secret!)}`, // wrong purpose
      `${base}/preview/${draft.id}&token=${sign({aud: 'draft-preview', exp: Math.floor(Date.now() / 1000) + 600, sub: draft.id}, 'x'.repeat(40))}`, // wrong key
      `${base}/preview/${draft.id}`, // no token
    ]

    for (const url of refused) {
      const response = await anon.get(url)
      expect(response.status(), url).toBe(401)
      expect((await response.json()).code).toBe('invalid_token')
    }
  })

  test('issuing a token needs the right to edit that post', async ({requestUtils}) => {
    const draft = await requestUtils.rest<{id: number}>({data: {status: 'draft', title: 'Private'}, method: 'POST', path: '/wp/v2/posts'})

    expect((await anon.post(`${base}/preview-link/${draft.id}`)).status()).toBe(401)
  })

  test('without a secret the routes refuse instead of signing with an empty key', async ({requestUtils}) => {
    test.skip(Boolean(secret), 'a secret is configured')

    const draft = await requestUtils.rest<{id: number}>({data: {status: 'draft', title: 'No secret'}, method: 'POST', path: '/wp/v2/posts'})
    const response = await anon.get(`${base}/preview/${draft.id}&token=x`)

    expect(response.status()).toBe(500)
  })
})
