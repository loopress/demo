import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Needs `cd client-editor-role-wordpress && lps role push` to have run against the instance first.
const anonymous = (playwright: any) => playwright.request.newContext({baseURL: process.env.WP_BASE_URL, storageState: {cookies: [], origins: []}})

test.describe('Client editor role', () => {
  const suffix = Date.now()
  const username = `client_${suffix}`
  const password = 'Pa55word!x'
  let userId = 0
  let auth = ''
  const posts: number[] = []

  test.beforeAll(async ({requestUtils}) => {
    const user = await requestUtils.rest<{id: number}>({
      data: {email: `${username}@example.com`, password, roles: ['client-editor'], username},
      method: 'POST',
      path: '/wp/v2/users',
    }).catch(() => null)
    test.skip(!user, 'the client-editor role is not pushed: run `lps role push` in client-editor-role-wordpress/')
    userId = user!.id
    const app = await requestUtils.rest<{password: string}>({
      data: {name: 'client-editor-spec'},
      method: 'POST',
      path: `/wp/v2/users/${userId}/application-passwords`,
    })
    auth = Buffer.from(`${username}:${app.password}`).toString('base64')
  })

  test.afterAll(async ({requestUtils}) => {
    for (const id of posts) {
      await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/posts/${id}`})
    }
    if (userId) {
      await requestUtils.rest({method: 'DELETE', params: {force: true, reassign: 1}, path: `/wp/v2/users/${userId}`})
    }
  })

  test('writes and publishes content, but cannot touch plugins, themes or options over REST', async ({playwright}) => {
    const request = await anonymous(playwright)
    const headers = {Authorization: `Basic ${auth}`}

    const created = await request.post('/?rest_route=/wp/v2/posts', {
      data: {content: 'Written by the client.', status: 'publish', title: `Client post ${suffix}`},
      failOnStatusCode: false,
      headers,
    })
    expect(created.status()).toBe(201)
    const post = await created.json()
    posts.push(post.id)
    expect(post.status).toBe('publish')

    const page = await request.post('/?rest_route=/wp/v2/pages', {data: {status: 'publish', title: `Client page ${suffix}`}, failOnStatusCode: false, headers})
    expect(page.status()).toBe(201)
    await request.delete(`/?rest_route=/wp/v2/pages/${(await page.json()).id}&force=true`, {headers})

    const plugins = await request.get('/?rest_route=/wp/v2/plugins', {failOnStatusCode: false, headers})
    expect(plugins.status()).toBe(403)
    const settings = await request.post('/?rest_route=/wp/v2/settings', {data: {title: 'Hacked'}, failOnStatusCode: false, headers})
    expect(settings.status()).toBe(403)
    const themes = await request.get('/?rest_route=/wp/v2/themes', {failOnStatusCode: false, headers})
    expect(themes.status()).toBe(403)
    await request.dispose()
  })

  test('in wp-admin the editor screens open and plugins, themes and options are forbidden', async ({browser, baseURL}) => {
    const context = await browser.newContext({baseURL, storageState: {cookies: [], origins: []}})
    const page = await context.newPage()
    await page.goto('/wp-login.php')
    await page.fill('#user_login', username)
    await page.fill('#user_pass', password)
    await page.click('#wp-submit')
    await page.waitForURL(/wp-admin/)

    for (const path of ['upload.php', 'edit.php']) {
      const response = await page.goto(`/wp-admin/${path}`)
      expect(response?.status(), path).toBe(200)
    }
    for (const path of ['plugins.php', 'plugin-install.php', 'themes.php', 'options-general.php']) {
      const response = await page.goto(`/wp-admin/${path}`)
      expect(response?.status(), path).toBe(403)
    }
    await context.close()
  })
})
