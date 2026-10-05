import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fresh } from './helpers'

const PAGES = ['/', '/shop', '/moods', '/moods/calm', '/product/let-it-be', '/story', '/faq', '/track', '/size-guide']

for (const path of PAGES) {
  test(`no serious a11y violations on ${path}`, async ({ page }) => {
    await fresh(page)
    await page.goto(path)
    await page.waitForTimeout(1500)
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact))
    expect(bad.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target})`)).toEqual([])
  })
}

test('cart drawer traps focus and Escape closes it', async ({ page }) => {
  await fresh(page)
  await page.goto('/')
  await page.click('#open-cart')
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement.closest('.drawer'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.drawer')).toBeHidden()
})
