import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/https'

if (!getApps().length) initializeApp()
export const db = getFirestore()
export { FieldValue }

export const ROLES = ['owner', 'admin', 'staff']
const RANK = { staff: 1, admin: 2, owner: 3 }

/** Throws unless the caller has at least `min` role (staff < admin < owner). */
export function requireRole(req, min = 'staff') {
  const role = req.auth?.token?.role
  if (!role || (RANK[role] || 0) < RANK[min]) throw new HttpsError('permission-denied', "You don't have access to that.")
  return { uid: req.auth.uid, email: req.auth.token.email || '', role }
}

/** Callable options shared by public endpoints. App Check is enforced when APPCHECK=1 is set. */
export const publicCall = { cors: true, enforceAppCheck: process.env.APPCHECK === '1', maxInstances: 20 }
export const adminCall = { cors: true, maxInstances: 10 }

/**
 * Fixed-window rate limit stored in Firestore. `key` is something like `order:ip:1.2.3.4`.
 * Throws resource-exhausted when over the limit.
 */
export async function rateLimit(key, max, windowSec) {
  if (process.env.FUNCTIONS_EMULATOR === 'true' && process.env.RATE_LIMIT !== '1') return
  const ref = db.collection('rateLimits').doc(key.replace(/[/.#$[\]]/g, '_').slice(0, 300))
  const now = Date.now()
  const ok = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const d = snap.data()
    if (!d || now - d.start > windowSec * 1000) {
      tx.set(ref, { start: now, count: 1, expiresAt: new Date(now + windowSec * 1000) })
      return true
    }
    if (d.count >= max) return false
    tx.update(ref, { count: d.count + 1 })
    return true
  })
  if (!ok) throw new HttpsError('resource-exhausted', 'Too many tries. Give it a few minutes.')
}

export const ipOf = (req) => String(req.rawRequest?.headers?.['x-forwarded-for'] || req.rawRequest?.ip || 'unknown').split(',')[0].trim()

/** Plain-object copy limited to known string fields; anything else is dropped. */
export function pick(obj, fields, max = 300) {
  const out = {}
  for (const f of fields) if (obj?.[f] != null) out[f] = String(obj[f]).slice(0, max)
  return out
}

/** Wraps thrown Errors from the shared engine (validation messages) as HttpsErrors the client can show. */
export function asHttps(e) {
  if (e instanceof HttpsError) return e
  console.error(e)
  return new HttpsError('failed-precondition', e?.message || 'Something went wrong.')
}

export async function audit(actor, action, target, details = {}) {
  await db.collection('auditLog').add({ actor: actor?.email || actor?.uid || 'system', action, target, details, at: Date.now() })
}
