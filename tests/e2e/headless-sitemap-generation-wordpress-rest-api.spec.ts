import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Calls the route `headless-sitemap-generation-wordpress-rest-api/api/sitemap-data.php` deploys.
// Before running, the site needs the project pushed and two options set:
//   wp option update headless_frontend_url https://www.example.com
//   wp option update sitemap_build_secret <SITEMAP_BUILD_SECRET>
const route = '/wp-json/loopress-api/v1/sitemap-data'
const secret = process.env.SITEMAP_BUILD_SECRET ?? 's3cret-build-key'
const frontend = process.env.SITEMAP_FRONTEND_URL ?? 'https://www.example.com'

test.describe('headless sitemap route', () => {
  const created: Array<{id: number; type: 'pages' | 'posts'}> = []

  test.beforeEach(async ({request}) => {
    const probe = await request.get(route, {headers: {'x-build-secret': secret}})
    test.skip(probe.status() === 404, 'the recipe is not deployed on this site')
    test.skip(probe.status() === 401 || probe.status() === 403, 'sitemap_build_secret is not set to SITEMAP_BUILD_SECRET')
    test.skip(probe.status() === 500, 'headless_frontend_url is not set')
  })

  test.afterAll(async ({requestUtils}) => {
    for (const {id, type} of created) {
      await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/${type}/${id}`})
    }
  })

  test('serves a well-formed sitemap of absolute front-end URLs', async ({page, request, requestUtils}) => {
    const post = await requestUtils.rest<{id: number}>({data: {slug: 'sitemap-spec-post', status: 'publish', title: 'Sitemap spec post'}, method: 'POST', path: '/wp/v2/posts'})
    const draft = await requestUtils.rest<{id: number}>({data: {slug: 'sitemap-spec-draft', status: 'draft', title: 'Sitemap spec draft'}, method: 'POST', path: '/wp/v2/posts'})
    const pageItem = await requestUtils.rest<{id: number}>({data: {slug: 'sitemap-spec-page', status: 'publish', title: 'Sitemap spec page'}, method: 'POST', path: '/wp/v2/pages'})
    created.push({id: post.id, type: 'posts'}, {id: draft.id, type: 'posts'}, {id: pageItem.id, type: 'pages'})

    const response = await request.get(route, {headers: {'x-build-secret': secret}})
    expect(response.status()).toBe(200)
    const {urls, xml} = (await response.json()) as {urls: number; xml: string}

    // Well-formed XML in the sitemap namespace, parsed by the browser's own XML parser.
    await page.goto('about:blank')
    const parsed = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, 'application/xml')
      return {
        error: doc.getElementsByTagName('parsererror').length,
        locs: [...doc.getElementsByTagName('loc')].map((l) => l.textContent),
        namespace: doc.documentElement.namespaceURI,
        root: doc.documentElement.localName,
      }
    }, xml)

    expect(parsed.error).toBe(0)
    expect(parsed.root).toBe('urlset')
    expect(parsed.namespace).toBe('http://www.sitemaps.org/schemas/sitemap/0.9')
    expect(parsed.locs).toHaveLength(urls)

    // Every URL is absolute and on the front end's domain, never the WordPress origin.
    for (const loc of parsed.locs) expect(loc).toMatch(new RegExp(`^${frontend.replace(/[.]/g, '\\.')}/`))
    const wpOrigin = new URL(response.url()).origin
    expect(xml).not.toContain(wpOrigin)

    // Published posts and pages are listed, drafts are not.
    expect(parsed.locs.some((l) => l?.includes('sitemap-spec-post'))).toBe(true)
    expect(parsed.locs.some((l) => l?.includes('sitemap-spec-page'))).toBe(true)
    expect(parsed.locs.some((l) => l?.includes('sitemap-spec-draft'))).toBe(false)
  })

  test('refuses a caller without the right secret', async ({request}) => {
    for (const headers of [{}, {'x-build-secret': 'wrong'}, {'x-build-secret': ''}]) {
      const response = await request.get(route, {headers})
      expect([401, 403]).toContain(response.status())
    }
  })
})
