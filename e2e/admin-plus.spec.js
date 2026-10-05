import { test, expect } from '@playwright/test'
import { fresh, adminLogin, addToCart, fillCheckout } from './helpers'

test.beforeEach(async ({ page }) => fresh(page))

async function placeOrder(page, over = {}) {
  await addToCart(page, 'maybe-tonight')
  await page.click('#go-checkout')
  await fillCheckout(page, over)
  await page.click('#place-order')
  await expect(page).toHaveURL(/\/order\//)
  return page.url().split('/').pop()
}

test('manual order from the admin uses server pricing and stock', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/orders')
  await page.click('#new-manual-order')
  await page.selectOption('select[aria-label="Product"]', 'let-it-be')
  await page.selectOption('select[aria-label="Size"]', 'M')
  await page.fill('#mo-name', 'Insta Customer')
  await page.fill('#mo-phone', '01055555555')
  await page.selectOption('#mo-gov', 'Giza')
  await page.fill('#mo-street', '5 Pyramids Road')
  await page.click('#save-manual')
  await expect(page.locator('.toast--ok')).toContainText('1,405 EGP') // 1350 + 55
  await expect(page.locator('tr', { hasText: 'Insta Customer' })).toContainText('manual')
})

test('orders: paging, search by number, date filter @demo', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const base = { customer: { name: 'Bulk', phone: '01000000000', phoneKey: '01000000000', email: '' }, address: { governorate: 'Cairo', city: 'x', street: 'y' }, items: [{ productId: 'let-it-be', name: 'Let It Be', color: 'Cream', size: 'M', qty: 1, unitPrice: 1350 }], subtotal: 1350, discount: 0, shipping: 55, total: 1405, status: 'pending', paymentMethod: 'cod', paymentStatus: 'unpaid', timeline: [], tracking: {} }
    const now = Date.now()
    const orders = Array.from({ length: 30 }, (_, i) => ({ ...base, id: `o${i}`, number: `MOOD-${1001 + i}`, createdAt: now - i * 86400000 }))
    localStorage.setItem('mood:v1:orders', JSON.stringify(orders))
  })
  await adminLogin(page)
  await page.goto('/admin/orders')
  await expect(page.locator('tbody tr')).toHaveCount(25)
  await page.click('text=Older →')
  await expect(page.locator('tbody tr')).toHaveCount(5)
  await page.click('text=← Newer')
  await page.fill('#order-search', 'MOOD-1010')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.fill('#order-search', '')
  const d = new Date(Date.now() - 3 * 86400000)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  await page.fill('input[aria-label="From date"]', iso)
  await expect(page.locator('tbody tr')).toHaveCount(4)
})

test('packing slip has no prices and shows the amount to collect', async ({ page, context }) => {
  const number = await placeOrder(page)
  await adminLogin(page)
  await page.goto('/admin/orders')
  await page.locator('tr', { hasText: number }).click()
  const [slip] = await Promise.all([context.waitForEvent('page'), page.click('text=Packing slip')])
  await slip.waitForLoadState()
  await expect(slip.locator('body')).toContainText('Packing slip')
  await expect(slip.locator('body')).toContainText('Collect on delivery: 1,505 EGP')
  await expect(slip.locator('table')).not.toContainText('EGP')
})

test('courier tracking link reaches the customer tracking page', async ({ page }) => {
  const number = await placeOrder(page)
  await adminLogin(page)
  await page.goto('/admin/orders')
  await page.locator('tr', { hasText: number }).click()
  await page.selectOption('#order-status', 'confirmed')
  await page.locator('input[list="couriers"]').fill('Bosta')
  await page.locator('.field', { hasText: 'Tracking number' }).locator('input').fill('BX123')
  await expect(page.locator('text=Open tracking ↗')).toHaveAttribute('href', /track_num=BX123/)
  await page.click('#update-order')
  await expect(page.locator('.toast--ok')).toBeVisible()
  await page.click('#a-logout')
  await page.goto('/track')
  await page.fill('#t-number', number)
  await page.fill('#t-phone', '01012345678')
  await page.click('button:has-text("Track")')
  await expect(page.locator('.tracked a')).toHaveAttribute('href', /bosta\.co.*BX123/)
})

test('customers: notes and tags', async ({ page }) => {
  await placeOrder(page)
  await adminLogin(page)
  await page.goto('/admin/customers')
  await page.locator('tr', { hasText: 'Mona Adel' }).click()
  await page.fill('#cust-tags', 'vip, influencer')
  await page.fill('#cust-notes', 'Prefers evening delivery.')
  await page.click('#save-customer')
  await expect(page.locator('tr', { hasText: 'Mona Adel' })).toContainText('vip')
  await page.selectOption('select[aria-label="Tag"]', 'influencer')
  await expect(page.locator('tbody tr')).toHaveCount(1)
})

test('banner shows on the home page; scheduled product goes live; reorder changes the shop @demo', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/banners')
  await page.click('#new-banner')
  await page.fill('#banner-title', 'The Love Mood drops Friday.')
  await page.click('#save-banner')
  await expect(page.locator('.toast--ok')).toContainText('Banner saved')
  await page.goto('/')
  await expect(page.locator('.banner')).toContainText('The Love Mood drops Friday.')

  // a product scheduled in the past becomes active on the next catalog read
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('mood:v1:products'))
    const p = rows.find((x) => x.id === 'not-everything')
    p.status = 'scheduled'; p.publishAt = Date.now() + 3600_000
    localStorage.setItem('mood:v1:products', JSON.stringify(rows))
  })
  await page.goto('/shop')
  await expect(page.locator('.grid .card')).toHaveCount(6)
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('mood:v1:products'))
    rows.find((x) => x.id === 'not-everything').publishAt = Date.now() - 1000
    localStorage.setItem('mood:v1:products', JSON.stringify(rows))
  })
  await page.reload()
  await expect(page.locator('.grid .card')).toHaveCount(7)

  await page.goto('/admin/products')
  const rows = page.locator('tbody tr')
  const last = await rows.last().locator('b').first().textContent()
  await rows.last().dragTo(rows.first())
  await expect(page.locator('.toast--ok')).toContainText('Order saved')
  await page.goto('/shop')
  await expect(page.locator('.card__name').first()).toHaveText(last)
})

test('activity log records admin changes', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/sales')
  await page.click('#new-sale')
  await page.fill('#sale-title', 'Logged sale')
  await page.click('#save-sale')
  await expect(page.locator('.toast--ok')).toContainText('Sale saved')
  // in Firebase mode the log is written by a trigger a moment later
  await expect(async () => {
    await page.goto('/admin/activity')
    await expect(page.locator('tbody tr', { hasText: 'sales.create' })).toContainText('Logged sale', { timeout: 1500 })
  }).toPass({ timeout: 15000 })
  await expect(page.locator('tbody tr', { hasText: 'sales.create' })).toContainText('admin@themood.co')
})

test('settings: pausing COD stops checkout', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/settings')
  await page.locator('label.toggle', { hasText: 'Cash on delivery' }).click()
  await page.click('#save-settings')
  await expect(page.locator('.toast--ok', { hasText: 'Settings saved' })).toBeVisible()
  await addToCart(page, 'maybe-tonight')
  await page.click('#go-checkout')
  await expect(page.locator('#place-order')).toBeDisabled()
  await expect(page.locator("text=We're not taking orders right now")).toBeVisible()
})
