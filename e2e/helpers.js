import { expect } from '@playwright/test'
import { isFirebaseRun, resetDb } from './firebase-setup.js'

/** Fresh demo store, intro already seen. */
export async function fresh(page, { intro = false } = {}) {
  if (isFirebaseRun) await resetDb()
  await page.addInitScript((showIntro) => {
    if (!sessionStorage.getItem('__init')) {
      localStorage.clear()
      sessionStorage.setItem('__init', '1')
    }
    if (!showIntro) {
      sessionStorage.setItem('mood:intro', '1')
      localStorage.setItem('mood:intro', '2')
    }
  }, intro)
}

export async function addToCart(page, slug, size = 'M') {
  await page.goto(`/product/${slug}`)
  await page.locator('.sizes button', { hasText: new RegExp(`^${size}$`) }).click()
  await page.locator('#add-to-cart').click()
  await expect(page.locator('.drawer')).toBeVisible()
}

export async function adminLogin(page) {
  await page.goto('/admin/login')
  await page.fill('#a-email', 'admin@themood.co')
  await page.fill('#a-pass', 'mood2026')
  await page.click('#a-login-btn')
  await expect(page).toHaveURL(/\/admin$/)
}

export async function fillCheckout(page, over = {}) {
  const d = { name: 'Mona Adel', phone: '01012345678', email: '', governorate: 'Cairo', city: 'Zamalek', street: '12 Nile Street, Bldg 3', ...over }
  await page.fill('#name', d.name)
  await page.fill('#phone', d.phone)
  if (d.email) await page.fill('#email', d.email)
  await page.selectOption('#governorate', d.governorate)
  await page.fill('#city', d.city)
  await page.fill('#street', d.street)
}
