/**
 * Firebase settings from the environment. Kept free of SDK imports so the
 * storefront can decide what to load without pulling Firebase into the main bundle.
 */
const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const functionsRegion = env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1'
export const useEmulators = env.VITE_FIREBASE_EMULATORS === '1'
export const appCheckKey = env.VITE_FIREBASE_APPCHECK_KEY || ''

/**
 * When no Firebase keys are present the site runs in DEMO MODE: everything works
 * against a seeded browser database so you can design and test the full flow.
 */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

/** Production builds refuse demo mode unless explicitly allowed (e.g. for a preview link). */
export const demoBlocked = env.PROD && !isFirebaseConfigured && env.VITE_ALLOW_DEMO !== '1'
