import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Needs `cd upcoming-events-custom-post-type-wordpress-rest-api && lps push` (post type, taxonomy,
// post meta, then the route) to have run against the instance first.
const route = (query = '') => `/?rest_route=/loopress-api/v1/events/upcoming${query}`

type Event = {end_date: string; id: number; start_date: string; title: string; types: string[]; venue: string}

// "Y-m-d H:i:s", days away from now. Whole days, so the site's timezone never flips a past event
// into the future.
const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')

test.describe('upcoming events route', () => {
  // A term of its own, so events already on the site never mix with the ones asserted here.
  const slug = `e2e-${Date.now()}`
  const ids: Record<string, number> = {}
  let termId: number

  test.beforeAll(async ({request, requestUtils}) => {
    const probe = await request.get(route(), {failOnStatusCode: false})
    test.skip(probe.status() === 404 && (await probe.text()).includes('rest_no_route'), 'recipe not pushed')

    termId = (await requestUtils.rest<{id: number}>({data: {name: slug, slug}, method: 'POST', path: '/wp/v2/event-type'})).id
    const create = async (key: string, start: number, end: number, status = 'publish') => {
      const event = await requestUtils.rest<{id: number}>({
        data: {'event-type': [termId], meta: {end_date: at(end), start_date: at(start), venue: `${key} hall`}, status, title: key},
        method: 'POST',
        path: '/wp/v2/event',
      })
      ids[key] = event.id
    }

    // Created out of order: the route sorts, not the insertion.
    await create('later', 20, 21)
    await create('past', -10, -9)
    await create('soon', 5, 5.1)
    await create('ongoing', -1, 1)
    await create('draft', 3, 4, 'draft')
  })

  test.afterAll(async ({requestUtils}) => {
    for (const id of Object.values(ids)) {
      await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/event/${id}`})
    }
    if (termId) await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/event-type/${termId}`})
  })

  test('lists published events not ended yet, soonest first', async ({request}) => {
    const response = await request.get(route(`&type=${slug}`))
    expect(response.headers()['cache-control']).toBe('public, max-age=300')
    const events = (await response.json()) as Event[]
    expect(events.map((event) => event.title)).toEqual(['ongoing', 'soon', 'later'])
    expect(events[1]).toMatchObject({id: ids.soon, types: [slug], venue: 'soon hall'})
    expect(events[1].start_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
  })

  test('works without a type and never lists a past or draft event', async ({request}) => {
    const listed = ((await (await request.get(route('&per_page=50'))).json()) as Event[]).map((event) => event.id)
    expect(listed).not.toContain(ids.past)
    expect(listed).not.toContain(ids.draft)
  })

  test('answers per_page events at most', async ({request}) => {
    const events = (await (await request.get(route(`&type=${slug}&per_page=1`))).json()) as Event[]
    expect(events.map((event) => event.title)).toEqual(['ongoing'])
  })

  test('pages through the list', async ({request}) => {
    const events = (await (await request.get(route(`&type=${slug}&per_page=2&page=2`))).json()) as Event[]
    expect(events.map((event) => event.title)).toEqual(['later'])
  })

  test('refuses an invalid per_page or page, or an unknown type', async ({request}) => {
    for (const [query, code] of [['&per_page=abc', 'invalid_per_page'], ['&per_page=-1', 'invalid_per_page'], ['&page=0', 'invalid_page'], ['&type=no-such-type', 'invalid_type']]) {
      const response = await request.get(route(query), {failOnStatusCode: false})
      expect(response.status(), query).toBe(400)
      expect(await response.json()).toMatchObject({code})
    }
  })
})
