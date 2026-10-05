// Firebase-mode E2E helpers: reset + seed the emulator database and make sure the admin exists.
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { seedMoods, seedProducts, seedPromos, seedSales, seedSettings, seedBanners } from '../shared/seed.js'

export const PROJECT = 'demo-the-mood'
export const isFirebaseRun = process.env.E2E_FIREBASE === '1'

function admin() {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
  if (!getApps().length) initializeApp({ projectId: PROJECT })
  return { db: getFirestore() }
}

export async function resetDb() {
  const { db } = admin()
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  const batch = db.batch()
  const sets = { moods: seedMoods, products: seedProducts, promos: seedPromos, sales: seedSales, banners: seedBanners, settings: [seedSettings] }
  for (const [name, rows] of Object.entries(sets)) rows.forEach(({ id, ...d }) => batch.set(db.doc(`${name}/${id}`), d))
  batch.set(db.doc('counters/orders'), { value: 1000 })
  await batch.commit()
}

// Auth emulator REST API (the admin Auth SDK doesn't load under Playwright's module loader).
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const post = (path, body, admin = false) => fetch(`${AUTH}/${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer owner' } : {}) },
  body: JSON.stringify(body),
}).then((r) => r.json())

/** Creates (or finds) an email/password user in the Auth emulator; optional staff role. */
export async function ensureUser(email, password, role) {
  let r = await post('accounts:signUp?key=demo', { email, password, returnSecureToken: true })
  if (r.error) r = await post('accounts:signInWithPassword?key=demo', { email, password, returnSecureToken: true })
  if (role) await post(`projects/${PROJECT}/accounts:update`, { localId: r.localId, customAttributes: JSON.stringify({ role }) }, true)
  return r.localId
}

export const ensureAdmin = () => ensureUser('admin@themood.co', 'mood2026', 'owner')

export default async function globalSetup() {
  await ensureAdmin()
  await resetDb()
}
