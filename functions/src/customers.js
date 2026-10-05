import { randomBytes } from 'node:crypto'
import { onCall, HttpsError } from 'firebase-functions/https'
import { onDocumentWritten } from 'firebase-functions/firestore'
import { db, rateLimit, ipOf, publicCall, asHttps } from './lib.js'

export const newToken = () => randomBytes(18).toString('base64url')

/** Who may review: a signed-in owner of a delivered order, or anyone holding that order's review link token. */
async function findReviewableOrder({ token, uid, orderId }) {
  if (token) {
    const snap = await db.collection('orders').where('reviewToken', '==', String(token)).limit(1).get()
    return snap.docs[0]
  }
  if (uid && orderId) {
    const snap = await db.doc(`orders/${String(orderId)}`).get()
    return snap.exists && snap.data().userId === uid ? snap : null
  }
  return null
}

/** Returns the products in an order that can still be reviewed (used by the /review page). */
export const reviewableItems = onCall(publicCall, async (req) => {
  await rateLimit(`review:ip:${ipOf(req)}`, 30, 600)
  const order = await findReviewableOrder({ token: req.data?.token, uid: req.auth?.uid, orderId: req.data?.orderId })
  if (!order || order.data().status !== 'delivered') throw new HttpsError('not-found', "That review link isn't active.")
  const o = order.data()
  const done = (await db.collection('reviews').where('orderId', '==', order.id).get()).docs.map((d) => d.data().productId)
  const seen = new Set()
  return {
    number: o.number,
    name: o.customer.name.split(' ')[0],
    items: o.items.filter((i) => !seen.has(i.productId) && seen.add(i.productId)).map((i) => ({ productId: i.productId, name: i.name, image: i.image, reviewed: done.includes(i.productId) })),
  }
})

export const submitReview = onCall(publicCall, async (req) => {
  await rateLimit(`review:ip:${ipOf(req)}`, 30, 600)
  const { productId, token, orderId } = req.data || {}
  const rating = parseInt(req.data?.rating, 10)
  const text = String(req.data?.text || '').trim().slice(0, 1000)
  if (!(rating >= 1 && rating <= 5)) throw new HttpsError('invalid-argument', 'Pick 1 to 5 stars.')
  try {
    const order = await findReviewableOrder({ token, uid: req.auth?.uid, orderId })
    if (!order || order.data().status !== 'delivered') throw new HttpsError('permission-denied', 'Only delivered orders can be reviewed.')
    const o = order.data()
    if (!o.items.some((i) => i.productId === productId)) throw new HttpsError('invalid-argument', "That piece isn't in this order.")
    const ref = db.doc(`reviews/${order.id}_${String(productId).replace(/\//g, '')}`)
    if ((await ref.get()).exists) throw new HttpsError('already-exists', 'You already reviewed this one. Thank you.')
    const [first, last = ''] = o.customer.name.trim().split(/\s+/)
    await ref.set({
      productId, orderId: order.id, orderNumber: o.number, userId: o.userId || null,
      name: `${first} ${last ? `${last[0]}.` : ''}`.trim(), rating, text, status: 'pending', reply: '', createdAt: Date.now(),
    })
    return { ok: true }
  } catch (e) {
    throw asHttps(e)
  }
})

/** Keeps product.rating = { avg, count } in sync with approved reviews. */
export const onReviewWritten = onDocumentWritten('reviews/{id}', async (event) => {
  const productId = (event.data.after?.data() || event.data.before?.data())?.productId
  if (!productId) return
  const approved = (await db.collection('reviews').where('productId', '==', productId).where('status', '==', 'approved').get()).docs.map((d) => d.data().rating)
  const count = approved.length
  const avg = count ? Math.round((approved.reduce((a, b) => a + b, 0) / count) * 10) / 10 : 0
  const product = db.doc(`products/${productId}`)
  if ((await product.get()).exists) await product.update({ rating: { avg, count } })
})

/** After sign-in with a verified email, attach that person's past guest orders to their account. */
export const linkMyOrders = onCall(publicCall, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  const email = req.auth.token.email
  if (!email || !req.auth.token.email_verified) return { linked: 0 }
  const snap = await db.collection('orders').where('customer.email', '==', email).where('userId', '==', null).limit(100).get()
  const batch = db.batch()
  snap.docs.forEach((d) => batch.update(d.ref, { userId: req.auth.uid }))
  if (!snap.empty) await batch.commit()
  return { linked: snap.size }
})

/** "Notify me" for a sold-out size or an upcoming drop. */
export const requestRestockAlert = onCall(publicCall, async (req) => {
  await rateLimit(`restock:ip:${ipOf(req)}`, 10, 600)
  const email = String(req.data?.email || '').trim().toLowerCase().slice(0, 120)
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'That email looks off.')
  const productId = String(req.data?.productId || '').slice(0, 120)
  const moodId = String(req.data?.moodId || '').slice(0, 120)
  if (!productId && !moodId) throw new HttpsError('invalid-argument', 'Missing product.')
  const size = String(req.data?.size || '').slice(0, 8)
  const color = String(req.data?.color || '').slice(0, 40)
  const id = [email, productId || `mood-${moodId}`, color, size].join('|').replace(/\//g, '_')
  await db.doc(`restockAlerts/${id}`).set({ email, productId, moodId, color, size, createdAt: Date.now() })
  return true
})
