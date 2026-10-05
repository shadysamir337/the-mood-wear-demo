import { create } from 'zustand'
import { isFirebaseConfigured } from './config'

/** Demo-mode admin (only used when Firebase is not configured). */
export const DEMO_ADMIN = { email: 'admin@themood.co', password: 'mood2026' }

/* --------------------------- demo auth (local) --------------------------- */

const ACCOUNTS = 'mood:v1:accounts'
const SESSION = 'mood:demo-session'
const readAccounts = () => {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS)) || [] } catch { return [] }
}
const demoUser = (a) => ({ uid: a.uid, email: a.email, name: a.name || '', emailVerified: true })

const demo = {
  init(set) {
    const uid = localStorage.getItem(SESSION) || (localStorage.getItem('mood:demo-admin') ? 'demo-admin' : '')
    if (uid === 'demo-admin') set({ user: { uid, email: DEMO_ADMIN.email, name: 'Admin' }, role: 'owner', ready: true })
    else {
      const a = readAccounts().find((x) => x.uid === uid)
      set({ user: a ? demoUser(a) : null, role: null, ready: true })
    }
    return () => {}
  },
  async login(email, password) {
    if (email === DEMO_ADMIN.email && password === DEMO_ADMIN.password) {
      localStorage.setItem(SESSION, 'demo-admin')
      return { user: { uid: 'demo-admin', email, name: 'Admin' }, role: 'owner' }
    }
    const a = readAccounts().find((x) => x.email === email.toLowerCase().trim() && x.password === password)
    if (!a) throw new Error('Wrong email or password.')
    localStorage.setItem(SESSION, a.uid)
    return { user: demoUser(a), role: null }
  },
  async signup({ name, email, password }) {
    const list = readAccounts()
    const e = email.toLowerCase().trim()
    if (list.some((x) => x.email === e) || e === DEMO_ADMIN.email) throw new Error('That email already has an account.')
    if (password.length < 8) throw new Error('Use at least 8 characters.')
    const a = { uid: `u-${Date.now().toString(36)}`, email: e, password, name: name.trim() }
    localStorage.setItem(ACCOUNTS, JSON.stringify([...list, a]))
    localStorage.setItem(SESSION, a.uid)
    return { user: demoUser(a), role: null }
  },
  async google() {
    throw new Error('Google sign-in needs Firebase. Use email in demo mode.')
  },
  async reset() {
    return true
  },
  async logout() {
    localStorage.removeItem(SESSION)
    localStorage.removeItem('mood:demo-admin')
  },
}

/* ---------------------------- Firebase auth ----------------------------- */

const load = async () => ({ ...(await import('firebase/auth')), auth: (await import('./firebase')).auth })
const fbUser = (u) => ({ uid: u.uid, email: u.email, name: u.displayName || '', emailVerified: u.emailVerified })
const message = (e) => {
  const code = e?.code || ''
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return 'Wrong email or password.'
  if (/email-already-in-use/.test(code)) return 'That email already has an account.'
  if (/weak-password/.test(code)) return 'Use at least 8 characters.'
  if (/too-many-requests/.test(code)) return 'Too many tries. Give it a few minutes.'
  if (/popup-closed/.test(code)) return ''
  return (e?.message || 'Something went wrong.').replace('Firebase: ', '')
}

const firebase = {
  init(set) {
    let unsub = () => {}
    let cancelled = false
    load().then(({ onAuthStateChanged, auth }) => {
      if (cancelled) return
      unsub = onAuthStateChanged(auth, async (u) => {
        if (!u) return set({ user: null, role: null, ready: true })
        const token = await u.getIdTokenResult()
        set({ user: fbUser(u), role: token.claims.role || null, ready: true })
      })
    })
    return () => { cancelled = true; unsub() }
  },
  async login(email, password) {
    const { signInWithEmailAndPassword, auth } = await load()
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const token = await cred.user.getIdTokenResult(true)
    return { user: fbUser(cred.user), role: token.claims.role || null }
  },
  async signup({ name, email, password }) {
    const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, auth } = await load()
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (name) await updateProfile(cred.user, { displayName: name })
    sendEmailVerification(cred.user).catch(() => {})
    return { user: { ...fbUser(cred.user), name }, role: null }
  },
  async google() {
    const { GoogleAuthProvider, signInWithPopup, auth } = await load()
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    const token = await cred.user.getIdTokenResult()
    return { user: fbUser(cred.user), role: token.claims.role || null }
  },
  async reset(email) {
    const { sendPasswordResetEmail, auth } = await load()
    await sendPasswordResetEmail(auth, email)
    return true
  },
  async logout() {
    const { signOut, auth } = await load()
    await signOut(auth)
  },
}

const impl = isFirebaseConfigured ? firebase : demo

/** One auth store for customers and staff. `role` is set only for staff (owner, admin, staff). */
export const useAuth = create((set) => {
  const run = (fn) => async (...args) => {
    set({ error: '' })
    try {
      const res = await fn(...args)
      if (res?.user) set({ user: res.user, role: res.role })
      return res || true
    } catch (e) {
      set({ error: isFirebaseConfigured ? message(e) : e.message })
      return false
    }
  }
  return {
    user: null,
    role: null,
    ready: false,
    error: '',
    init: () => impl.init(set),
    clearError: () => set({ error: '' }),
    login: run(impl.login),
    /** Staff login: signs back out when the account has no staff role. */
    adminLogin: run(async (email, password) => {
      const res = await impl.login(email, password)
      if (!res.role) {
        await impl.logout()
        throw new Error("This account doesn't have admin access.")
      }
      return res
    }),
    signup: run(impl.signup),
    google: run(impl.google),
    reset: run(impl.reset),
    logout: async () => {
      await impl.logout()
      set({ user: null, role: null })
    },
  }
})

export const isStaffRole = (role) => ['owner', 'admin', 'staff'].includes(role)
export const can = (role, what) => {
  if (role === 'owner') return true
  if (role === 'admin') return what !== 'team'
  if (role === 'staff') return ['orders', 'inventory', 'customers', 'reviews', 'dashboard'].includes(what)
  return false
}
