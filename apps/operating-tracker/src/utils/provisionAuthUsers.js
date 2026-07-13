/**
 * Provision Firebase Auth accounts for emails (Admin Users).
 * Prefers Cloud Function (Admin SDK); falls back to client secondaryAuth.
 */
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions, secondaryAuth } from '../firebase'

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function parseEmailList(text) {
  return [
    ...new Set(
      String(text || '')
        .split(/[\s,;]+/)
        .map(normalizeEmail)
        .filter(isValidEmail)
    ),
  ]
}

function randomTempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex}Aa1!`
}

async function provisionViaClient({ emails, role, nameByEmail, sendReset }) {
  const results = []
  for (const email of emails) {
    const name = nameByEmail?.[email] || email.split('@')[0]
    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        randomTempPassword()
      )
      await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        email,
        role,
        createdAt: serverTimestamp(),
      })
      if (sendReset) {
        await sendPasswordResetEmail(secondaryAuth, email)
      }
      await signOut(secondaryAuth)
      results.push({ email, status: 'created', uid: cred.user.uid })
    } catch (err) {
      try {
        await signOut(secondaryAuth)
      } catch {
        /* ignore */
      }
      if (err?.code === 'auth/email-already-in-use') {
        if (sendReset) {
          try {
            await sendPasswordResetEmail(secondaryAuth, email)
            results.push({ email, status: 'exists', resetSent: true })
            continue
          } catch (resetErr) {
            results.push({
              email,
              status: 'exists',
              error: resetErr?.message || String(resetErr),
            })
            continue
          }
        }
        results.push({ email, status: 'exists' })
        continue
      }
      results.push({
        email,
        status: 'error',
        error: err?.message || String(err),
      })
    }
  }
  return { results, via: 'client' }
}

/**
 * @param {{ emails: string[], role?: string, nameByEmail?: Record<string,string>, sendReset?: boolean }} opts
 */
export async function provisionAuthUsers(opts) {
  const emails = [
    ...new Set((opts.emails || []).map(normalizeEmail).filter(isValidEmail)),
  ]
  if (emails.length === 0) {
    throw new Error('Provide at least one valid email.')
  }
  const role = opts.role || 'staff'
  const nameByEmail = opts.nameByEmail || {}
  const sendReset = opts.sendReset !== false

  try {
    const callable = httpsCallable(functions, 'provisionAuthUsers')
    const { data } = await callable({ emails, role, nameByEmail })
    const results = data?.results || []
    if (sendReset) {
      for (const row of results) {
        if (row.status === 'created' || row.status === 'exists') {
          try {
            await sendPasswordResetEmail(secondaryAuth, row.email)
            row.resetSent = true
          } catch (err) {
            row.resetError = err?.message || String(err)
          }
        }
      }
    }
    return { results, via: 'function' }
  } catch (err) {
    // Functions may be unavailable on Spark / not deployed yet.
    const code = String(err?.code || '')
    if (
      code.includes('permission-denied') ||
      code.includes('unauthenticated')
    ) {
      throw err
    }
    return provisionViaClient({ emails, role, nameByEmail, sendReset })
  }
}
