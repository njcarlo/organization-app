import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { isSuperAdminEmail } from './superadmin.js'

/**
 * Ensure a signed-in superadmin has a users/{uid} profile with role admin.
 * Creates the doc if missing; upgrades role if not already admin.
 */
export async function ensureSuperAdminProfile(db, firebaseUser) {
  if (!firebaseUser?.uid) return null
  const email = (firebaseUser.email || '').trim().toLowerCase()
  if (!isSuperAdminEmail(email)) return null

  const ref = doc(db, 'users', firebaseUser.uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    const profile = {
      name: firebaseUser.displayName || email.split('@')[0] || 'Superadmin',
      email,
      role: 'admin',
      superadmin: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await setDoc(ref, profile)
    return { id: firebaseUser.uid, ...profile, role: 'admin' }
  }

  const data = snap.data() || {}
  const needsUpgrade =
    data.role !== 'admin' || data.superadmin !== true || data.email !== email

  if (needsUpgrade) {
    await updateDoc(ref, {
      role: 'admin',
      superadmin: true,
      email,
      updatedAt: serverTimestamp(),
    })
    return {
      id: snap.id,
      ...data,
      role: 'admin',
      superadmin: true,
      email,
    }
  }

  return { id: snap.id, ...data }
}
