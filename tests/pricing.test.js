import { describe, expect, it } from 'vitest'
import {
  buildOrder, computeTotals, evaluatePromo, isScheduleActive, priceProduct, shippingFee,
  sizeAvailability, totalStock, variantStock, canTransition, stockDelta,
} from '../src/lib/pricing'
import { seedProducts, seedSettings } from '../src/lib/seed'

const DAY = 86_400_000
const product = (over = {}) => ({
  id: 'p1', moodId: 'calm', price: 1000, compareAtPrice: 0, status: 'active', name: 'P',
  variants: [
    { color: 'Black', size: 'S', stock: 2 },
    { color: 'Black', size: 'M', stock: 0 },
    { color: 'Cream', size: 'S', stock: 0 },
    { color: 'Cream', size: 'M', stock: 5 },
  ],
  ...over,
})
const line = (p, qty = 1, unitPrice = p.price) => ({ product: p, qty, unitPrice })

describe('isScheduleActive', () => {
  it('respects active flag and start/end window', () => {
    const now = Date.now()
    expect(isScheduleActive({ active: false })).toBe(false)
    expect(isScheduleActive({})).toBe(true)
    expect(isScheduleActive({ startsAt: now + DAY })).toBe(false)
    expect(isScheduleActive({ endsAt: now - DAY })).toBe(false)
    expect(isScheduleActive({ startsAt: now - DAY, endsAt: now + DAY })).toBe(true)
  })
})

describe('priceProduct', () => {
  it('returns base price with no sale', () => {
    expect(priceProduct(product())).toMatchObject({ price: 1000, compareAt: null, onSale: false, percent: 0 })
  })
  it('uses compare-at price when higher', () => {
    expect(priceProduct(product({ compareAtPrice: 1250 }))).toMatchObject({ price: 1000, compareAt: 1250, onSale: true, percent: 20 })
  })
  it('picks the best active sale in scope', () => {
    const sales = [
      { type: 'percent', value: 10, scope: { type: 'all' } },
      { type: 'fixed', value: 300, scope: { type: 'moods', moodIds: ['calm'] } },
      { type: 'percent', value: 90, scope: { type: 'moods', moodIds: ['sad'] } },
      { type: 'percent', value: 80, scope: { type: 'all' }, active: false },
    ]
    expect(priceProduct(product(), sales)).toMatchObject({ price: 700, compareAt: 1000, percent: 30 })
  })
  it('never goes below zero', () => {
    expect(priceProduct(product(), [{ type: 'fixed', value: 5000 }]).price).toBe(0)
  })
})

describe('stock helpers', () => {
  it('reads variant and total stock', () => {
    const p = product()
    expect(variantStock(p, 'Cream', 'M')).toBe(5)
    expect(variantStock(p, 'Nope', 'M')).toBe(0)
    expect(totalStock(p)).toBe(7)
  })
  it('sizeAvailability sorts sizes', () => {
    const p = product({ variants: [{ color: 'A', size: 'XL', stock: 1 }, { color: 'A', size: 'S', stock: 1 }] })
    expect(sizeAvailability(p).map((s) => s.size)).toEqual(['S', 'XL'])
  })
  it('sizeAvailability is per colour when a colour is given (bug 8)', () => {
    const p = product()
    expect(sizeAvailability(p, 'Black')).toEqual([{ size: 'S', inStock: true }, { size: 'M', inStock: false }])
    expect(sizeAvailability(p, 'Cream')).toEqual([{ size: 'S', inStock: false }, { size: 'M', inStock: true }])
  })
})

describe('evaluatePromo', () => {
  const p = product()
  it('rejects missing, inactive, expired, used-up codes', () => {
    expect(evaluatePromo(null, [line(p)]).ok).toBe(false)
    expect(evaluatePromo({ type: 'percent', value: 10, active: false }, [line(p)]).ok).toBe(false)
    expect(evaluatePromo({ type: 'percent', value: 10, endsAt: Date.now() - DAY }, [line(p)]).error).toMatch(/expired/)
    expect(evaluatePromo({ type: 'percent', value: 10, usageLimit: 2, usedCount: 2 }, [line(p)]).error).toMatch(/used up/)
    expect(evaluatePromo({ type: 'percent', value: 10, perCustomerLimit: 1 }, [line(p)], { usedByCustomer: 1 }).ok).toBe(false)
    expect(evaluatePromo({ type: 'percent', value: 10, firstOrderOnly: true }, [line(p)], { isFirstOrder: false }).ok).toBe(false)
  })
  it('enforces minimum order', () => {
    expect(evaluatePromo({ type: 'percent', value: 10, minOrder: 1500 }, [line(p)]).ok).toBe(false)
    expect(evaluatePromo({ type: 'percent', value: 10, minOrder: 1500 }, [line(p, 2)]).ok).toBe(true)
  })
  it('percent, fixed, shipping', () => {
    expect(evaluatePromo({ type: 'percent', value: 15 }, [line(p, 2)]).discount).toBe(300)
    expect(evaluatePromo({ type: 'fixed', value: 5000 }, [line(p)]).discount).toBe(1000)
    expect(evaluatePromo({ type: 'shipping' }, [line(p)])).toMatchObject({ ok: true, discount: 0, freeShipping: true })
  })
  it('caps by maxDiscount', () => {
    expect(evaluatePromo({ type: 'percent', value: 50, maxDiscount: 200 }, [line(p)]).discount).toBe(200)
  })
  it('only discounts in-scope lines', () => {
    const other = product({ id: 'p2', moodId: 'sad' })
    const r = evaluatePromo({ type: 'percent', value: 10, scope: { type: 'moods', moodIds: ['sad'] } }, [line(p), line(other)])
    expect(r.discount).toBe(100)
    expect(evaluatePromo({ type: 'percent', value: 10, scope: { type: 'products', productIds: ['zzz'] } }, [line(p)]).ok).toBe(false)
  })
  it('BOGO gives the cheapest item in each group free', () => {
    const cheap = product({ id: 'c', price: 400 })
    const r = evaluatePromo({ type: 'bogo', buyQty: 1, getQty: 1 }, [line(p, 1), line(cheap, 1, 400)])
    expect(r.discount).toBe(400)
    expect(evaluatePromo({ type: 'bogo', buyQty: 2, getQty: 1 }, [line(p, 2)]).ok).toBe(false)
  })
})

describe('shipping and totals', () => {
  it('uses zone, default and free threshold', () => {
    expect(shippingFee(seedSettings, 'Cairo', 1000)).toBe(55)
    expect(shippingFee(seedSettings, 'Aswan', 1000)).toBe(85)
    expect(shippingFee(seedSettings, 'Aswan', 2500)).toBe(0)
    expect(shippingFee(seedSettings, 'Aswan', 1000, true)).toBe(0)
  })
  it('computes totals with discount', () => {
    const p = product()
    const t = computeTotals({ lines: [line(p, 1)], promoResult: { ok: true, discount: 100 }, settings: seedSettings, governorate: 'Cairo' })
    expect(t).toMatchObject({ subtotal: 1000, discount: 100, shipping: 55, total: 955 })
  })
  it('does not charge shipping before a governorate is chosen (bug 10)', () => {
    const t = computeTotals({ lines: [line(product())], promoResult: null, settings: seedSettings, governorate: '' })
    expect(t.shipping).toBe(0)
    expect(t.shippingPending).toBe(true)
    expect(t.total).toBe(1000)
  })
})

describe('buildOrder', () => {
  const base = {
    customer: { name: 'Mona', phone: '01012345678' },
    address: { governorate: 'Cairo', city: 'Zamalek', street: '1 Nile St' },
    items: [{ productId: 'maybe-tonight', color: 'Black', size: 'M', qty: 1 }],
  }
  const ctx = { products: seedProducts, sales: [], promos: [], settings: seedSettings, orderNumber: 'MOOD-1001' }

  it('builds an order with server prices', () => {
    const { order, stockChanges } = buildOrder({ payload: base, ...ctx })
    expect(order).toMatchObject({ number: 'MOOD-1001', subtotal: 1450, shipping: 55, total: 1505, status: 'pending' })
    expect(stockChanges).toEqual([{ productId: 'maybe-tonight', color: 'Black', size: 'M', qty: 1 }])
  })
  it('validates input', () => {
    expect(() => buildOrder({ payload: { ...base, customer: { name: 'x' } }, ...ctx })).toThrow(/required/)
    expect(() => buildOrder({ payload: { ...base, customer: { name: 'x', phone: 'abc' } }, ...ctx })).toThrow(/phone/)
    expect(() => buildOrder({ payload: { ...base, items: [] }, ...ctx })).toThrow(/empty/)
    expect(() => buildOrder({ payload: { ...base, items: [{ productId: 'nope', color: 'Black', size: 'M', qty: 1 }] }, ...ctx })).toThrow(/no longer/)
    expect(() => buildOrder({ payload: { ...base, items: [{ productId: 'let-it-be', color: 'Cream', size: 'XL', qty: 1 }] }, ...ctx })).toThrow(/stock/)
  })
  it('rejects a bad promo and applies a good one', () => {
    expect(() => buildOrder({ payload: { ...base, promoCode: 'NOPE' }, ...ctx })).toThrow(/exist/)
    const promos = [{ id: 'MOOD10', code: 'MOOD10', type: 'percent', value: 10, active: true }]
    const { order, promoId } = buildOrder({ payload: { ...base, promoCode: 'mood10' }, ...ctx, promos })
    expect(order.discount).toBe(145)
    expect(order.promoCode).toBe('MOOD10')
    expect(promoId).toBe('MOOD10')
  })
})

describe('order status transitions (bug 11)', () => {
  it('blocks going backwards from final states', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true)
    expect(canTransition('delivered', 'pending')).toBe(false)
    expect(canTransition('refunded', 'shipped')).toBe(false)
    expect(canTransition('cancelled', 'pending')).toBe(true)
  })
  it('returns stock when leaving the reserved set and takes it again when coming back', () => {
    expect(stockDelta('pending', 'cancelled')).toBe(1)
    expect(stockDelta('delivered', 'returned')).toBe(1)
    expect(stockDelta('cancelled', 'pending')).toBe(-1)
    expect(stockDelta('returned', 'refunded')).toBe(0)
    expect(stockDelta('pending', 'shipped')).toBe(0)
  })
})

import { toDateInput, fromDateInput, escapeHtml, csvCell } from '../src/lib/format'

describe('format helpers', () => {
  it('date input round-trips in local time (bug 7)', () => {
    expect(toDateInput(fromDateInput('2026-12-10'))).toBe('2026-12-10')
    expect(toDateInput(fromDateInput('2026-12-10', true))).toBe('2026-12-10')
  })
  it('escapes html and csv formulas', () => {
    expect(escapeHtml('<img onerror="x">')).toBe('&lt;img onerror=&quot;x&quot;&gt;')
    expect(csvCell('=SUM(A1)')).toBe(`"'=SUM(A1)"`)
    expect(csvCell('a "b"')).toBe('"a ""b"""')
  })
})
