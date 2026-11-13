import {inflateSync} from 'node:zlib'

import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Needs `cd post-to-pdf-dompdf-wordpress-rest-api && lps composer push && lps api push`
// to have run against the instance first.
const route = (id: number | string) => `/?rest_route=/loopress-api/v1/post-pdf/${id}`

// dompdf deflates its content streams: inflate each one and collect the text shown by the operators.
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1')
  const texts: string[] = []
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = (match.index ?? 0) + match[0].length
    const end = raw.indexOf('endstream', start)
    try {
      const stream = inflateSync(pdf.subarray(start, end)).toString('latin1')
      for (const text of stream.matchAll(/\(([^)]*)\)/g)) texts.push(text[1])
    } catch {
      // not a deflated stream (font, image)
    }
  }
  return texts.join(' ')
}

test.describe('post to PDF route', () => {
  const ids: number[] = []
  let draft: number
  let locked: number
  let privatePost: number

  test.beforeAll(async ({requestUtils}) => {
    const create = async (title: string, status: string, extra: Record<string, unknown> = {}) => {
      const post = await requestUtils.rest<{id: number}>({
        data: {content: `<p>Body of ${title}</p>`, status, title, ...extra},
        method: 'POST',
        path: '/wp/v2/posts',
      })
      ids.push(post.id)
      return post.id
    }
    draft = await create('Secret draft', 'draft')
    privatePost = await create('Private notes', 'private')
    locked = await create('Locked post', 'publish', {password: 'pw'})
  })

  test.afterAll(async ({requestUtils}) => {
    for (const id of ids) {
      await requestUtils.rest({method: 'DELETE', params: {force: true}, path: `/wp/v2/posts/${id}`})
    }
  })

  test('returns a real PDF for post 1 with its title in the text', async ({request}) => {
    const response = await request.get(route(1))
    test.skip(response.status() === 404 && (await response.text()).includes('rest_no_route'), 'recipe not pushed')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/pdf')
    expect(response.headers()['content-disposition']).toContain('inline')
    const body = await response.body()
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(pdfText(body)).toContain('Hello world!')
  })

  test('refuses what an anonymous visitor cannot read, and invalid ids', async ({request}) => {
    for (const id of [draft, privatePost, locked, 99999999, 'abc', 0]) {
      const response = await request.get(route(id), {failOnStatusCode: false})
      test.skip(response.status() === 404 && (await response.text()).includes('rest_no_route'), 'recipe not pushed')
      expect(response.status(), String(id)).toBe(404)
      expect(response.headers()['content-type'], String(id)).not.toContain('application/pdf')
    }
  })
})
