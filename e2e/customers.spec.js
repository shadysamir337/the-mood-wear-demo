import { test, expect } from '@playwright/test'
import { fresh, adminLogin, addToCart, fillCheckout } from './helpers'
import { isFirebaseRun } from './firebase-setup.js'

test.beforeEach(async ({ page }) => fresh(page))

async function signup(page, email = `mona${Date.now()}@example.com`) {
  await page.goto('/login')
  await page.click('role=tab[name="Create account"]')
  await page.fill('#acc-name', 'Mona Adel')
  await page.fill('#acc-email', email)
  await page.fill('#acc-pass', 'secret-mood-1')
  await page.click('#acc-submit')
  await expect(page).toHaveURL(/\/account/)
  return email
}

test('wishlist works without an account and survives reloads', async ({ page }) => {
  await page.goto('/shop')
  await page.click('button[aria-label="Save Let It Be to wishlist"]')
  await expect(page.locator('a[aria-label="Wishlist, 1 saved"]')).toBeVisible()
  await page.reload()
  await page.goto('/wishlist')
  await expect(page.locator('.card__name')).toHaveText(['Let It Be'])
  await page.click('button[aria-label="Remove Let It Be from wishlist"]')
  await expect(page.locator('text=Nothing saved yet.')).toBeVisible()
})

test('sign up, checkout is prefilled, order shows in account, address saved', async ({ page }) => {
  const email = await signup(page)
  await addToCart(page, 'maybe-tonight')
  await page.click('#go-checkout')
  await expect(page.locator('#name')).toHaveValue('Mona Adel')
  await expect(page.locator('#email')).toHaveValue(email)
  await fillCheckout(page, { name: 'Mona Adel' })
  await page.click('#place-order')
  await expect(page).toHaveURL(/\/order\//)
  const number = page.url().split('/').pop()

  await page.goto('/account')
  await expect(page.locator('.myorders')).toContainText(number)
  await expect(page.locator('.addr')).toContainText('12 Nile Street')

  // next checkout uses the saved address
  await addToCart(page, 'let-it-be', 'S')
  await page.click('#go-checkout')
  await expect(page.locator('#street')).toHaveValue('12 Nile Street, Bldg 3')
  await expect(page.locator('#governorate')).toHaveValue('Cairo')

  await page.goto('/account')
  await page.click('#acc-logout')
  await page.goto('/account')
  await expect(page).toHaveURL(/\/login/)
})

test('wrong password and duplicate email are explained', async ({ page }) => {
  const email = await signup(page)
  await page.click('#acc-logout')
  await page.goto('/login')
  await page.fill('#acc-email', email)
  await page.fill('#acc-pass', 'nope-nope')
  await page.click('#acc-submit')
  await expect(page.locator('.field-error')).toContainText('Wrong email or password')
  await page.click('role=tab[name="Create account"]')
  await page.fill('#acc-name', 'Again')
  await page.fill('#acc-email', email)
  await page.fill('#acc-pass', 'secret-mood-1')
  await page.click('#acc-submit')
  await expect(page.locator('.field-error')).toContainText('already has an account')
})

test('delivered order → review → admin approves → shows on product page', async ({ page }) => {
  await signup(page)
  await addToCart(page, 'maybe-tonight')
  await page.click('#go-checkout')
  await fillCheckout(page)
  await page.click('#place-order')
  await expect(page).toHaveURL(/\/order\//)
  const number = page.url().split('/').pop()
  await page.goto('/account')
  await page.click('#acc-logout')

  await adminLogin(page)
  await page.goto('/admin/orders')
  for (const s of ['confirmed', 'shipped', 'delivered']) {
    await page.locator('tr', { hasText: number }).click()
    await page.selectOption('#order-status', s)
    await page.click('#update-order')
    await expect(page.locator('.a-modal')).toBeHidden()
  }
  await page.click('#a-logout')

  await page.goto('/login')
  // sign back in as the customer: reuse the account list from the sign-up
  await page.goto('/')
  await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('mood:v1:accounts') || '[]').at(-1)
    if (a) localStorage.setItem('mood:demo-session', a.uid)
  })
  test.skip(isFirebaseRun, 'Firebase run covers reviews in the functions tests')
  await page.goto('/account')
  await page.locator('.myorders li', { hasText: number }).locator('a', { hasText: 'Review' }).click()
  await page.click('label:has(input[value="5"])')
  await page.fill('textarea', 'Exactly how I feel.')
  await page.click('button:has-text("Send review")')
  await expect(page.locator("text=Thank you. It'll show")).toBeVisible()

  await page.goto('/product/maybe-tonight')
  await expect(page.locator('#reviews')).toHaveCount(0)

  await page.evaluate(() => localStorage.removeItem('mood:demo-session'))
  await adminLogin(page)
  await page.goto('/admin/reviews')
  await expect(page.locator('.a-review')).toContainText('Exactly how I feel.')
  await page.locator('.a-review').locator('input').fill('Thank you, Mona.')
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.locator('.toast--ok')).toContainText('published')

  await page.goto('/product/maybe-tonight')
  await expect(page.locator('#reviews')).toContainText('Exactly how I feel.')
  await expect(page.locator('#reviews')).toContainText('Thank you, Mona.')
  await expect(page.locator('.pdp__rating')).toContainText('1 review')
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent())
  expect(ld.aggregateRating).toMatchObject({ ratingValue: 5, reviewCount: 1 })
})

test('notify me for a sold-out size and for an upcoming drop', async ({ page }) => {
  await page.goto('/product/let-it-be')
  await page.click('text=Sold out in your size?')
  await page.fill('input[aria-label="Email for restock alert"]', 'wait@example.com')
  await page.click('button:has-text("Notify me")')
  await expect(page.locator("text=We'll email you when it's back.")).toBeVisible()

  await page.goto('/moods/love')
  await expect(page.locator('.countdown')).toBeVisible()
  await page.fill('input[aria-label="Email for drop alert"]', 'wait@example.com')
  await page.click('button:has-text("Tell me when it drops")')
  await expect(page.locator("text=You'll be the first to know.")).toBeVisible()
})

test('product page has SEO tags and analytics events fire', async ({ page }) => {
  await page.goto('/product/maybe-tonight')
  await expect(page).toHaveTitle('Maybe Tonight — THE MOOD')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/product\/maybe-tonight$/)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\//)
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent())
  expect(ld).toMatchObject({ '@type': 'Product', name: 'Maybe Tonight', offers: { priceCurrency: 'EGP', price: 1450 } })
  await page.locator('.sizes button', { hasText: /^M$/ }).click()
  await page.click('#add-to-cart')
  const events = await page.evaluate(() => window.__moodEvents.map((e) => e.event))
  expect(events).toEqual(expect.arrayContaining(['view_item', 'add_to_cart']))
})
