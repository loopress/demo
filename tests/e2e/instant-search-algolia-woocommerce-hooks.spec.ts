import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Project: instant-search-algolia-woocommerce-hooks/ (lps composer push && lps hook push, WooCommerce active).
// There is no Algolia account, so the indexing test runs against tests/e2e/support/fake-algolia.php: copy it
// to wp-content/mu-plugins/ and it records the requests the real algoliasearch client builds instead of
// sending them. Without it the indexing tests are skipped, the search form test needs nothing else.
const fakeRoute = '/fake-algolia/v1/requests'

type Recorded = {
  apiKey: string
  appId: string
  body: {category: string | null; objectID: string; price: number; title: string}
  host: string
  method: string
  path: string
}

test.describe('Algolia search form hook', () => {
  test('get_product_search_form renders the recipe mount point, not the native form', async ({requestUtils}) => {
    // The legacy Product Search widget builds its markup with get_product_search_form(), the encode
    // endpoint returns that widget rendered as `preview`. No other HTTP path reaches that function on a block theme.
    const encoded = await requestUtils
      .rest<{preview: string}>({
        data: {instance: {title: ''}},
        method: 'POST',
        path: '/wp/v2/widget-types/woocommerce_product_search/encode',
      })
      .catch(() => null)
    test.skip(!encoded, 'WooCommerce is not active on this site')

    const {preview} = encoded!
    test.skip(/<form/.test(preview), 'hooks/replace-header-search.php is not pushed to this site')

    expect(preview).toContain('widget_product_search')
    // `lps app push algolia-search` was not run here, so the shortcode answers with its "no build" comment,
    // with the build it renders <div id="loopress-app-algolia-search">. Either way it is the shortcode.
    expect(preview).toMatch(/loopress_app: no committed build for "algolia-search"|id="loopress-app-algolia-search"/)
    expect(preview).not.toContain('woocommerce-product-search')
  })
})

test.describe('Algolia indexing hook', () => {
  const created: number[] = []

  test.beforeEach(async ({requestUtils}) => {
    const fake = await requestUtils.rest<Recorded[] | {code: string}>({path: fakeRoute}).catch(() => null)
    test.skip(!Array.isArray(fake), 'tests/e2e/support/fake-algolia.php is not installed as a mu-plugin on this site')
    await requestUtils.rest({method: 'DELETE', path: fakeRoute})
  })

  test.afterAll(async ({requestUtils}) => {
    for (const id of created) {
      await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wc/v3/products/${id}`})
    }
  })

  const requests = ({requestUtils}: {requestUtils: {rest: <T>(o: {path: string}) => Promise<T>}}) =>
    requestUtils.rest<Recorded[]>({path: fakeRoute})

  test('saving a published product sends its record to the products index', async ({requestUtils}) => {
    const product = await requestUtils.rest<{id: number}>({
      data: {name: "Levi's Jacket", regular_price: '59.90', status: 'publish'},
      method: 'POST',
      path: '/wc/v3/products',
    })
    created.push(product.id)

    const sent = await requests({requestUtils})
    expect(sent).toHaveLength(1)
    expect(sent[0].method).toBe('POST')
    expect(sent[0].path).toBe('/1/indexes/products')
    expect(sent[0].body).toEqual({category: 'Uncategorized', objectID: String(product.id), price: 59.9, title: "Levi's Jacket"})
  })

  test('updating the product sends the new values again, the same objectID', async ({requestUtils}) => {
    const product = await requestUtils.rest<{id: number}>({
      data: {name: 'Canvas Bag', regular_price: '20', status: 'publish'},
      method: 'POST',
      path: '/wc/v3/products',
    })
    created.push(product.id)
    await requestUtils.rest({data: {regular_price: '25'}, method: 'PUT', path: `/wc/v3/products/${product.id}`})

    const sent = (await requests({requestUtils})).filter((r) => r.body.objectID === String(product.id))
    expect(sent.map((r) => r.body.price)).toEqual([20, 25])
  })

  test('a draft product is not indexed', async ({requestUtils}) => {
    const product = await requestUtils.rest<{id: number}>({
      data: {name: 'Unreleased Boot', regular_price: '80', status: 'draft'},
      method: 'POST',
      path: '/wc/v3/products',
    })
    created.push(product.id)

    expect(await requests({requestUtils})).toEqual([])
  })
})
