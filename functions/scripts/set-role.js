// Give someone a staff role from your terminal (needed once, for the first owner).
//   GOOGLE_APPLICATION_CREDENTIALS=service-account.json npm run set-role -- you@email.com owner
// Roles: owner (everything, manages team), admin (everything except team), staff (orders + inventory).
// Pass "none" to remove the role. Against the emulator: FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const [email, role] = process.argv.slice(2)
if (!email || !['owner', 'admin', 'staff', 'none'].includes(role)) {
  console.error('Usage: npm run set-role -- <email> <owner|admin|staff|none>')
  process.exit(1)
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT })
const user = await getAuth().getUserByEmail(email)
await getAuth().setCustomUserClaims(user.uid, role === 'none' ? {} : { role })
const doc = getFirestore().doc(`staff/${user.uid}`)
if (role === 'none') await doc.delete()
else await doc.set({ email, role, updatedAt: Date.now() })
console.log(`${email} → ${role}. They need to sign out and back in.`)
