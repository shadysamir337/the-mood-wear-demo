/**
 * DEMO MODE adapter: a seeded database in localStorage, so the whole store can be
 * clicked through and tested without Firebase. Same surface as api-remote.js.
 */
import { seedMoods, seedProducts, seedPromos, seedSales, seedSettings, seedBanners } from './seed'
import { buildOrder, canTransition, evaluatePromo, normalizePhone, priceProduct, stockDelta, ORDER_STATUSES } from './pricing'
import { slugify } from './slug'

/* ------------------------------- LOCAL ----------------------------------- */

const SEEDS = {
  products: seedProducts, moods: seedMoods, promos: seedPromos, sales: seedSales,
  banners: seedBanners, orders: [], subscribers: [], settings: [seedSettings], counters: [],
  reviews: [], customers: [], users: [], wishlists: [], restockAlerts: [], auditLog: [], staff: [],
}
const token = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
const KEY = (n) => `mood:v1:${n}`

function read(name) {
  try {
    const raw = localStorage.getItem(KEY(name))
    if (raw) return JSON.parse(raw)
  } catch { /* fall through to seed */ }
  const seeded = structuredClone(SEEDS[name] || [])
  write(name, seeded)
  return seeded
}
function write(name, arr) {
  try {
    localStorage.setItem(KEY(name), JSON.stringify(arr))
  } catch {
    throw new Error('Browser storage is full. Use smaller images, or connect Firebase for real storage.')
  }
}

/** Product slugs must be unique: add -2, -3… when taken. */
function uniqueSlug(rows, slug, id) {
  const base = slugify(slug) || 'item'
  let next = base
  for (let n = 2; rows.some((r) => r.slug === next && r.id !== id); n++) next = `${base}-${n}`
  return next
}
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120))

function resizeToDataUrl(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/webp', 0.78))
    }
    img.onerror = reject
    img.src = url
  })
}

function syncRating(productId) {
  const approved = read('reviews').filter((r) => r.productId === productId && r.status === 'approved').map((r) => r.rating)
  const products = read('products')
  const p = products.find((x) => x.id === productId)
  if (!p) return
  p.rating = { avg: approved.length ? Math.round((approved.reduce((a, b) => a + b, 0) / approved.length) * 10) / 10 : 0, count: approved.length }
  write('products', products)
}

function logAudit(action, target, details = {}) {
  const rows = read('auditLog')
  rows.unshift({ id: token(), actor: 'admin@themood.co', action, target, details, at: Date.now() })
  write('auditLog', rows.slice(0, 300))
}

export const local = {
  async catalog() {
    // demo stand-in for the publishScheduledDrops function
    const all = read('products')
    const due = all.filter((p) => p.status === 'scheduled' && p.publishAt && p.publishAt <= Date.now())
    if (due.length) { due.forEach((p) => { p.status = 'active' }); write('products', all) }
    const moods = read('moods').filter((m) => m.visible).sort((a, b) => a.order - b.order)
    const products = read('products').filter((p) => p.status === 'active')
    const sales = read('sales').filter((s) => s.active)
    const settings = read('settings')[0] || seedSettings
    const banners = read('banners').filter((b) => b.active)
    return delay({ moods, products, sales, settings, banners })
  },
  async list(name) {
    const rows = read(name)
    if (name === 'orders') rows.sort((a, b) => b.createdAt - a.createdAt)
    return delay(rows)
  },
  async save(name, obj) {
    const rows = read(name)
    if (name === 'promos' && !obj.id && rows.some((r) => r.code === obj.code.toUpperCase())) {
      throw new Error(`${obj.code.toUpperCase()} already exists.`)
    }
    const id = obj.id || (name === 'promos' ? obj.code.toUpperCase() : name === 'settings' ? 'store' : slugify(obj.slug || obj.name || obj.title || '') + '-' + Math.random().toString(36).slice(2, 6))
    const next = { ...obj, id, updatedAt: Date.now() }
    if (name === 'promos') next.code = next.code.toUpperCase()
    if (name === 'products' || name === 'moods') next.slug = uniqueSlug(rows, next.slug || next.name, id)
    const idx = rows.findIndex((r) => r.id === id)
    const before = idx >= 0 ? rows[idx] : null
    if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
    else rows.push({ createdAt: Date.now(), ...next })
    write(name, rows)
    if (name === 'reviews') syncRating(next.productId)
    if (['products', 'promos', 'sales', 'settings', 'moods'].includes(name)) {
      const changed = before ? Object.keys(next).filter((k) => k !== 'updatedAt' && JSON.stringify(before[k]) !== JSON.stringify(next[k])) : []
      if (!before || changed.length) logAudit(`${name}.${before ? 'update' : 'create'}`, next.name || next.code || next.title || id, { changed })
    }
    return delay(next)
  },
  async remove(name, id) {
    const gone = read(name).find((r) => r.id === id)
    write(name, read(name).filter((r) => r.id !== id))
    if (name === 'reviews' && gone) syncRating(gone.productId)
    if (gone && ['products', 'promos', 'sales', 'moods'].includes(name)) logAudit(`${name}.delete`, gone.name || gone.code || gone.title || id)
    return delay(true)
  },

  /** Orders page: filters + offset paging (Firebase uses cursors; same shape). */
  async listOrders({ status = '', from = 0, to = 0, q = '', pageSize = 25, cursor = 0 } = {}) {
    const s = q.trim().toLowerCase()
    const rows = read('orders')
      .filter((o) => (!status || o.status === status) && (!from || o.createdAt >= from) && (!to || o.createdAt <= to))
      .filter((o) => !s || [o.number, o.customer.name, o.customer.phone].join(' ').toLowerCase().includes(s))
      .sort((a, b) => b.createdAt - a.createdAt)
    const page = rows.slice(cursor, cursor + pageSize)
    return delay({ rows: page, next: cursor + pageSize < rows.length ? cursor + pageSize : null, total: rows.length })
  },

  /* ---------- customer accounts ---------- */
  async myOrders(uid) {
    return delay(read('orders').filter((o) => o.userId === uid).sort((a, b) => b.createdAt - a.createdAt))
  },
  async getProfile(uid) {
    return delay(read('users').find((u) => u.id === uid) || null)
  },
  async saveProfile(uid, data) {
    const rows = read('users')
    const i = rows.findIndex((u) => u.id === uid)
    const next = { ...(rows[i] || {}), ...data, id: uid, updatedAt: Date.now() }
    if (i >= 0) rows[i] = next; else rows.push(next)
    write('users', rows)
    return delay(next)
  },
  async getWishlist(uid) {
    return delay(read('wishlists').find((w) => w.id === uid)?.productIds || [])
  },
  async saveWishlist(uid, productIds) {
    const rows = read('wishlists').filter((w) => w.id !== uid)
    rows.push({ id: uid, productIds: productIds.slice(0, 200), updatedAt: Date.now() })
    write('wishlists', rows)
    return delay(true)
  },
  async linkMyOrders(user) {
    if (!user?.email) return delay({ linked: 0 })
    const orders = read('orders')
    let linked = 0
    orders.forEach((o) => { if (!o.userId && o.customer.email?.toLowerCase() === user.email.toLowerCase()) { o.userId = user.uid; linked++ } })
    if (linked) write('orders', orders)
    return delay({ linked })
  },

  /* ---------- reviews ---------- */
  async productReviews(productId) {
    return delay(read('reviews').filter((r) => r.productId === productId && r.status === 'approved').sort((a, b) => b.createdAt - a.createdAt))
  },
  async reviewableItems({ token: t, orderId, uid }) {
    const o = read('orders').find((x) => (t && x.reviewToken === t) || (uid && orderId && x.id === orderId && x.userId === uid))
    if (!o || o.status !== 'delivered') throw new Error("That review link isn't active.")
    const done = read('reviews').filter((r) => r.orderId === o.id).map((r) => r.productId)
    const seen = new Set()
    return delay({
      number: o.number, name: o.customer.name.split(' ')[0],
      items: o.items.filter((i) => !seen.has(i.productId) && seen.add(i.productId)).map((i) => ({ productId: i.productId, name: i.name, image: i.image, reviewed: done.includes(i.productId) })),
    })
  },
  async submitReview({ token: t, orderId, uid, productId, rating, text }) {
    const o = read('orders').find((x) => (t && x.reviewToken === t) || (uid && orderId && x.id === orderId && x.userId === uid))
    if (!o || o.status !== 'delivered') throw new Error('Only delivered orders can be reviewed.')
    if (!o.items.some((i) => i.productId === productId)) throw new Error("That piece isn't in this order.")
    const r = parseInt(rating, 10)
    if (!(r >= 1 && r <= 5)) throw new Error('Pick 1 to 5 stars.')
    const rows = read('reviews')
    const id = `${o.id}_${productId}`
    if (rows.some((x) => x.id === id)) throw new Error('You already reviewed this one. Thank you.')
    const [first, last = ''] = o.customer.name.trim().split(/\s+/)
    rows.push({ id, productId, orderId: o.id, orderNumber: o.number, userId: o.userId || null, name: `${first} ${last ? `${last[0]}.` : ''}`.trim(), rating: r, text: String(text || '').slice(0, 1000), status: 'pending', reply: '', createdAt: Date.now() })
    write('reviews', rows)
    return delay({ ok: true })
  },

  async requestRestockAlert({ email, productId = '', moodId = '', color = '', size = '' }) {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('That email looks off.')
    const rows = read('restockAlerts')
    const id = [email.toLowerCase(), productId || `mood-${moodId}`, color, size].join('|')
    if (!rows.some((r) => r.id === id)) rows.push({ id, email: email.toLowerCase(), productId, moodId, color, size, createdAt: Date.now() })
    write('restockAlerts', rows)
    return delay(true)
  },

  async setStaffRole() {
    throw new Error('Team roles need Firebase. In demo mode there is one admin.')
  },
  async validatePromo({ code, items, phone }) {
    const products = read('products')
    const sales = read('sales')
    const promos = read('promos')
    const lines = items.map((it) => {
      const product = products.find((p) => p.id === it.productId)
      return { product, qty: it.qty, unitPrice: priceProduct(product, sales).price }
    })
    const promo = promos.find((p) => p.code === String(code).toUpperCase().trim())
    const orders = read('orders')
    const key = normalizePhone(phone)
    const res = evaluatePromo(promo, lines, {
      usedByCustomer: orders.filter((o) => normalizePhone(o.customer.phone) === key && o.promoCode === promo?.code && o.status !== 'cancelled').length,
      isFirstOrder: !key || !orders.some((o) => normalizePhone(o.customer.phone) === key),
    })
    return delay({ ...res, code: promo?.code, type: promo?.type })
  },
  async createOrder(payload) {
    const products = read('products')
    const moods = read('moods')
    products.forEach((p) => { p.moodName = moods.find((m) => m.id === p.moodId)?.name })
    const orders = read('orders')
    const counter = read('counters')
    const seq = Math.max(counter[0]?.orders || 1000, ...orders.map((o) => parseInt(o.number.replace(/\D/g, ''), 10) || 0)) + 1
    const { order, stockChanges, promoId } = buildOrder({
      payload, products, sales: read('sales').filter((s) => s.active), promos: read('promos').filter((p) => p.active),
      settings: read('settings')[0], orderNumber: `MOOD-${seq}`, previousOrders: orders,
    })
    write('counters', [{ id: 'orders', orders: seq }])
    stockChanges.forEach((c) => {
      const v = products.find((p) => p.id === c.productId).variants.find((x) => x.color === c.color && x.size === c.size)
      v.stock -= c.qty
    })
    write('products', products.map(({ moodName: _mood, ...p }) => p))
    if (promoId) {
      const promos = read('promos')
      const p = promos.find((x) => x.id === promoId)
      p.usedCount = (p.usedCount || 0) + 1
      write('promos', promos)
    }
    const saved = { ...order, id: `ord-${Date.now()}`, source: payload.source || 'web' }
    orders.push(saved)
    write('orders', orders)
    const customers = read('customers')
    const key = saved.customer.phoneKey
    const c = customers.find((x) => x.id === key)
    const base = { name: saved.customer.name, phone: saved.customer.phone, governorate: saved.address.governorate, lastOrderAt: saved.createdAt, updatedAt: Date.now() }
    if (c) Object.assign(c, base, { email: saved.customer.email || c.email, userId: saved.userId || c.userId || null, orders: c.orders + 1, spent: c.spent + saved.total })
    else customers.push({ id: key, ...base, email: saved.customer.email, userId: saved.userId, orders: 1, spent: saved.total, firstOrderAt: saved.createdAt, notes: '', tags: [] })
    write('customers', customers)
    return delay({ orderId: saved.id, number: saved.number, total: saved.total })
  },
  async trackOrder(number, phone) {
    const key = normalizePhone(phone)
    const o = read('orders').find((x) => x.number.toLowerCase() === number.toLowerCase().trim() && key.length >= 8 && normalizePhone(x.customer.phone).endsWith(key.slice(-8)))
    if (!o) throw new Error("We couldn't find that order.")
    const { number: n, status, total, createdAt, tracking, items, timeline } = o
    return delay({ number: n, status, total, createdAt, tracking, items, timeline })
  },
  async updateOrderStatus(id, status, extra = {}) {
    if (!ORDER_STATUSES.includes(status)) throw new Error('Unknown status')
    const orders = read('orders')
    const o = orders.find((x) => x.id === id)
    if (!o) throw new Error('Order not found.')
    if (!canTransition(o.status, status)) throw new Error(`An order can't go from ${o.status} to ${status}.`)
    const delta = stockDelta(o.status, status)
    if (delta) {
      const products = read('products')
      const variantOf = (it) => products.find((p) => p.id === it.productId)?.variants.find((x) => x.color === it.color && x.size === it.size)
      if (delta < 0) {
        const short = o.items.find((it) => (variantOf(it)?.stock || 0) < it.qty)
        if (short) throw new Error(`Not enough stock to reopen: ${short.name} (${short.size}).`)
      }
      o.items.forEach((it) => {
        const v = variantOf(it)
        if (v) v.stock += delta * it.qty
      })
      write('products', products)
    }
    if (status !== o.status) o.timeline.push({ status, at: Date.now(), note: extra.note || '' })
    o.status = status
    if (status === 'delivered' && o.paymentMethod === 'cod') o.paymentStatus = 'paid'
    if (status === 'delivered' && !o.reviewToken) o.reviewToken = token()
    if (status === 'refunded') o.paymentStatus = 'refunded'
    if (extra.tracking) o.tracking = extra.tracking
    if (typeof extra.notes === 'string') o.notes = extra.notes
    o.updatedAt = Date.now()
    write('orders', orders)
    return delay(o)
  },
  async subscribe(email) {
    const rows = read('subscribers')
    if (!rows.some((r) => r.email === email)) rows.push({ id: email, email, createdAt: Date.now() })
    write('subscribers', rows)
    return delay(true)
  },
  async uploadImage(file) {
    return resizeToDataUrl(file)
  },
}

