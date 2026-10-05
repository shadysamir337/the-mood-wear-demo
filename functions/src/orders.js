import { onCall, HttpsError } from 'firebase-functions/https'
import { db, FieldValue, requireRole, rateLimit, ipOf, pick, asHttps, audit, publicCall, adminCall } from './lib.js'
import { buildOrder, canTransition, evaluatePromo, normalizePhone, priceProduct, stockDelta, ORDER_STATUSES } from '../shared/pricing.js'

const SETTINGS = db.doc('settings/store')
const COUNTER = db.doc('counters/orders')

/** Reads everything an order depends on inside a transaction. */
async function loadContext(tx, items, promoCode, phone) {
  const ids = [...new Set(items.map((i) => String(i.productId)))].slice(0, 30)
  const productSnaps = ids.length ? await tx.getAll(...ids.map((id) => db.doc(`products/${id}`))) : []
  const products = productSnaps.filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() }))
  const moodIds = [...new Set(products.map((p) => p.moodId).filter(Boolean))]
  const moodSnaps = moodIds.length ? await tx.getAll(...moodIds.map((id) => db.doc(`moods/${id}`))) : []
  products.forEach((p) => { p.moodName = moodSnaps.find((m) => m.id === p.moodId)?.data()?.name || '' })

  const sales = (await tx.get(db.collection('sales').where('active', '==', true))).docs.map((d) => ({ id: d.id, ...d.data() }))
  const settingsSnap = await tx.get(SETTINGS)
  const settings = settingsSnap.exists ? settingsSnap.data() : {}

  let promos = []
  let previousOrders = []
  const code = String(promoCode || '').toUpperCase().trim()
  if (code) {
    const promoSnap = await tx.get(db.doc(`promos/${code.replace(/\//g, '')}`))
    if (promoSnap.exists) promos = [{ id: promoSnap.id, ...promoSnap.data() }]
    const key = normalizePhone(phone)
    if (key) {
      previousOrders = (await tx.get(db.collection('orders').where('customer.phoneKey', '==', key).limit(100))).docs.map((d) => d.data())
    }
  }
  return { products, sales, settings, promos, previousOrders }
}

const cleanItems = (items) => (Array.isArray(items) ? items : []).slice(0, 30).map((i) => ({
  productId: String(i?.productId || ''), color: String(i?.color || ''), size: String(i?.size || ''), qty: parseInt(i?.qty, 10) || 1,
}))

export const createOrder = onCall(publicCall, async (req) => {
  const data = req.data || {}
  const payload = {
    customer: pick(data.customer, ['name', 'phone', 'email'], 120),
    address: pick(data.address, ['governorate', 'city', 'street', 'notes'], 300),
    items: cleanItems(data.items),
    promoCode: String(data.promoCode || '').slice(0, 40),
    paymentMethod: 'cod',
    userId: req.auth?.uid || null,
  }
  // Staff placing a manual order (Instagram DM, phone call) skip the rate limit and tag the source.
  const staff = ['owner', 'admin', 'staff'].includes(req.auth?.token?.role)
  if (staff && data.source === 'manual') {
    payload.userId = null
    payload.source = 'manual'
  } else {
    await rateLimit(`order:ip:${ipOf(req)}`, 8, 600)
    if (payload.customer.phone) await rateLimit(`order:phone:${normalizePhone(payload.customer.phone)}`, 5, 3600)
  }

  try {
    const result = await db.runTransaction(async (tx) => {
      const ctx = await loadContext(tx, payload.items, payload.promoCode, payload.customer.phone)
      const counterSnap = await tx.get(COUNTER)
      const customerRef = db.doc(`customers/${normalizePhone(payload.customer.phone) || 'unknown'}`)
      const customerSnap = await tx.get(customerRef)
      const seq = (counterSnap.exists ? counterSnap.data().value : 1000) + 1
      const { order, stockChanges, promoId } = buildOrder({ payload, ...ctx, orderNumber: `MOOD-${seq}` })

      // reserve stock
      for (const p of ctx.products) {
        const changes = stockChanges.filter((c) => c.productId === p.id)
        if (!changes.length) continue
        const variants = p.variants.map((v) => {
          const used = changes.filter((c) => c.color === v.color && c.size === v.size).reduce((n, c) => n + c.qty, 0)
          return used ? { ...v, stock: Number(v.stock) - used } : v
        })
        tx.update(db.doc(`products/${p.id}`), { variants, updatedAt: Date.now() })
      }
      if (promoId) tx.update(db.doc(`promos/${promoId}`), { usedCount: FieldValue.increment(1) })
      tx.set(COUNTER, { value: seq }, { merge: true })

      const ref = db.collection('orders').doc()
      tx.set(ref, { ...order, source: payload.source || 'web' })
      const prev = customerSnap.data() || {}
      tx.set(customerRef, {
        name: order.customer.name, phone: order.customer.phone, email: order.customer.email || prev.email || '', governorate: order.address.governorate,
        userId: order.userId || prev.userId || null, orders: (prev.orders || 0) + 1, spent: (prev.spent || 0) + order.total,
        lastOrderAt: order.createdAt, firstOrderAt: prev.firstOrderAt || order.createdAt, updatedAt: Date.now(),
      }, { merge: true })
      return { orderId: ref.id, number: order.number, total: order.total }
    })
    return result
  } catch (e) {
    throw asHttps(e)
  }
})

export const validatePromo = onCall(publicCall, async (req) => {
  await rateLimit(`promo:ip:${ipOf(req)}`, 30, 600)
  const items = cleanItems(req.data?.items)
  const code = String(req.data?.code || '').toUpperCase().trim()
  if (!code) return { ok: false, error: "That code doesn't exist." }
  const { products, sales, promos, previousOrders } = await db.runTransaction((tx) => loadContext(tx, items, code, req.data?.phone))
  const lines = items.map((it) => {
    const product = products.find((p) => p.id === it.productId && p.status === 'active')
    return product && { product, qty: Math.max(1, Math.min(10, it.qty)), unitPrice: priceProduct(product, sales).price }
  }).filter(Boolean)
  const promo = promos[0]
  const key = normalizePhone(req.data?.phone)
  const res = evaluatePromo(promo, lines, {
    usedByCustomer: previousOrders.filter((o) => o.promoCode === promo?.code && o.status !== 'cancelled').length,
    isFirstOrder: !key || !previousOrders.length,
  })
  return { ...res, code: promo?.code, type: promo?.type }
})

/** Public tracking: needs the order number and the phone used on it. Returns only what the customer needs. */
export const trackOrder = onCall(publicCall, async (req) => {
  await rateLimit(`track:ip:${ipOf(req)}`, 20, 600)
  const number = String(req.data?.number || '').toUpperCase().trim()
  const key = normalizePhone(req.data?.phone)
  const snap = await db.collection('orders').where('number', '==', number).limit(1).get()
  const o = snap.docs[0]?.data()
  if (!o || key.length < 8 || !o.customer.phoneKey.endsWith(key.slice(-8))) throw new HttpsError('not-found', "We couldn't find that order.")
  return {
    number: o.number, status: o.status, total: o.total, createdAt: o.createdAt, tracking: o.tracking,
    items: o.items.map((i) => ({ name: i.name, size: i.size, color: i.color, qty: i.qty, productId: i.productId })),
    timeline: o.timeline.map((t) => ({ status: t.status, at: t.at })),
  }
})

export const updateOrderStatus = onCall(adminCall, async (req) => {
  const actor = requireRole(req, 'staff')
  const { id, status } = req.data || {}
  if (!ORDER_STATUSES.includes(status)) throw new HttpsError('invalid-argument', 'Unknown status.')
  const ref = db.doc(`orders/${String(id)}`)
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new HttpsError('not-found', 'Order not found.')
      const o = snap.data()
      if (!canTransition(o.status, status)) throw new HttpsError('failed-precondition', `An order can't go from ${o.status} to ${status}.`)
      const delta = stockDelta(o.status, status)
      if (delta) {
        const ids = [...new Set(o.items.map((i) => i.productId))]
        const snaps = await tx.getAll(...ids.map((pid) => db.doc(`products/${pid}`)))
        for (const ps of snaps) {
          if (!ps.exists) continue
          const items = o.items.filter((i) => i.productId === ps.id)
          const variants = ps.data().variants.map((v) => {
            const qty = items.filter((i) => i.color === v.color && i.size === v.size).reduce((n, i) => n + i.qty, 0)
            if (!qty) return v
            const stock = Number(v.stock) + delta * qty
            if (stock < 0) throw new HttpsError('failed-precondition', `Not enough stock to reopen: ${ps.data().name} (${v.size}).`)
            return { ...v, stock }
          })
          tx.update(ps.ref, { variants, updatedAt: Date.now() })
        }
      }
      const patch = { status, updatedAt: Date.now() }
      if (status !== o.status) patch.timeline = [...o.timeline, { status, at: Date.now(), note: String(req.data.note || '').slice(0, 200), by: actor.email }]
      if (status === 'delivered' && o.paymentMethod === 'cod') patch.paymentStatus = 'paid'
      if (status === 'refunded') patch.paymentStatus = 'refunded'
      if (req.data.tracking) patch.tracking = pick(req.data.tracking, ['courier', 'number'], 80)
      if (typeof req.data.notes === 'string') patch.notes = req.data.notes.slice(0, 2000)
      tx.update(ref, patch)
      return { order: { ...o, ...patch, id }, changed: status !== o.status }
    })
    if (out.changed) await audit(actor, 'order.status', out.order.number, { status })
    return out.order
  } catch (e) {
    throw asHttps(e)
  }
})

export const subscribeNewsletter = onCall(publicCall, async (req) => {
  await rateLimit(`news:ip:${ipOf(req)}`, 5, 600)
  const email = String(req.data?.email || '').trim().toLowerCase().slice(0, 120)
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'That email looks off.')
  await db.doc(`subscribers/${email}`).set({ email, createdAt: Date.now() }, { merge: true })
  return true
})
