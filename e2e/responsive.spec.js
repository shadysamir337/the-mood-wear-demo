import { test, expect } from '@playwright/test'
import { fresh } from './helpers'

const PAGES = { home: '/', shop: '/shop', moods: '/moods', product: '/product/maybe-tonight', story: '/story', checkout: '/checkout', track: '/track' }

for (const [name, path] of Object.entries(PAGES)) {
  test(`${name} has no horizontal overflow`, async ({ page }, info) => {
    await fresh(page)
    await page.goto(path)
    await page.waitForTimeout(1300)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png`, fullPage: false })
    expect(overflow).toBeLessThanOrEqual(1)
  })
}
