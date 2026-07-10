import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth'
import { auth } from '@hae/firebase'

/**
 * Custom Firebase email-action handler.
 *
 * Firebase sometimes sends reset/verify links with an empty `apiKey=` query
 * param, which makes the hosted `/__/auth/action` page fail with
 * "The selected page mode is invalid." This page uses the app's configured
 * Auth instance (which already has the correct API key) and only needs
 * `mode` + `oobCode` from the URL.
 */
export default function AuthActionPage({ appName = 'HAE Platform' }) {
  const [params] = useSearchParams()
  const mode = params.get('mode') || ''
  const oobCode = params.get('oobCode') || ''

  const [status, setStatus] = useState('loading') // loading | ready | success | error
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function prepare() {
      if (!oobCode) {
        if (!cancelled) {
          setStatus('error')
          setError('This link is missing a reset code. Request a new password reset email.')
        }
        return
      }

      try {
        if (mode === 'resetPassword') {
          const accountEmail = await verifyPasswordResetCode(auth, oobCode)
          if (!cancelled) {
            setEmail(accountEmail || '')
            setStatus('ready')
          }
          return
        }

        if (mode === 'verifyEmail' || mode === 'recoverEmail') {
          await checkActionCode(auth, oobCode)
          await applyActionCode(auth, oobCode)
          if (!cancelled) setStatus('success')
          return
        }

        if (!cancelled) {
          setStatus('error')
          setError(
            mode
              ? `Unsupported action “${mode}”.`
              : 'This link is missing an action mode. Request a new email from the sign-in page.'
          )
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(
            err?.code === 'auth/invalid-action-code' ||
              err?.code === 'auth/expired-action-code'
              ? 'This link is invalid or has expired. Request a new one from the sign-in page.'
              : err?.message || 'Could not process this link.'
          )
        }
      }
    }

    prepare()
    return () => {
      cancelled = true
    }
  }, [mode, oobCode])

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await confirmPasswordReset(auth, oobCode, password)
      setStatus('success')
    } catch (err) {
      setError(
        err?.code === 'auth/invalid-action-code' ||
          err?.code === 'auth/expired-action-code'
          ? 'This link is invalid or has expired. Request a new one from the sign-in page.'
          : err?.message || 'Could not update password.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const title =
    mode === 'resetPassword'
      ? 'Choose a new password'
      : mode === 'verifyEmail'
        ? 'Email verified'
        : mode === 'recoverEmail'
          ? 'Email restored'
          : 'Account action'

  const successMessage =
    mode === 'resetPassword'
      ? 'Your password was updated. You can sign in with the new password.'
      : mode === 'verifyEmail'
        ? 'Your email address is verified. You can sign in now.'
        : 'Your email change was applied. You can sign in now.'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(184,0,40,0.12)_0%,_#ffffff_42%,_#f6f6f6_100%)]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src="/hae-logo.webp"
            alt="Harvard Alumni Entrepreneurs"
            className="mx-auto h-14 w-auto object-contain"
          />
          <h1 className="mt-5 font-display text-2xl text-hae-ink sm:text-3xl">{appName}</h1>
          <p className="mt-2 text-sm text-hae-slate">{title}</p>
        </div>

        <div className="border border-hae-line bg-white/95 p-4 shadow-[0_8px_28px_rgba(26,26,26,0.04)] sm:p-6">
          {status === 'loading' ? (
            <p className="text-sm text-hae-slate">Checking your link…</p>
          ) : null}

          {status === 'error' ? (
            <div className="space-y-4">
              <p className="text-sm text-hae-red">{error}</p>
              <Link
                to="/login"
                className="inline-block text-sm font-semibold text-hae-crimson hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : null}

          {status === 'success' ? (
            <div className="space-y-4">
              <p className="text-sm text-hae-green">{successMessage}</p>
              <Link
                to="/login"
                className="inline-block w-full bg-hae-crimson px-4 py-2.5 text-center text-sm font-semibold tracking-wide text-white uppercase hover:bg-hae-crimson-dark"
              >
                Sign in
              </Link>
            </div>
          ) : null}

          {status === 'ready' && mode === 'resetPassword' ? (
            <form onSubmit={handleReset} className="space-y-4">
              {email ? (
                <p className="text-sm text-hae-slate">
                  Resetting password for <span className="font-medium text-hae-ink">{email}</span>
                </p>
              ) : null}
              <label className="block text-sm font-medium text-hae-ink">
                New password
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
              </label>
              <label className="block text-sm font-medium text-hae-ink">
                Confirm password
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
              </label>
              {error ? <p className="text-sm text-hae-red">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-hae-crimson px-4 py-2.5 text-sm font-semibold tracking-wide text-white uppercase hover:bg-hae-crimson-dark disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Update password'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
