import { httpsCallable } from 'firebase/functions'
import { signInWithCustomToken } from 'firebase/auth'
import { auth, functions } from '@hae/firebase'
import { moduleHref } from './modules.js'

const SSO_PARAM = 'sso'

/** Pull an SSO custom token from the URL (query or hash) and strip it. */
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

/** Sign in with a handoff custom token if present in the URL. */
export async function consumeSsoTokenIfPresent() {
  const token = takeSsoTokenFromUrl()
  if (!token) return false
  await signInWithCustomToken(auth, token)
  return true
}

/** Mint a custom token for the current user (Cloud Function). */
export async function createSsoToken() {
  if (!auth.currentUser) {
    throw new Error('Not signed in')
  }
  const callable = httpsCallable(functions, 'createSsoToken')
  const result = await callable({})
  const token = result?.data?.token
  if (!token) throw new Error('No SSO token returned')
  return token
}

/** Build a destination URL that carries an SSO token. */
export function withSsoToken(href, token) {
  const url = new URL(href, window.location.origin)
  url.searchParams.set(SSO_PARAM, token)
  return url.toString()
}

/**
 * Navigate to another HAE app while carrying the current session.
 * Falls back to a plain navigation if the SSO function is unavailable.
 */
export async function navigateToModule(module, { openInNewTab = false } = {}) {
  const href = moduleHref(module)
  let destination = href

  try {
    if (auth.currentUser) {
      const token = await createSsoToken()
      destination = withSsoToken(href, token)
    }
  } catch (err) {
    console.warn('SSO handoff unavailable, opening app without token', err)
  }

  if (openInNewTab) {
    window.open(destination, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.assign(destination)
}
