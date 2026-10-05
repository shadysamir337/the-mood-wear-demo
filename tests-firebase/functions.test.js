// Integration tests: real Cloud Functions + Firestore + Auth emulators.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { seedProducts, seedMoods, seedSettings, seedPromos } from '../shared/seed.js'

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-the-mood'
const FN = `http://127.0.0.1:5001/${PROJECT}/us-central1`
const AUTH = 'http://127.0.0.1:9099'

if (!getApps().length) initializeApp({ projectId: PROJECT })
const db = getFirestore()

async function call(name, data, token) {
  const res = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  })
  const body = await res.json()
  if (body.error) { const e = new Error(body.error.message); e.status = body.error.status; throw e }
  return body.result
}

async function tokenFor(email, role) {
  const auth = getAuth()
  let u
  try { u = await auth.getUserByEmail(email) } catch { u = await auth.createUser({ email, password: 'secret123' }) }
  await auth.setCustomUserClaims(u.uid, role ? { role } : {})
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret123', returnSecureToken: true }),
  })
  return (await r.json()).idToken
}

async function reset() {
  for (const col of ['products', 'moods', 'orders', 'promos', 'counters', 'customers', 'reviews', 'sales', 'settings', 'rateLimits']) {
    const snap = await db.collection(col).get()
    await Promise.all(snap.docs.map((d) => d.ref.delete()))
  }
  const batch = db.batch()
  seedProducts.forEach(({ id, ...p }) => batch.set(db.doc(`products/${id}`), p))
  seedMoods.forEach(({ id, ...m }) => batch.set(db.doc(`moods/${id}`), m))
  seedPromos.forEach(({ id, ...p }) => batch.set(db.doc(`promos/${id}`), p))
  batch.set(db.doc('settings/store'), seedSettings)
  await batch.commit()
}

const order = (over = {}) => ({
  customer: { name: 'Mona Adel', phone: '01012345678', email: 'mona@example.com' },
  address: { governorate: 'Cairo', city: 'Zamalek', street: '12 Nile Street' },
  items: [{ productId: 'maybe-tonight', color: 'Black', size: 'M', qty: 1 }],
  ...over,
})
const stock = async (id, size, color = 'Black') => (await db.doc(`products/${id}`).get()).data().variants.find((v) => v.size === size && v.color === color).stock

let admin, staffTok
beforeAll(async () => {
  admin = await tokenFor('owner@themood.co', 'owner')
  staffTok = await tokenFor('staff@themood.co', 'staff')
})
beforeEach(reset)

describe('createOrder', () => {
  it('prices on the server, reserves stock, numbers sequentially, records the customer', async () => {
    const before = await stock('maybe-tonight', 'M')
    const a = await call('createOrder', order({ items: [{ productId: 'maybe-tonight', color: 'Black', size: 'M', qty: 1, unitPrice: 1 }] }))
    expect(a).toMatchObject({ number: 'MOOD-1001', total: 1505 })
    const b = await call('createOrder', order({ customer: { name: 'Sara', phone: '01099999999' } }))
    expect(b.number).toBe('MOOD-1002')
    expect(await stock('maybe-tonight', 'M')).toBe(before - 2)
    const c = (await db.doc('customers/01012345678').get()).data()
    expect(c).toMatchObject({ orders: 1, spent: 1505 })
  })

  it('rejects bad input and unknown promo codes', async () => {
    await expect(call('createOrder', order({ customer: { name: 'x', phone: 'abc' } }))).rejects.toThrow(/phone/)
    await expect(call('createOrder', order({ promoCode: 'NOPE' }))).rejects.toThrow(/exist/)
    await expect(call('createOrder', order({ items: [{ productId: 'let-it-be', color: 'Cream', size: 'XL', qty: 1 }] }))).rejects.toThrow(/stock/)
  })

  it('applies promos and counts usage', async () => {
    const r = await call('createOrder', order({ promoCode: 'mood10' }))
    expect(r.total).toBe(1450 - 145 + 55)
    expect((await db.doc('promos/MOOD10').get()).data().usedCount).toBe(1)
  })

  it('never oversells under concurrency: 5 buyers, 2 left', async () => {
    const snap = await db.doc('products/maybe-tonight').get()
    await snap.ref.update({ variants: snap.data().variants.map((v) => (v.size === 'XL' ? { ...v, stock: 2 } : v)) })
    const buyers = Array.from({ length: 5 }, (_, i) => call('createOrder', order({
      customer: { name: `Buyer ${i}`, phone: `0101111000${i}` },
      items: [{ productId: 'maybe-tonight', color: 'Black', size: 'XL', qty: 1 }],
    })))
    const results = await Promise.allSettled(buyers)
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.number)
    expect(ok).toHaveLength(2)
    expect(new Set(ok).size).toBe(2)
    expect(await stock('maybe-tonight', 'XL')).toBe(0)
  })
})

describe('validatePromo and trackOrder', () => {
  it('validates promos server-side', async () => {
    const items = [{ productId: 'maybe-tonight', color: 'Black', size: 'M', qty: 1 }]
    expect(await call('validatePromo', { code: 'MOOD10', items, phone: '' })).toMatchObject({ ok: true, discount: 145 })
    expect((await call('validatePromo', { code: 'TWOFORMOOD', items })).ok).toBe(false)
  })
  it('tracks with number + phone and leaks nothing else', async () => {
    const { number } = await call('createOrder', order())
    const t = await call('trackOrder', { number, phone: '+20 101 234 5678' })
    expect(t.status).toBe('pending')
    expect(t.customer).toBeUndefined()
    expect(t.address).toBeUndefined()
    await expect(call('trackOrder', { number, phone: '01000000000' })).rejects.toThrow(/couldn't find/)
  })
})

describe('updateOrderStatus', () => {
  it('requires staff', async () => {
    const { orderId } = await call('createOrder', order())
    await expect(call('updateOrderStatus', { id: orderId, status: 'confirmed' })).rejects.toThrow(/access/)
    const customer = await tokenFor('someone@x.co', null)
    await expect(call('updateOrderStatus', { id: orderId, status: 'confirmed' }, customer)).rejects.toThrow(/access/)
    expect((await call('updateOrderStatus', { id: orderId, status: 'confirmed' }, staffTok)).status).toBe('confirmed')
  })
  it('returns stock on cancel, re-reserves on reopen, blocks invalid moves', async () => {
    const before = await stock('maybe-tonight', 'M')
    const { orderId } = await call('createOrder', order())
    await call('updateOrderStatus', { id: orderId, status: 'cancelled' }, admin)
    expect(await stock('maybe-tonight', 'M')).toBe(before)
    await call('updateOrderStatus', { id: orderId, status: 'pending' }, admin)
    expect(await stock('maybe-tonight', 'M')).toBe(before - 1)
    await expect(call('updateOrderStatus', { id: orderId, status: 'delivered' }, admin)).rejects.toThrow(/can't go/)
  })
})

describe('reviews', () => {
  it('only delivered orders can be reviewed, via the review token; approval updates the rating', async () => {
    const { orderId } = await call('createOrder', order())
    for (const s of ['confirmed', 'shipped', 'delivered']) await call('updateOrderStatus', { id: orderId, status: s }, admin)
    let token
    for (let i = 0; i < 20 && !token; i++) {
      token = (await db.doc(`orders/${orderId}`).get()).data().reviewToken
      if (!token) await new Promise((r) => setTimeout(r, 300))
    }
    expect(token).toBeTruthy()
    const items = await call('reviewableItems', { token })
    expect(items.items[0]).toMatchObject({ productId: 'maybe-tonight', reviewed: false })
    await call('submitReview', { token, productId: 'maybe-tonight', rating: 4, text: 'Feels right.' })
    await expect(call('submitReview', { token, productId: 'maybe-tonight', rating: 5 })).rejects.toThrow(/already/)
    await expect(call('submitReview', { token: 'nope', productId: 'maybe-tonight', rating: 5 })).rejects.toThrow(/delivered/)
    const id = `${orderId}_maybe-tonight`
    expect((await db.doc(`reviews/${id}`).get()).data()).toMatchObject({ status: 'pending', name: 'Mona A.' })
    await db.doc(`reviews/${id}`).update({ status: 'approved' })
    let rating
    for (let i = 0; i < 20 && !rating?.count; i++) {
      rating = (await db.doc('products/maybe-tonight').get()).data().rating
      if (!rating?.count) await new Promise((r) => setTimeout(r, 300))
    }
    expect(rating).toEqual({ avg: 4, count: 1 })
  })
})

describe('team roles', () => {
  it('only owners can grant roles', async () => {
    await tokenFor('new@themood.co', null)
    await expect(call('setStaffRole', { email: 'new@themood.co', role: 'staff' }, staffTok)).rejects.toThrow(/access/)
    expect(await call('setStaffRole', { email: 'new@themood.co', role: 'staff' }, admin)).toEqual({ ok: true })
    expect((await getAuth().getUserByEmail('new@themood.co')).customClaims).toEqual({ role: 'staff' })
  })
})
