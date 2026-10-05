// Runs only in Firebase mode (npm run e2e:firebase): checks UI actions against the real database.
import { test, expect } from '@playwright/test'
import { getFirestore } from 'firebase-admin/firestore'
import { fresh, adminLogin, addToCart, fillCheckout } from './helpers'
import { isFirebaseRun, ensureUser } from './firebase-setup.js'

test.skip(!isFirebaseRun, 'Firebase mode only')

const stock = async (id, size) => (await getFirestore().doc(`products/${id}`).get()).data().variants.find((v) => v.size === size).stock

test('@firebase order → admin cancel → stock returns; customer cannot see admin data', async ({ page }) => {
  await fresh(page)
  const before = await stock('maybe-tonight', 'M')
  await addToCart(page, 'maybe-tonight')
  await page.click('#go-checkout')
  await fillCheckout(page)
  await page.click('#place-order')
  await expect(page).toHaveURL(/\/order\/MOOD-1001/)
  expect(await stock('maybe-tonight', 'M')).toBe(before - 1)

  await adminLogin(page)
  await page.goto('/admin/orders')
  await page.locator('tr', { hasText: 'MOOD-1001' }).click()
  await expect(page.locator('#order-status option[value="delivered"]')).toBeDisabled()
  await page.selectOption('#order-status', 'cancelled')
  await page.click('#update-order')
  await expect(page.locator('.toast--ok')).toBeVisible()
  expect(await stock('maybe-tonight', 'M')).toBe(before)
})

test('@firebase duplicate promo code is refused', async ({ page }) => {
  await fresh(page)
  await adminLogin(page)
  await page.goto('/admin/promos')
  await page.click('#new-promo')
  await page.fill('#promo-code', 'MOOD10')
  await page.fill('#promo-value', '50')
  await page.click('#save-promo')
  await expect(page.locator('.toast--err')).toContainText('already exists')
  expect((await getFirestore().doc('promos/MOOD10').get()).data().value).toBe(10)
})

test('@firebase a non-staff account cannot open the admin', async ({ page }) => {
  await fresh(page)
  await ensureUser('shopper@x.co', 'secret123')
  await page.goto('/admin/login')
  await page.fill('#a-email', 'shopper@x.co')
  await page.fill('#a-pass', 'secret123')
  await page.click('#a-login-btn')
  await expect(page.locator('.field-error')).toContainText("doesn't have admin access")
})
