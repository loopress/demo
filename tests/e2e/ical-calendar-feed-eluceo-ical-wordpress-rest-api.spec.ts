import {expect, test, type RequestUtils} from '@wordpress/e2e-test-utils-playwright'

// Needs `cd ical-calendar-feed-eluceo-ical-wordpress-rest-api && lps composer push && lps cpt push && lps meta push && lps api push`
// to have run against the instance first.
const feed = '/?rest_route=/loopress-api/v1/events-calendar'

type Vevent = Record<string, string>

// A small RFC 5545 reader, enough to prove the feed is a valid calendar: CRLF line endings, folded
// lines joined back (a continuation starts with one space), BEGIN/END properly nested, and each
// VEVENT turned into its properties.
function parse(ics: string): {calendar: Record<string, string>; events: Vevent[]} {
  expect(ics).toContain('\r\n')
  expect(ics.endsWith('\r\n')).toBe(true)
  const lines = ics.slice(0, -2).split('\r\n')
  for (const line of lines) expect(Buffer.byteLength(line), `line over 75 octets: ${line}`).toBeLessThanOrEqual(75)
  const unfolded = lines.reduce<string[]>((all, line) => {
    if (line.startsWith(' ')) all[all.length - 1] += line.slice(1)
    else all.push(line)
    return all
  }, [])

  expect(unfolded[0]).toBe('BEGIN:VCALENDAR')
  expect(unfolded.at(-1)).toBe('END:VCALENDAR')
  const calendar: Record<string, string> = {}
  const events: Vevent[] = []
  let current: Vevent | undefined
  for (const line of unfolded.slice(1, -1)) {
    if (line === 'BEGIN:VEVENT') {
      expect(current).toBeUndefined()
      current = {}
    } else if (line === 'END:VEVENT') {
      expect(current).toBeDefined()
      events.push(current as Vevent)
      current = undefined
    } else {
      const at = line.indexOf(':')
      expect(at, `not a content line: ${line}`).toBeGreaterThan(0)
      const name = line.slice(0, at).split(';')[0]
      ;(current ?? calendar)[name] = line.slice(at + 1)
    }
  }

  expect(current).toBeUndefined()
  return {calendar, events}
}

const unescape = (value: string) => value.replace(/\\([,;nN\\])/g, (_, char: string) => (char === 'n' || char === 'N' ? '\n' : char))
// "Y-m-d H:i:s" to the iCalendar UTC form for a wall-clock time in Europe/Paris in winter (UTC+1).
const utc = (local: string) => new Date(`${local.replace(' ', 'T')}+01:00`).toISOString().replace(/[-:]|\.\d{3}/g, '')

test.describe('events iCal feed', () => {
  const ids: number[] = []
  let timezone: string

  const create = async (requestUtils: RequestUtils, title: string, meta: Record<string, string>, status = 'publish') => {
    const event = await requestUtils.rest<{id: number}>({data: {meta, status, title}, method: 'POST', path: '/wp/v2/event'})
    ids.push(event.id)
    return event.id
  }

  test.beforeAll(async ({request, requestUtils}) => {
    const probe = await request.get(feed, {failOnStatusCode: false})
    test.skip(probe.status() === 404, 'recipe not pushed')

    // A fixed zone with a known offset, so the UTC conversion is checked, not assumed.
    timezone = (await requestUtils.rest<{timezone_string: string}>({path: '/wp/v2/settings'})).timezone_string
    await requestUtils.rest({data: {timezone: 'Europe/Paris'}, method: 'POST', path: '/wp/v2/settings'})
  })

  test.afterAll(async ({requestUtils}) => {
    for (const id of ids) await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/event/${id}`})
    await requestUtils.rest({data: {timezone: timezone || 'UTC'}, method: 'POST', path: '/wp/v2/settings'})
  })

  test('serves a valid calendar of published events, times in UTC, values escaped', async ({request, requestUtils}) => {
    const long = `ical-e2e long ${'word '.repeat(30)}`.trim()
    const id = await create(requestUtils, 'ical-e2e Meetup, Part 1; "live"', {end_date: '2027-01-15 20:00:00', start_date: '2027-01-15 17:30:00', venue: 'La Cordée, Lyon; 2nd floor'})
    const longId = await create(requestUtils, long, {end_date: '2027-01-16 20:00:00', start_date: '2027-01-16 17:30:00', venue: ''})
    const draftId = await create(requestUtils, 'ical-e2e draft', {end_date: '2027-01-17 20:00:00', start_date: '2027-01-17 17:30:00'}, 'draft')
    const noDatesId = await create(requestUtils, 'ical-e2e no dates', {})

    const response = await request.get(feed)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('text/calendar; charset=utf-8')
    expect(response.headers()['content-disposition']).toBe('inline; filename="events.ics"')

    const {calendar, events} = parse(await response.text())
    expect(calendar).toMatchObject({CALSCALE: 'GREGORIAN', VERSION: '2.0'})
    expect(calendar.PRODID).toBeTruthy()

    const host = new URL(process.env.WP_BASE_URL ?? '').hostname
    const meetup = events.find((event) => event.UID === `event-${id}@${host}`)
    expect(meetup, 'published event is listed').toBeDefined()
    // RFC 5545: every VEVENT has a UID and DTSTAMP, and a DTSTART.
    for (const event of events) for (const name of ['UID', 'DTSTAMP', 'DTSTART', 'DTEND', 'SUMMARY']) expect(event[name], name).toBeTruthy()
    expect(unescape(meetup!.SUMMARY)).toBe('ical-e2e Meetup, Part 1; “live”')
    expect(meetup!.SUMMARY).toContain('\\,')
    expect(unescape(meetup!.LOCATION)).toBe('La Cordée, Lyon; 2nd floor')
    // Paris is UTC+1 in January: 17:30 local is 16:30Z.
    expect(meetup!.DTSTART).toBe(utc('2027-01-15 17:30:00'))
    expect(meetup!.DTSTART).toBe('20270115T163000Z')
    expect(meetup!.DTEND).toBe('20270115T190000Z')
    expect(meetup!.URL).toMatch(/^https?:\/\//)

    // A long title is folded on the wire and comes back whole once unfolded.
    expect(unescape(events.find((event) => event.UID === `event-${longId}@${host}`)!.SUMMARY)).toBe(long)
    expect(events.find((event) => event.UID === `event-${longId}@${host}`)!.LOCATION).toBeUndefined()

    const uids = events.map((event) => event.UID)
    expect(uids).not.toContain(`event-${draftId}@${host}`)
    expect(uids).not.toContain(`event-${noDatesId}@${host}`)
  })

  test('keeps the same UID when an event moves, so calendar apps update it', async ({request, requestUtils}) => {
    const id = await create(requestUtils, 'ical-e2e moving', {end_date: '2027-02-01 11:00:00', start_date: '2027-02-01 10:00:00'})
    const find = async () => parse(await (await request.get(feed)).text()).events.find((event) => event.SUMMARY === 'ical-e2e moving')!
    const before = await find()
    await requestUtils.rest({data: {meta: {end_date: '2027-02-02 12:00:00', start_date: '2027-02-02 11:00:00'}}, method: 'POST', path: `/wp/v2/event/${id}`})
    const after = await find()
    expect(after.UID).toBe(before.UID)
    expect(after.DTSTART).toBe('20270202T100000Z')
    expect(before.DTSTART).toBe('20270201T090000Z')
  })

  test('is public: no login needed', async ({playwright, baseURL}) => {
    const anonymous = await playwright.request.newContext({baseURL, storageState: undefined})
    const response = await anonymous.get(feed)
    expect(response.status()).toBe(200)
    expect(await response.text()).toMatch(/^BEGIN:VCALENDAR\r\n/)
    await anonymous.dispose()
  })
})
