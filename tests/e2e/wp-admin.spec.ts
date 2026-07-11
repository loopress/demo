import {expect, test} from '@wordpress/e2e-test-utils-playwright'

test('WordPress admin loads', async ({admin}) => {
  await admin.visitAdminPage('index.php')
  await expect(admin.page.locator('#wpadminbar')).toBeVisible()
})
