import { test, expect } from '@playwright/test'
import { fresh, addToCart, fillCheckout } from './helpers'

test.beforeEach(async ({ page }) => fresh(page))

test('home renders hero, featured products and moods', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.locator('.hero__title')).toContainText('Wear what')
  await expect(page.locator('.grid .card').first()).toBeVisible()
  await expect(page.locator('.moodrow')).toHaveCount(10)
  expect(errors).toEqual([])
})

test('intro can be skipped', async ({ page, context }) => {
  await context.clearCookies()
  const p2 = await context.newPage()
  await p2.goto('/')
  await p2.evaluate(() => { localStorage.removeItem('mood:intro') })
  await p2.reload()
  await expect(p2.locator('.intro')).toBeVisible()
  await p2.locator('.intro').click()
  await expect(p2.locator('.intro')).toBeHidden({ timeout: 1500 })
})

test('search finds products and closes with Escape', async ({ page }) => {
  await page.goto('/')
  await page.click('#open-search')
  await page.fill('.search__input', 'tonight')
  await expect(page.locator('.search__results li')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('.search')).toBeHidden()
})

test('shop filters and sort', async ({ page }) => {
  await page.goto('/shop')
  await expect(page.locator('.grid .card')).toHaveCount(7)
  await page.locator('.chip', { hasText: 'Calm' }).click()
  await expect(page.locator('.grid .card')).toHaveCount(1)
  await page.locator('.chip', { hasText: 'All' }).click()
  await page.locator('label.check', { hasText: 'On sale' }).click()
  await expect(page).toHaveURL(/sale=1/)
  await expect(page.locator('.grid .card')).toHaveCount(1)
  await page.locator('label.check', { hasText: 'On sale' }).click()
  await expect(page).not.toHaveURL(/sale=1/)
  await page.selectOption('select[aria-label="Sort"]', 'low')
  await expect(page.locator('.card__name').first()).toHaveText('Let It Be')
  await page.selectOption('select[aria-label="Size"]', 'XL')
  await expect(page.locator('.grid .card')).toHaveCount(6)
})

test('mood pages, coming-soon moods and unknown mood', async ({ page }) => {
  await page.goto('/moods')
  await expect(page.locator('.moodtile')).toHaveCount(10)
  await page.goto('/moods/love')
  await expect(page.locator('.moodhero__drop > .eyebrow')).toContainText('Drops 14 November')
  await page.goto('/moods/nope')
  await expect(page.locator("text=That mood doesn't exist.")).toBeVisible()
})

test('product page: size required, sold-out sizes disabled', async ({ page }) => {
  await page.goto('/product/let-it-be')
  await page.click('#add-to-cart')
  await expect(page.locator('text=Pick a size first.')).toBeVisible()
  await expect(page.locator('.sizes button', { hasText: 'XL' })).toBeDisabled()
})

test('cart cannot exceed available stock', async ({ page }) => {
  // Maybe Tonight, Black XL has 4 in stock
  await page.goto('/product/maybe-tonight')
  await page.locator('.sizes button', { hasText: /^XL$/ }).click()
  for (let i = 0; i < 6; i++) {
    await page.locator('#add-to-cart').click()
    if (await page.locator('.drawer').isVisible()) {
      await page.locator('#close-cart').click()
      await expect(page.locator('.drawer')).toBeHidden()
    }
  }
  await expect(page.locator('text=That\'s all we have in XL')).toBeVisible()
  await page.click('#open-cart')
  await expect(page.locator('.qty span')).toHaveText('4')
})

test('cart drawer: quantity, remove, free-shipping bar', async ({ page }) => {
  await addToCart(page, 'maybe-tonight')
  await expect(page.locator('.drawer__ship')).toContainText('away from free shipping')
  await page.click('button[aria-label="One more Maybe Tonight"]')
  await expect(page.locator('.drawer__ship')).toContainText('Free shipping unlocked')
  await page.click('.line__remove')
  await expect(page.locator('.drawer__empty')).toBeVisible()
})

test('checkout: validation, promo, order placed, tracking', async ({ page }) => {
  await addToCart(page, 'maybe-tonight')
  await page.click('#go-checkout')
  await expect(page).toHaveURL(/checkout/)
  // total must not include shipping before a governorate is picked
  await expect(page.locator('#place-order')).toContainText('1,450 EGP')
  await page.click('#place-order')
  await expect(page.locator('.field-error').first()).toBeVisible()

  await page.fill('#promo-input', 'NOPE')
  await page.click('#promo-apply')
  await expect(page.locator("text=That code doesn't exist.")).toBeVisible()
  await page.fill('#promo-input', 'mood10')
  await page.click('#promo-apply')
  await expect(page.locator('.promo__ok')).toContainText('MOOD10')

  await fillCheckout(page)
  await expect(page.locator('#place-order')).toContainText('1,360 EGP') // 1450 - 145 + 55
  await page.click('#place-order')
  await expect(page).toHaveURL(/\/order\/MOOD-\d+/)
  await expect(page.locator('.done__title')).toBeVisible()
  const number = page.url().split('/').pop()

  await page.goto('/track')
  await page.fill('#t-number', number)
  await page.fill('#t-phone', '01012345678')
  await page.click('button:has-text("Track")')
  await expect(page.locator('.tracked')).toContainText('pending')
})

test('info pages and 404', async ({ page }) => {
  for (const p of ['story', 'faq', 'shipping-returns', 'size-guide', 'contact', 'privacy']) {
    await page.goto(`/${p}`)
    await expect(page.locator('h1')).toBeVisible()
  }
  await page.goto('/definitely-not-here')
  await expect(page.locator('text=in the mood.')).toBeVisible()
})

test('shipping copy follows settings @demo', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const k = 'mood:v1:settings'
    const s = JSON.parse(localStorage.getItem(k))
    s[0].shipping.freeThreshold = 3000
    localStorage.setItem(k, JSON.stringify(s))
  })
  await page.goto('/product/let-it-be')
  await page.locator('.acc__head', { hasText: 'Shipping' }).click()
  await expect(page.locator('.acc__body')).toContainText('3,000 EGP')
  await page.goto('/shipping-returns')
  await expect(page.locator('.info')).toContainText('3,000 EGP')
})
