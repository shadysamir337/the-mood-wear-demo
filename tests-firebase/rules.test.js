import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, deleteDoc } from 'firebase/firestore'

let env
const PROJECT = 'demo-the-mood-rules'

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
afterAll(() => env?.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'products/live'), { name: 'Live', status: 'active', price: 1000, variants: [] })
    await setDoc(doc(db, 'products/draft'), { name: 'Draft', status: 'draft', price: 1000, variants: [] })
    await setDoc(doc(db, 'orders/o1'), { number: 'MOOD-1001', userId: 'alice', customer: { phone: '010' } })
    await setDoc(doc(db, 'orders/o2'), { number: 'MOOD-1002', userId: 'bob', customer: { phone: '011' } })
    await setDoc(doc(db, 'promos/MOOD10'), { code: 'MOOD10', usedCount: 3 })
    await setDoc(doc(db, 'settings/store'), { tagline: 'x' })
    await setDoc(doc(db, 'reviews/r1'), { productId: 'live', status: 'approved', rating: 5 })
    await setDoc(doc(db, 'reviews/r2'), { productId: 'live', status: 'pending', rating: 1 })
  })
})

const anon = () => env.unauthenticatedContext().firestore()
const user = (uid, email = `${uid}@x.co`) => env.authenticatedContext(uid, { email }).firestore()
const staff = (role) => env.authenticatedContext(`${role}-1`, { email: `${role}@themood.co`, role }).firestore()

describe('catalog', () => {
  it('public can read active products only', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'products/live')))
    await assertFails(getDoc(doc(anon(), 'products/draft')))
    await assertSucceeds(getDocs(query(collection(anon(), 'products'), where('status', '==', 'active'))))
    await assertFails(getDocs(collection(anon(), 'products')))
  })
  it('customers cannot edit prices; admins can (stamped)', async () => {
    await assertFails(updateDoc(doc(user('alice'), 'products/live'), { price: 1 }))
    await assertFails(updateDoc(doc(staff('admin'), 'products/live'), { price: 900 }))
    await assertSucceeds(updateDoc(doc(staff('admin'), 'products/live'), { price: 900, updatedBy: 'admin@themood.co' }))
  })
  it('staff may change stock but not price', async () => {
    await assertSucceeds(updateDoc(doc(staff('staff'), 'products/live'), { variants: [{ size: 'M', stock: 3 }], updatedBy: 'staff@themood.co' }))
    await assertFails(updateDoc(doc(staff('staff'), 'products/live'), { price: 1, updatedBy: 'staff@themood.co' }))
  })
  it('settings: public read, admin write, staff no write', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'settings/store')))
    await assertFails(setDoc(doc(staff('staff'), 'settings/store'), { tagline: 'y' }))
    await assertSucceeds(setDoc(doc(staff('admin'), 'settings/store'), { tagline: 'y' }))
  })
})

describe('orders and promos', () => {
  it('anonymous users cannot read orders or promos', async () => {
    await assertFails(getDoc(doc(anon(), 'orders/o1')))
    await assertFails(getDocs(collection(anon(), 'orders')))
    await assertFails(getDoc(doc(anon(), 'promos/MOOD10')))
  })
  it('customers read only their own orders', async () => {
    await assertSucceeds(getDoc(doc(user('alice'), 'orders/o1')))
    await assertFails(getDoc(doc(user('alice'), 'orders/o2')))
    await assertSucceeds(getDocs(query(collection(user('alice'), 'orders'), where('userId', '==', 'alice'))))
  })
  it('nobody writes orders from the client, not even admins', async () => {
    await assertFails(setDoc(doc(user('alice'), 'orders/new'), { total: 1 }))
    await assertFails(updateDoc(doc(staff('owner'), 'orders/o1'), { status: 'delivered' }))
  })
  it('admins cannot fake promo usage', async () => {
    await assertFails(updateDoc(doc(staff('admin'), 'promos/MOOD10'), { usedCount: 0 }))
    await assertSucceeds(updateDoc(doc(staff('admin'), 'promos/MOOD10'), { active: false }))
    await assertFails(getDoc(doc(user('alice'), 'promos/MOOD10')))
  })
})

describe('reviews, users, wishlists', () => {
  it('public sees approved reviews only; staff moderate', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'reviews/r1')))
    await assertFails(getDoc(doc(anon(), 'reviews/r2')))
    await assertFails(setDoc(doc(user('alice'), 'reviews/r3'), { productId: 'live', status: 'approved', rating: 5 }))
    await assertSucceeds(updateDoc(doc(staff('staff'), 'reviews/r2'), { status: 'approved' }))
    await assertFails(updateDoc(doc(staff('staff'), 'reviews/r2'), { rating: 5 }))
  })
  it('users own their profile and wishlist', async () => {
    await assertSucceeds(setDoc(doc(user('alice'), 'users/alice'), { name: 'Alice' }))
    await assertFails(setDoc(doc(user('alice'), 'users/bob'), { name: 'Bob' }))
    await assertFails(setDoc(doc(user('alice'), 'users/alice'), { name: 'Alice', role: 'owner' }))
    await assertSucceeds(setDoc(doc(user('alice'), 'wishlists/alice'), { productIds: ['live'], updatedAt: 1 }))
    await assertFails(getDoc(doc(user('bob'), 'wishlists/alice')))
    await assertSucceeds(deleteDoc(doc(user('alice'), 'wishlists/alice')))
  })
  it('counters and rate limits are server-only', async () => {
    await assertFails(getDoc(doc(staff('owner'), 'counters/orders')))
    await assertFails(setDoc(doc(staff('owner'), 'rateLimits/x'), { count: 0 }))
  })
})
