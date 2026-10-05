/**
 * Public data API used by the whole app. Two interchangeable adapters with the same surface:
 *   - api-local.js  : demo mode (seeded localStorage database, no Firebase)
 *   - api-remote.js : Firebase (Firestore + Cloud Functions + Storage), loaded on demand
 */
import { isFirebaseConfigured } from './config'
import { local } from './api-local'

export { slugify } from './slug'

let remoteModule
const loadRemote = () => (remoteModule ||= import('./api-remote').then((m) => m.remote))

/** Every method call waits for the Firebase adapter to load the first time. */
const lazy = new Proxy({}, {
  get: (_, name) => async (...args) => (await loadRemote())[name](...args),
})

export const api = isFirebaseConfigured ? lazy : local
