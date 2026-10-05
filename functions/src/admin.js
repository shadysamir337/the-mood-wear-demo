import { onCall, HttpsError } from 'firebase-functions/https'
import { getAuth } from 'firebase-admin/auth'
import { db, requireRole, adminCall, audit, ROLES } from './lib.js'

/** Owners manage the team: give someone a role by email, or remove it. */
export const setStaffRole = onCall(adminCall, async (req) => {
  const actor = requireRole(req, 'owner')
  const email = String(req.data?.email || '').trim().toLowerCase()
  const role = req.data?.role || null
  if (role && !ROLES.includes(role)) throw new HttpsError('invalid-argument', 'Unknown role.')
  let user
  try { user = await getAuth().getUserByEmail(email) } catch { throw new HttpsError('not-found', 'No account with that email. Ask them to sign up first.') }
  if (user.uid === actor.uid && role !== 'owner') throw new HttpsError('failed-precondition', "You can't remove your own owner role.")
  await getAuth().setCustomUserClaims(user.uid, role ? { role } : {})
  await db.doc(`staff/${user.uid}`).set({ email, role, updatedAt: Date.now() })
  if (!role) await db.doc(`staff/${user.uid}`).delete()
  await audit(actor, 'staff.role', email, { role })
  return { ok: true }
})

/** Records admin edits made directly through Firestore (products, promos, sales, settings, moods). */
export async function auditWrite(collection, event) {
  const before = event.data.before?.data()
  const after = event.data.after?.data()
  const action = !before ? 'create' : !after ? 'delete' : 'update'
  const changed = before && after ? Object.keys({ ...before, ...after }).filter((k) => k !== 'updatedAt' && JSON.stringify(before[k]) !== JSON.stringify(after[k])) : []
  if (action === 'update' && !changed.length) return
  const actor = after?.updatedBy || before?.updatedBy || 'unknown'
  await db.collection('auditLog').add({ actor, action: `${collection}.${action}`, target: after?.name || after?.code || after?.title || before?.name || before?.code || event.params.id, details: { changed }, at: Date.now() })
}
