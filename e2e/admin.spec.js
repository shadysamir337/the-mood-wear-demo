import { test, expect } from '@playwright/test'
import { fresh, adminLogin, addToCart, fillCheckout } from './helpers'

test.use({ timezoneId: 'Africa/Cairo' })
test.beforeEach(async ({ page }) => fresh(page))

const stockOf = (page, id, color, size) => page.evaluate(([id, color, size]) =>
  JSON.parse(localStorage.getItem('mood:v1:products')).find((p) => p.id === id).variants.find((v) => v.color === color && v.size === size).stock, [id, color, size])

async function placeOrder(page, over = {}) {
  await addToCart(page, 'maybe-tonight')
  await page.click('#go-checkout')
  await fillCheckout(page, over)
  await page.click('#place-order')
  await expect(page).toHaveURL(/\/order\//)
}

test('admin requires login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/admin\/login/)
  await page.fill('#a-email', 'admin@themood.co')
  await page.fill('#a-pass', 'wrong')
  await page.click('#a-login-btn')
  await expect(page.locator('.field-error')).toContainText('Wrong')
})

test('dashboard and every admin page load', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await adminLogin(page)
  for (const p of ['orders', 'products', 'moods', 'inventory', 'promos', 'sales', 'customers', 'settings']) {
    await page.goto(`/admin/${p}`)
    await expect(page.locator('.a-title')).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('create, edit and duplicate a product', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/products')
  await page.click('#new-product')
  await page.fill('#p-name', 'Quiet Loud')
  await page.selectOption('#p-mood', 'calm')
  await page.setInputFiles('.uploader input[type=file]', 'public/images/hoodie-black.jpg')
  await expect(page.locator('.uploader__item')).toHaveCount(1)
  await page.locator('.a-modal select').nth(1).selectOption('active')
  await page.locator('input[aria-label="Black M stock"]').fill('5')
  await page.click('#save-product')
  await expect(page.locator('.a-table', { hasText: 'Quiet Loud' })).toBeVisible()

  await page.goto('/product/quiet-loud')
  await expect(page.locator('h1')).toHaveText('Quiet Loud')

  await page.goto('/admin/products')
  await page.locator('tr', { hasText: 'Quiet Loud' }).locator('button', { hasText: 'Duplicate' }).click()
  await expect(page.locator('tr', { hasText: 'Quiet Loud (copy)' })).toBeVisible()
})

test('product slugs stay unique @demo', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/products')
  await page.click('#new-product')
  await page.fill('#p-name', 'Let It Be')
  await page.selectOption('#p-mood', 'calm')
  await page.setInputFiles('.uploader input[type=file]', 'public/images/hoodie-black.jpg')
  await expect(page.locator('.uploader__item')).toHaveCount(1)
  await page.click('#save-product')
  const slugs = await page.evaluate(() => JSON.parse(localStorage.getItem('mood:v1:products')).map((p) => p.slug))
  expect(new Set(slugs).size).toBe(slugs.length)
})

test('create a mood', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/moods')
  await page.click('#new-mood')
  await page.fill('#m-name', 'The Sunday Mood')
  await page.click('#save-mood')
  await expect(page.locator('.toast--ok')).toContainText('Mood saved')
  await page.goto('/moods/sunday')
  await expect(page.locator('h1')).toContainText('The Sunday Mood')
})

test('promo: create a fixed code and use it at checkout; duplicate codes are refused @demo', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/promos')
  await page.click('#new-promo')
  await page.fill('#promo-code', 'HELLO200')
  await page.selectOption('.a-modal select >> nth=0', 'fixed')
  await page.fill('#promo-value', '200')
  await page.click('#save-promo')
  await expect(page.locator('tr', { hasText: 'HELLO200' })).toBeVisible()

  await page.click('#new-promo')
  await page.fill('#promo-code', 'MOOD10')
  await page.fill('#promo-value', '50')
  await page.click('#save-promo')
  await expect(page.locator('.toast--err')).toBeVisible()
  const mood10 = await page.evaluate(() => JSON.parse(localStorage.getItem('mood:v1:promos')).find((p) => p.code === 'MOOD10').value)
  expect(mood10).toBe(10)
  await page.keyboard.press('Escape')

  await addToCart(page, 'maybe-tonight')
  await page.click('#go-checkout')
  await page.fill('#promo-input', 'HELLO200')
  await page.click('#promo-apply')
  await expect(page.locator('.totals__disc')).toContainText('200 EGP')
})

test('promo dates do not shift when re-saved (bug 7)', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/promos')
  await page.click('#new-promo')
  await page.fill('#promo-code', 'DATES')
  await page.locator('.a-modal input[type=date]').first().fill('2026-12-10')
  await page.click('#save-promo')
  await page.locator('tr', { hasText: 'DATES' }).locator('button', { hasText: 'Edit' }).click()
  await expect(page.locator('.a-modal input[type=date]').first()).toHaveValue('2026-12-10')
})

test('sale changes store prices', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/sales')
  await page.click('#new-sale')
  await page.fill('#sale-title', 'Mood sale')
  await page.fill('#sale-value', '20')
  await page.click('#save-sale')
  await expect(page.locator('.toast--ok')).toContainText('Sale saved')
  await page.goto('/product/let-it-be')
  await expect(page.locator('.pdp__price')).toContainText('1,080 EGP')
  await expect(page.locator('.pdp__price .badge--sale')).toContainText('20%')
})

test('orders: cancel returns stock, reopening takes it again, invalid transitions blocked @demo', async ({ page }) => {
  const before = await (async () => { await page.goto('/'); return stockOf(page, 'maybe-tonight', 'Black', 'M') })()
  await placeOrder(page)
  expect(await stockOf(page, 'maybe-tonight', 'Black', 'M')).toBe(before - 1)

  await adminLogin(page)
  await page.goto('/admin/orders')
  await page.locator('tr', { hasText: 'MOOD-1001' }).click()
  await page.selectOption('#order-status', 'cancelled')
  await page.click('#update-order')
  await expect(page.locator('.toast--ok')).toBeVisible()
  expect(await stockOf(page, 'maybe-tonight', 'Black', 'M')).toBe(before)

  await page.locator('tr', { hasText: 'MOOD-1001' }).click()
  await page.selectOption('#order-status', 'pending')
  await page.click('#update-order')
  await expect(page.locator('.toast--ok')).toBeVisible()
  expect(await stockOf(page, 'maybe-tonight', 'Black', 'M')).toBe(before - 1)

  for (const s of ['confirmed', 'shipped', 'delivered']) {
    await page.locator('tr', { hasText: 'MOOD-1001' }).click()
    await page.selectOption('#order-status', s)
    await page.click('#update-order')
    await expect(page.locator('.a-modal')).toBeHidden()
  }
  await page.locator('tr', { hasText: 'MOOD-1001' }).click()
  await expect(page.locator('#order-status option[value="pending"]')).toBeDisabled()
  await expect(page.locator('#order-status option[value="returned"]')).toBeEnabled()
})

test('order numbers stay unique after a delete @demo', async ({ page }) => {
  await placeOrder(page)
  await placeOrder(page, { phone: '01099999999' })
  await page.evaluate(() => {
    const k = 'mood:v1:orders'
    localStorage.setItem(k, JSON.stringify(JSON.parse(localStorage.getItem(k)).filter((o) => o.number !== 'MOOD-1001')))
  })
  await placeOrder(page, { phone: '01088888888' })
  const nums = await page.evaluate(() => JSON.parse(localStorage.getItem('mood:v1:orders')).map((o) => o.number))
  expect(new Set(nums).size).toBe(nums.length)
})

test('invoice escapes customer input (XSS)', async ({ page, context }) => {
  await placeOrder(page, { name: '<img src=x onerror="window.__pwned=1">' })
  await adminLogin(page)
  await page.goto('/admin/orders')
  await page.locator('tbody tr').first().click()
  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('text=Print invoice')])
  await popup.waitForLoadState()
  expect(await popup.evaluate(() => window.__pwned || window.opener?.__pwned)).toBeFalsy()
  await expect(popup.locator('body')).toContainText('<img')
})

test('inventory edit and settings change reach the store', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/inventory')
  const input = page.locator('input[aria-label="Let It Be Cream XL stock"]')
  await input.fill('7')
  await input.blur()
  await expect(page.locator('.toast--ok')).toBeVisible()
  await page.goto('/admin/settings')
  await page.locator('.field', { hasText: 'Announcement' }).locator('textarea').fill('Hello from settings')
  await page.click('#save-settings')
  await expect(page.locator('.toast--ok', { hasText: 'Settings saved' })).toBeVisible()
  await page.goto('/product/let-it-be')
  await expect(page.locator('.sizes button', { hasText: 'XL' })).toBeEnabled()
  await expect(page.locator('.announce')).toContainText('Hello from settings')
})

test('CSV export escapes formulas', async ({ page }) => {
  await placeOrder(page, { name: '=HYPERLINK("http://evil")' })
  await adminLogin(page)
  await page.goto('/admin/orders')
  await expect(page.locator('tbody tr').first()).toContainText('MOOD-')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Export CSV')])
  const csv = await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8')
  expect(csv).toContain("'=HYPERLINK")
})
