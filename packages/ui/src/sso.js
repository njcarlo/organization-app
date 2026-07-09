import { signInWithCustomToken } from 'firebase/auth'
import { auth, firebaseConfig } from '@hae/firebase'
import { moduleHref } from './modules.js'

const SSO_PARAM = 'sso'
const AUTH_USER_KEY = `firebase:authUser:${firebaseConfig.apiKey}:${auth.name || '[DEFAULT]'}`
const IDB_NAME = 'firebaseLocalStorageDb'
const IDB_STORE = 'firebaseLocalStorage'

/**
 * Pull an SSO payload from the URL hash (preferred) or query, then strip it.
 * Hash fragments are not sent to servers / referrers.
 */
export function takeSsoTokenFromUrl() {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  let token = null

  if (url.hash) {
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    token = hashParams.get(SSO_PARAM)
    if (token) {
      hashParams.delete(SSO_PARAM)
      const nextHash = hashParams.toString()
      url.hash = nextHash ? `#${nextHash}` : ''
    }
  }

  if (!token) {
    token = url.searchParams.get(SSO_PARAM)
    if (token) url.searchParams.delete(SSO_PARAM)
  }

  if (!token) return null

  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
  return token
}

function openAuthDb() {
  return new Promise((resolve, reject) => {
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

function decodeSsoPayload(raw) {
  // Formats:
  //   rt.<refreshToken>
  //   ct.<customToken>   (future Blaze / Cloud Functions)
  //   bare string treated as refresh token (legacy)
  if (!raw) return null
  if (raw.startsWith('rt.')) {
    return { type: 'refresh', value: decodeURIComponent(raw.slice(3)) }
  }
  if (raw.startsWith('ct.')) {
    return { type: 'custom', value: decodeURIComponent(raw.slice(3)) }
  }
  return { type: 'refresh', value: decodeURIComponent(raw) }
}

/**
 * Consume an SSO payload from the URL and sign in on this origin.
 * Returns true if a session was established (may reload the page).
 */
export async function consumeSsoTokenIfPresent() {
  const raw = takeSsoTokenFromUrl()
  if (!raw) return false

  if (auth.currentUser) return false

  const payload = decodeSsoPayload(raw)
  if (!payload?.value) throw new Error('Invalid SSO payload')

  if (payload.type === 'custom') {
    await signInWithCustomToken(auth, payload.value)
    return true
  }

  await restoreSessionFromRefreshToken(payload.value)
  return true
}

/** Build a destination URL that carries an SSO payload in the hash. */
export function withSsoToken(href, payload) {
  const url = new URL(href, window.location.origin)
  // Keep credentials in the hash so they are not sent to Hosting / referrers.
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
  hashParams.set(SSO_PARAM, payload)
  url.hash = hashParams.toString()
  url.searchParams.delete(SSO_PARAM)
  return url.toString()
}

/**
 * Navigate to another HAE app while carrying the current session.
 * Falls back to a plain navigation if no refresh token is available.
 */
export async function navigateToModule(module, { openInNewTab = false } = {}) {
  const href = moduleHref(module)
  let destination = href

  try {
    const user = auth.currentUser
    if (user?.refreshToken) {
      destination = withSsoToken(href, `rt.${encodeURIComponent(user.refreshToken)}`)
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

/** @deprecated kept for callers; returns a hash payload string */
export async function createSsoToken() {
  const user = auth.currentUser
  if (!user?.refreshToken) throw new Error('Not signed in')
  return `rt.${encodeURIComponent(user.refreshToken)}`
}
