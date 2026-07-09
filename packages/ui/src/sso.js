import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { signInWithCustomToken } from 'firebase/auth'
import { auth, db, firebaseConfig } from '@hae/firebase'
import { moduleHref } from './modules.js'

const SSO_PARAM = 'sso'
const HANDOFF_TTL_MS = 2 * 60 * 1000
const AUTH_USER_KEY = `firebase:authUser:${firebaseConfig.apiKey}:${auth.name || '[DEFAULT]'}`
const IDB_NAME = 'firebaseLocalStorageDb'
const IDB_STORE = 'firebaseLocalStorage'

/** Pull an SSO handoff id from the URL and strip it. */
export function takeSsoTokenFromUrl() {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  let token = url.searchParams.get(SSO_PARAM)

  if (!token && url.hash) {
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    token = hashParams.get(SSO_PARAM)
    if (token) {
      hashParams.delete(SSO_PARAM)
      const nextHash = hashParams.toString()
      url.hash = nextHash ? `#${nextHash}` : ''
    }
  }

  if (!token) return null

  url.searchParams.delete(SSO_PARAM)
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
  return token
}

function openAuthDb() {
  return new Promise((resolve, reject) => {
    // Open existing DB without forcing a version (Auth SDK owns the schema).
    const req = indexedDB.open(IDB_NAME)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const database = req.result
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE, { keyPath: 'fbase_key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

async function persistAuthUser(userBlob) {
  // Prefer IndexedDB (default Firebase Auth web persistence).
  try {
    const idb = await openAuthDb()
    await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(IDB_STORE).put({ fbase_key: AUTH_USER_KEY, value: userBlob })
    })
    idb.close()
  } catch (err) {
    console.warn('IndexedDB auth persist failed, trying localStorage', err)
  }

  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userBlob))
  } catch {
    /* ignore */
  }
}

/**
 * Exchange a refresh token for ID/refresh tokens, persist a session blob,
 * then reload so AuthProvider picks it up.
 */
async function restoreSessionFromRefreshToken(refreshToken) {
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Refresh token exchange failed')
  }

  const now = Date.now()
  const userBlob = {
    uid: data.user_id,
    email: data.email || undefined,
    emailVerified: false,
    isAnonymous: false,
    providerData: [],
    stsTokenManager: {
      refreshToken: data.refresh_token,
      accessToken: data.id_token,
      expirationTime: now + Number(data.expires_in || 3600) * 1000,
    },
    createdAt: String(now),
    lastLoginAt: String(now),
    apiKey: firebaseConfig.apiKey,
    appName: auth.name || '[DEFAULT]',
  }

  await persistAuthUser(userBlob)

  const next =
    `${window.location.pathname}${window.location.search}${window.location.hash}` || '/'
  window.location.replace(next)
}

/**
 * Consume a handoff document and sign in on this origin.
 * Returns true if a session was established.
 */
export async function consumeSsoTokenIfPresent() {
  const handoffId = takeSsoTokenFromUrl()
  if (!handoffId) return false

  if (auth.currentUser) {
    try {
      await deleteDoc(doc(db, 'ssoHandoffs', handoffId))
    } catch {
      /* ignore */
    }
    return false
  }

  const snap = await getDoc(doc(db, 'ssoHandoffs', handoffId))
  if (!snap.exists()) {
    throw new Error('SSO handoff not found or already used')
  }

  const data = snap.data()
  try {
    await deleteDoc(doc(db, 'ssoHandoffs', handoffId))
  } catch {
    /* ignore — consumer may lack delete rights; TTL cleanup covers it */
  }

  const createdMs =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toMillis()
      : data.createdAt?.toMillis?.() || 0
  if (createdMs && Date.now() - createdMs > HANDOFF_TTL_MS) {
    throw new Error('SSO handoff expired')
  }

  if (data.customToken) {
    await signInWithCustomToken(auth, data.customToken)
    return true
  }

  if (data.refreshToken) {
    await restoreSessionFromRefreshToken(data.refreshToken)
    return true
  }

  throw new Error('SSO handoff missing credentials')
}

/** Create a short-lived handoff doc for the current user. */
export async function createSsoHandoff() {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')

  const refreshToken = user.refreshToken
  if (!refreshToken) throw new Error('No refresh token available')

  const ref = await addDoc(collection(db, 'ssoHandoffs'), {
    uid: user.uid,
    email: (user.email || '').toLowerCase(),
    refreshToken,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Alias used by older call sites. */
export async function createSsoToken() {
  return createSsoHandoff()
}

export function withSsoToken(href, handoffId) {
  const url = new URL(href, window.location.origin)
  url.searchParams.set(SSO_PARAM, handoffId)
  return url.toString()
}

/**
 * Navigate to another HAE app while carrying the current session.
 * Falls back to a plain navigation if handoff creation fails.
 */
export async function navigateToModule(module, { openInNewTab = false } = {}) {
  const href = moduleHref(module)
  let destination = href

  try {
    if (auth.currentUser) {
      const handoffId = await createSsoHandoff()
      destination = withSsoToken(href, handoffId)
    }
  } catch (err) {
    console.warn('SSO handoff unavailable, opening app without session', err)
  }

  if (openInNewTab) {
    window.open(destination, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.assign(destination)
}
