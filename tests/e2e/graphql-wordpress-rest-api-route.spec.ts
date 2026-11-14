import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Needs `cd graphql-wordpress-rest-api-route && lps composer push && lps acf push && lps hook push && lps api push`
// to have run against the instance first (ACF active).
const endpoint = '/?rest_route=/loopress-api/v1/graphql'

test.describe('graphql route', () => {
  let published: number
  let draft: number
  let locked: number

  test.beforeAll(async ({requestUtils}) => {
    const create = (title: string, status: string, extra: Record<string, unknown> = {}) =>
      requestUtils.rest<{id: number}>({
        data: {status, title, ...extra},
        method: 'POST',
        path: '/wp/v2/posts',
      })
    published = (
      await create('GraphQL recipe post', 'publish', {meta: {reading_time: 4.5, summary: 'A short summary'}})
    ).id
    draft = (await create('GraphQL secret draft', 'draft', {meta: {summary: 'hidden'}})).id
    locked = (await create('GraphQL locked', 'publish', {password: 'pw'})).id
  })

  test.afterAll(async ({requestUtils}) => {
    for (const id of [published, draft, locked]) {
      await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/posts/${id}`})
    }
  })

  // An anonymous caller: no cookies, no nonce.
  const gql = async (playwright: any, baseURL: string | undefined, query: string) => {
    const context = await playwright.request.newContext({baseURL, storageState: undefined})
    const response = await context.post(endpoint, {data: {query}, failOnStatusCode: false})
    const text = await response.text()
    await context.dispose()
    return {response, text}
  }

  test('returns the ACF fields written through the core REST API', async ({baseURL, playwright}) => {
    const {response, text} = await gql(playwright, baseURL, `{ post(id: ${published}) { id title readingTime summary } }`)
    test.skip(response.status() === 404 && text.includes('rest_no_route'), 'recipe not pushed')
    expect(response.status()).toBe(200)
    expect(JSON.parse(text)).toEqual({
      data: {post: {id: String(published), readingTime: 4.5, summary: 'A short summary', title: 'GraphQL recipe post'}},
    })
  })

  test('answers a malformed query and an unknown field with GraphQL errors', async ({baseURL, playwright}) => {
    for (const [query, message] of [
      [`{ post(id: ${published} { id }`, 'Syntax Error'],
      [`{ post(id: ${published}) { nope } }`, 'Cannot query field "nope"'],
    ]) {
      const {response, text} = await gql(playwright, baseURL, query)
      test.skip(response.status() === 404 && text.includes('rest_no_route'), 'recipe not pushed')
      expect(response.status()).toBe(200)
      const body = JSON.parse(text)
      expect(body.errors[0].message).toContain(message)
      expect(body.data).toBeUndefined()
    }
  })

  test('does not expose a draft, a password-protected post or an unknown id to an anonymous caller', async ({baseURL, playwright}) => {
    for (const id of [draft, locked, 99_999_999]) {
      const {response, text} = await gql(playwright, baseURL, `{ post(id: ${id}) { title summary } }`)
      test.skip(response.status() === 404 && text.includes('rest_no_route'), 'recipe not pushed')
      expect(JSON.parse(text), String(id)).toEqual({data: {post: null}})
    }
  })

  test('an editor session reads a draft', async ({request}) => {
    // Logged in with a REST nonce, `current_user_can('read_post')` is true.
    const nonceResponse = await request.get('/wp-admin/admin-ajax.php?action=rest-nonce')
    const nonce = await nonceResponse.text()
    const response = await request.post(endpoint, {
      data: {query: `{ post(id: ${draft}) { title } }`},
      headers: {'X-WP-Nonce': nonce},
    })
    test.skip(response.status() === 404, 'recipe not pushed')
    expect(await response.json()).toEqual({data: {post: {title: 'GraphQL secret draft'}}})
  })

  test('rejects a query above the complexity limit', async ({baseURL, playwright}) => {
    const aliases = Array.from({length: 60}, (_, i) => `a${i}: post(id: ${published}) { id }`).join(' ')
    const {response, text} = await gql(playwright, baseURL, `{ ${aliases} }`)
    test.skip(response.status() === 404 && text.includes('rest_no_route'), 'recipe not pushed')
    expect(JSON.parse(text).errors[0].message).toContain('Max query complexity')
  })

  test('GraphiQL loads and runs its default query', async ({page}) => {
    const response = await page.goto('/?rest_route=/loopress-api/v1/graphiql')
    test.skip(response?.status() === 404, 'recipe not pushed')
    await expect(page.locator('.cm-editor, .graphiql-query-editor').first()).toContainText('readingTime', {timeout: 20_000})
    // Wait for the schema (introspection must pass the depth and complexity limits), then run.
    const run = page.waitForResponse((r) => r.url().includes('graphql') && r.request().postData()?.includes('readingTime') === true)
    await page.getByRole('button', {name: /execute query/i}).click()
    expect((await run).status()).toBe(200)
    await expect(page.locator('.graphiql-response')).toContainText('data')
  })
})
