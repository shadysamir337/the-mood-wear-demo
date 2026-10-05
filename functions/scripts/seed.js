// Loads the starter catalog into Firestore. Skips collections that already have data unless --force.
//   GOOGLE_APPLICATION_CREDENTIALS=service-account.json npm run seed
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-the-mood npm run seed
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { seedMoods, seedProducts, seedPromos, seedSales, seedSettings, seedBanners } from '../shared/seed.js'

initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT })
const db = getFirestore()
const force = process.argv.includes('--force')

const sets = { moods: seedMoods, products: seedProducts, promos: seedPromos, sales: seedSales, banners: seedBanners, settings: [seedSettings] }
for (const [name, rows] of Object.entries(sets)) {
  const existing = await db.collection(name).limit(1).get()
  if (!existing.empty && !force) { console.log(`${name}: has data, skipped`); continue }
  const batch = db.batch()
  rows.forEach(({ id, ...data }) => batch.set(db.doc(`${name}/${id}`), { ...data, createdAt: data.createdAt || Date.now(), updatedAt: Date.now() }))
  await batch.commit()
  console.log(`${name}: ${rows.length}`)
}
const counter = db.doc('counters/orders')
if (!(await counter.get()).exists) await counter.set({ value: 1000 })
console.log('done')
