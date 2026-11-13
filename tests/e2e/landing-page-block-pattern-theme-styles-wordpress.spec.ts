import {expect, test} from '@wordpress/e2e-test-utils-playwright'

// Needs `cd landing-page-block-pattern-theme-styles-wordpress && lps pattern push && lps theme style push
// && lps page push` to have run against the instance first, on a block theme.

test.describe('landing page shipped from the repo', () => {
  test.beforeEach(async ({page}) => {
    const response = await page.goto('/landing/')
    test.skip(response?.status() === 404, 'recipe not pushed')
  })

  test('the page renders its own HTML', async ({page}) => {
    await expect(page.getByRole('heading', {level: 2, name: 'Everything in one repository'})).toBeVisible()
  })

  test('the hero comes from the pattern', async ({page}) => {
    const hero = page.locator('.wp-block-group.has-brand-background-color')
    await expect(hero.getByRole('heading', {level: 1, name: 'Ship your site from Git'})).toBeVisible()
    await expect(hero.getByRole('link', {name: 'See the plans'})).toHaveAttribute('href', '#pricing')
  })

  test('the pattern is registered by Loopress', async ({requestUtils}) => {
    const patterns = await requestUtils.rest<{name: string; title: string}[]>({path: '/wp/v2/block-patterns/patterns'})
    expect(patterns.map(pattern => pattern.name)).toContain('loopress/hero')
  })

  test('the theme styles reach the page', async ({page}) => {
    const hero = page.locator('.wp-block-group.has-brand-background-color')
    await expect(hero).toHaveCSS('background-color', 'rgb(29, 53, 87)')
    await expect(page.getByRole('heading', {level: 1, name: 'Ship your site from Git'})).toHaveCSS('font-family', /Georgia/)
    const accent = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--wp--preset--color--accent').trim())
    expect(accent).toBe('#e63946')
  })
})
