import { test, expect } from '@playwright/test'
import { fresh } from './helpers'

test('sizes follow the selected colour (bug 8) @demo', async ({ page }) => {
  await fresh(page)
  await page.goto('/')
  await page.evaluate(() => {
    const k = 'mood:v1:products'
    const rows = JSON.parse(localStorage.getItem(k))
    const p = rows.find((x) => x.id === 'let-it-be')
    p.colors.push({ name: 'Black', hex: '#111' })
    p.variants.push({ sku: 'BLA-S', color: 'Black', size: 'S', stock: 0 }, { sku: 'BLA-XL', color: 'Black', size: 'XL', stock: 3 })
    localStorage.setItem(k, JSON.stringify(rows))
  })
  await page.goto('/product/let-it-be')
  // Cream: S in stock, XL sold out
  await expect(page.locator('.sizes button', { hasText: /^S$/ })).toBeEnabled()
  await expect(page.locator('.sizes button', { hasText: /^XL$/ })).toBeDisabled()
  await page.click('button[aria-label="Black"]')
  await expect(page.locator('.sizes button', { hasText: /^S$/ })).toBeDisabled()
  await expect(page.locator('.sizes button', { hasText: /^XL$/ })).toBeEnabled()
})
