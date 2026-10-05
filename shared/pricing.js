/**
 * Shared pricing + order engine for THE MOOD.
 * Pure functions only. Used by the storefront (to preview totals), by the demo
 * database adapter, and by Cloud Functions (copied into functions/shared on build).
 */

export const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Port Said', 'Suez', 'Dakahlia', 'Sharqia',
  'Gharbia', 'Monufia', 'Beheira', 'Kafr El Sheikh', 'Damietta', 'Ismailia', 'Faiyum',
  'Beni Suef', 'Minya', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'Matrouh',
  'North Sinai', 'South Sinai', 'New Valley',
]

export const ORDER_STATUSES = [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded',
]

/** Which status can follow which. Refunds come after a cancel or a return. */
export const ORDER_FLOW = {
  pending: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['pending', 'processing', 'shipped', 'cancelled'],
  processing: ['confirmed', 'shipped', 'cancelled'],
  shipped: ['delivered', 'returned', 'cancelled'],
  delivered: ['returned'],
  cancelled: ['pending', 'refunded'],
  returned: ['refunded'],
  refunded: [],
}

/** Statuses that hold stock. Moving out of this set returns stock, moving back in takes it again. */
const RESERVED = new Set(['pending', 'confirmed', 'processing', 'shipped', 'delivered'])

export const canTransition = (from, to) => from === to || (ORDER_FLOW[from] || []).includes(to)

/** +1: give the items back to stock, -1: take them out again, 0: no change. */
export const stockDelta = (from, to) => {
  if (RESERVED.has(from) && !RESERVED.has(to)) return 1
  if (!RESERVED.has(from) && RESERVED.has(to)) return -1
  return 0
}

/** Digits only, Egyptian numbers normalised to 01xxxxxxxxx so +20 and 0 forms match. */
export const normalizePhone = (p) => {
  const d = String(p || '').replace(/\D/g, '')
  if (d.startsWith('20') && d.length === 12) return `0${d.slice(2)}`
  return d
}

const toMs = (v) => {
  if (!v) return null
  if (typeof v === 'number') return v
  if (typeof v?.toMillis === 'function') return v.toMillis()
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

/* ------------------------------ sales ------------------------------ */

export function isScheduleActive(item, t = Date.now()) {
  if (item.active === false) return false
  const a = toMs(item.startsAt)
  const b = toMs(item.endsAt)
  if (a && t < a) return false
  if (b && t > b) return false
  return true
}

function scopeMatches(scope, product) {
  const s = scope || { type: 'all' }
  if (s.type === 'all') return true
  if (s.type === 'moods') return (s.moodIds || []).includes(product.moodId)
  if (s.type === 'products') return (s.productIds || []).includes(product.id)
  return false
}

/** Returns the selling price of a product after any active sale. */
export function priceProduct(product, sales = []) {
  let best = Number(product.price) || 0
  let sale = null
  for (const s of sales) {
    if (!isScheduleActive(s) || !scopeMatches(s.scope, product)) continue
    const v = s.type === 'percent' ? product.price * (1 - s.value / 100) : product.price - s.value
    const rounded = Math.max(0, Math.round(v))
    if (rounded < best) {
      best = rounded
      sale = s
    }
  }
  let compareAt = null
  if (best < product.price) compareAt = product.price
  else if (product.compareAtPrice > product.price) compareAt = product.compareAtPrice
  const percent = compareAt ? Math.round((1 - best / compareAt) * 100) : 0
  return { price: best, compareAt, onSale: Boolean(compareAt), percent, sale }
}

/* ------------------------------ stock ------------------------------ */

export function variantStock(product, color, size) {
  const v = (product.variants || []).find((x) => x.color === color && x.size === size)
  return v ? Number(v.stock) || 0 : 0
}

export function totalStock(product) {
  return (product.variants || []).reduce((n, v) => n + (Number(v.stock) || 0), 0)
}

/** Sizes with availability, for one colour when given, otherwise across all colours. */
export function sizeAvailability(product, color) {
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const map = new Map()
  for (const v of product.variants || []) {
    if (color && v.color !== color) continue
    map.set(v.size, (map.get(v.size) || 0) + (Number(v.stock) || 0))
  }
  return [...map.entries()]
    .map(([size, stock]) => ({ size, inStock: stock > 0 }))
    .sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size))
}

/* ------------------------------ promos ----------------------------- */

/**
 * lines: [{ product, qty, unitPrice }]
 * Returns { ok, error?, discount, freeShipping }
 */
export function evaluatePromo(promo, lines, { usedByCustomer = 0, isFirstOrder = true } = {}) {
  const fail = (error) => ({ ok: false, error, discount: 0, freeShipping: false })
  if (!promo) return fail("That code doesn't exist.")
  if (!isScheduleActive(promo)) return fail('That code has expired.')
  if (promo.usageLimit && (promo.usedCount || 0) >= promo.usageLimit) return fail('That code has been used up.')
  if (promo.perCustomerLimit && usedByCustomer >= promo.perCustomerLimit) return fail("You've already used that code.")
  if (promo.firstOrderOnly && !isFirstOrder) return fail('That code is for first orders only.')

  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.qty, 0)
  if (promo.minOrder && subtotal < promo.minOrder) {
    return fail(`Spend ${promo.minOrder} EGP or more to use this code.`)
  }

  const eligible = lines.filter((l) => scopeMatches(promo.scope, l.product))
  if (!eligible.length) return fail("That code doesn't apply to what's in your cart.")
  const eligibleSubtotal = eligible.reduce((n, l) => n + l.unitPrice * l.qty, 0)

  let discount = 0
  let freeShipping = false

  if (promo.type === 'percent') {
    discount = Math.round((eligibleSubtotal * promo.value) / 100)
  } else if (promo.type === 'fixed') {
    discount = Math.min(promo.value, eligibleSubtotal)
  } else if (promo.type === 'shipping') {
    freeShipping = true
  } else if (promo.type === 'bogo') {
    const buy = Math.max(1, promo.buyQty || 1)
    const get = Math.max(1, promo.getQty || 1)
    const units = []
    eligible.forEach((l) => {
      for (let i = 0; i < l.qty; i++) units.push(l.unitPrice)
    })
    units.sort((a, b) => b - a)
    const group = buy + get
    const groups = Math.floor(units.length / group)
    if (!groups) return fail(`Add ${group} pieces to use this code.`)
    for (let g = 0; g < groups; g++) {
      const slice = units.slice(g * group, (g + 1) * group)
      discount += slice.slice(-get).reduce((n, p) => n + p, 0)
    }
  }
  if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount)
  discount = Math.min(discount, subtotal)
  return { ok: true, discount, freeShipping }
}

/* ----------------------------- shipping ---------------------------- */

export function shippingFee(settings, governorate, amountAfterDiscount, freeByPromo = false) {
  const s = settings?.shipping || {}
  if (freeByPromo) return 0
  if (s.freeThreshold && amountAfterDiscount >= s.freeThreshold) return 0
  const zone = (s.zones || []).find((z) => z.governorate === governorate)
  return zone ? Number(zone.fee) : Number(s.defaultFee) || 0
}

/** Shipping is only charged once a governorate is known (`shippingPending` until then). */
export function computeTotals({ lines, promoResult, settings, governorate }) {
  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.qty, 0)
  const discount = promoResult?.ok ? promoResult.discount : 0
  const shippingPending = !governorate
  const shipping = lines.length && !shippingPending
    ? shippingFee(settings, governorate, subtotal - discount, promoResult?.ok && promoResult.freeShipping)
    : 0
  return { subtotal, discount, shipping, shippingPending, total: Math.max(0, subtotal - discount + shipping) }
}

/* ------------------------------ orders ----------------------------- */

const clip = (v, n) => String(v || '').trim().slice(0, n)

/**
 * Authoritative order builder. Never trust prices from the client.
 * payload: { customer, address, items:[{productId,color,size,qty}], promoCode, paymentMethod, notes }
 * Returns { order, stockChanges: [{productId,color,size,qty}], promoId }
 */
export function buildOrder({ payload, products, sales, promos, settings, orderNumber, previousOrders = [] }) {
  const { customer = {}, address = {}, items = [] } = payload
  if (!customer.name || !customer.phone) throw new Error('Name and phone are required.')
  if (!/^[0-9+\s-]{8,16}$/.test(customer.phone)) throw new Error('That phone number looks off.')
  if (!address.governorate || !address.street) throw new Error('Delivery address is incomplete.')
  if (!GOVERNORATES.includes(address.governorate)) throw new Error('Choose a valid governorate.')
  if (!items.length) throw new Error('Your cart is empty.')

  if (settings?.payments?.cod === false) throw new Error("We can't take orders right now. Please message us.")
  if (items.length > 30) throw new Error('That cart is too big. Message us for bulk orders.')
  const lines = items.map((it) => {
    const product = products.find((p) => p.id === it.productId && p.status === 'active')
    if (!product) throw new Error('One of the items is no longer available.')
    const qty = Math.max(1, Math.min(10, parseInt(it.qty, 10) || 1))
    if (variantStock(product, it.color, it.size) < qty) {
      throw new Error(`${product.name} (${it.size}) doesn't have enough stock.`)
    }
    const { price } = priceProduct(product, sales)
    return { product, color: it.color, size: it.size, qty, unitPrice: price }
  })

  let promoResult = null
  let promo = null
  if (payload.promoCode) {
    promo = promos.find((p) => p.code.toUpperCase() === String(payload.promoCode).toUpperCase().trim())
    const phone = normalizePhone(customer.phone)
    const samePhone = (o) => normalizePhone(o.customer?.phone) === phone
    const mine = previousOrders.filter((o) => samePhone(o) && o.promoCode === promo?.code && o.status !== 'cancelled')
    promoResult = evaluatePromo(promo, lines, {
      usedByCustomer: mine.length,
      isFirstOrder: !previousOrders.some(samePhone),
    })
    if (!promoResult.ok) throw new Error(promoResult.error)
  }

  const { shippingPending: _pending, ...totals } = computeTotals({ lines, promoResult, settings, governorate: address.governorate })
  const now = Date.now()
  const order = {
    number: orderNumber,
    userId: payload.userId || null,
    customer: { name: clip(customer.name, 80), phone: customer.phone.trim(), phoneKey: normalizePhone(customer.phone), email: clip(customer.email, 120) },
    address: {
      governorate: address.governorate,
      city: clip(address.city, 80),
      street: clip(address.street, 200),
      notes: clip(address.notes, 300),
    },
    items: lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      mood: l.product.moodName || '',
      image: typeof l.product.images?.[0] === 'string' ? l.product.images[0] : l.product.images?.[0]?.src || '',
      color: l.color,
      size: l.size,
      qty: l.qty,
      unitPrice: l.unitPrice,
    })),
    ...totals,
    promoCode: promo && promoResult?.ok ? promo.code : null,
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
    status: 'pending',
    tracking: { courier: '', number: '' },
    notes: '',
    timeline: [{ status: 'pending', at: now, note: 'Order placed' }],
    createdAt: now,
    updatedAt: now,
  }
  return {
    order,
    stockChanges: lines.map((l) => ({ productId: l.product.id, color: l.color, size: l.size, qty: l.qty })),
    promoId: promo && promoResult?.ok ? promo.id : null,
  }
}

export const formatPrice = (n) =>
  `${Math.round(Number(n) || 0).toLocaleString('en-US')} EGP`
