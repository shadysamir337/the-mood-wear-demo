/**
 * Firebase adapter. Loaded lazily, only when Firebase is configured.
 * Catalog and admin edits go straight to Firestore (guarded by firestore.rules);
 * anything touching money or stock goes through Cloud Functions.
 */
import {
  collection, getDocs, getDoc, doc, setDoc, addDoc, deleteDoc, query, where, orderBy, limit, startAfter,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, functions, storage } from './firebase'
import { seedSettings } from './seed'
import { slugify } from './slug'
import { resizeImage } from './images'
import { normalizePhone } from './pricing'

const PUBLIC_FILTERS = {
  products: ['status', '==', 'active'],
  moods: ['visible', '==', true],
  sales: ['active', '==', true],
  banners: ['active', '==', true],
}
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))
const fetchAll = async (name, publicOnly) => {
  const col = collection(db, name)
  const q = publicOnly && PUBLIC_FILTERS[name] ? query(col, where(...PUBLIC_FILTERS[name])) : col
  return rows(await getDocs(q))
}
const strip = (obj) => {
  const { id: _id, ...rest } = obj
  return JSON.parse(JSON.stringify(rest))
}

/** Callable wrapper that turns Firebase error codes into the human message thrown by the function. */
const call = (name) => async (data) => {
  try {
    return (await httpsCallable(functions, name)(data)).data
  } catch (e) {
    throw new Error(e?.message?.replace(/^.*?:\s/, '') || 'Something went wrong. Try again.')
  }
}

const cursors = new Map()

export const remote = {
  async catalog() {
    const [moods, products, sales, banners, settingsSnap] = await Promise.all([
      fetchAll('moods', true), fetchAll('products', true), fetchAll('sales', true), fetchAll('banners', true),
      getDoc(doc(db, 'settings', 'store')),
    ])
    return {
      moods: moods.sort((a, b) => a.order - b.order), products, sales, banners,
      settings: settingsSnap.exists() ? { id: 'store', ...settingsSnap.data() } : seedSettings,
    }
  },
  async list(name) {
    if (name === 'orders') return rows(await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(500))))
    if (name === 'auditLog') return rows(await getDocs(query(collection(db, 'auditLog'), orderBy('at', 'desc'), limit(200))))
    if (name === 'reviews') return rows(await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(300))))
    return fetchAll(name, false)
  },
  async listOrders({ status = '', from = 0, to = 0, q = '', pageSize = 25, cursor = null } = {}) {
    const s = q.trim()
    const parts = []
    const byNumber = /^mood-\d+$/i.test(s)
    const byPhone = !byNumber && /^[+\d\s-]{8,}$/.test(s)
    if (byNumber) parts.push(where('number', '==', s.toUpperCase()))
    if (byPhone) parts.push(where('customer.phoneKey', '==', normalizePhone(s)))
    if (status) parts.push(where('status', '==', status))
    if (from) parts.push(where('createdAt', '>=', from))
    if (to) parts.push(where('createdAt', '<=', to))
    parts.push(orderBy('createdAt', 'desc'))
    if (cursor && cursors.has(cursor)) parts.push(startAfter(cursors.get(cursor)))
    parts.push(limit(pageSize + 1))
    const snap = await getDocs(query(collection(db, 'orders'), ...parts))
    let list = rows(snap).slice(0, pageSize)
    if (s && !byNumber && !byPhone) {
      // name search runs on the loaded page; order numbers and phones use the index above
      const t = s.toLowerCase()
      list = list.filter((o) => [o.number, o.customer.name, o.customer.phone].join(' ').toLowerCase().includes(t))
    }
    let next = null
    if (snap.docs.length > pageSize) {
      next = `${Date.now()}-${Math.random()}`
      cursors.set(next, snap.docs[pageSize - 1])
    }
    return { rows: list, next, total: null }
  },
  async save(name, obj) {
    const data = { ...strip(obj), updatedAt: Date.now(), updatedBy: auth.currentUser?.email || '' }
    if (name === 'promos') {
      data.code = data.code.toUpperCase()
      if (!obj.id) {
        if ((await getDoc(doc(db, 'promos', data.code))).exists()) throw new Error(`${data.code} already exists.`)
        data.usedCount = 0
      }
    }
    if (name === 'products' || name === 'moods') {
      let slug = slugify(data.slug || data.name) || 'item'
      for (let n = 2; ; n++) {
        const taken = (await getDocs(query(collection(db, name), where('slug', '==', slug), limit(2)))).docs.some((d) => d.id !== obj.id)
        if (!taken) break
        slug = `${slugify(data.slug || data.name)}-${n}`
      }
      data.slug = slug
    }
    const id = obj.id || (name === 'promos' ? data.code : name === 'settings' ? 'store' : null)
    if (id) {
      await setDoc(doc(db, name, id), data, { merge: true })
      return { id, ...data }
    }
    data.createdAt = Date.now()
    const r = await addDoc(collection(db, name), data)
    return { id: r.id, ...data }
  },
  async remove(name, id) {
    await deleteDoc(doc(db, name, id))
    return true
  },
  validatePromo: call('validatePromo'),
  createOrder: (payload) => call('createOrder')(payload),
  trackOrder: (number, phone) => call('trackOrder')({ number, phone }),
  updateOrderStatus: (id, status, extra = {}) => call('updateOrderStatus')({ id, status, ...extra }),
  subscribe: (email) => call('subscribeNewsletter')({ email }),
  async uploadImage(file) {
    const base = `uploads/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, '')) || 'image'}`
    const sizes = await resizeImage(file, [480, 960, 1600])
    const urls = []
    for (const { blob, width } of sizes) {
      const r = ref(storage, `${base}-${width}.webp`)
      await uploadBytes(r, blob, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' })
      urls.push({ url: await getDownloadURL(r), width })
    }
    const largest = urls[urls.length - 1]
    return { src: largest.url, srcset: urls.map((u) => `${u.url} ${u.width}w`).join(', ') }
  },

  /* ---------- customer accounts ---------- */
  async myOrders(uid) {
    return rows(await getDocs(query(collection(db, 'orders'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(50))))
  },
  async getProfile(uid) {
    const s = await getDoc(doc(db, 'users', uid))
    return s.exists() ? { id: uid, ...s.data() } : null
  },
  async saveProfile(uid, data) {
    const clean = { ...strip(data), updatedAt: Date.now() }
    await setDoc(doc(db, 'users', uid), clean, { merge: true })
    return { id: uid, ...clean }
  },
  async getWishlist(uid) {
    const s = await getDoc(doc(db, 'wishlists', uid))
    return s.exists() ? s.data().productIds || [] : []
  },
  async saveWishlist(uid, productIds) {
    await setDoc(doc(db, 'wishlists', uid), { productIds: productIds.slice(0, 200), updatedAt: Date.now() })
    return true
  },
  linkMyOrders: () => call('linkMyOrders')({}),

  /* ---------- reviews ---------- */
  async productReviews(productId) {
    return rows(await getDocs(query(collection(db, 'reviews'), where('productId', '==', productId), where('status', '==', 'approved'), orderBy('createdAt', 'desc'), limit(50))))
  },
  reviewableItems: ({ token, orderId }) => call('reviewableItems')({ token, orderId }),
  submitReview: ({ token, orderId, productId, rating, text }) => call('submitReview')({ token, orderId, productId, rating, text }),
  requestRestockAlert: call('requestRestockAlert'),
  setStaffRole: call('setStaffRole'),
}
