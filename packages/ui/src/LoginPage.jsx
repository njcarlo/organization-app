import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function LoginPage({ appName = 'HAE Platform' }) {
  const { user, login, requestPasswordReset, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      if (mode === 'reset') {
        await requestPasswordReset(email.trim())
        setMessage(
          'If an account exists for that email, a reset link is on the way. Check your inbox (and spam). If the link says “page mode is invalid”, change /__/auth/action to /auth/action in the URL and reload.'
        )
      } else {
        await login(email.trim(), password)
        navigate('/')
      }
    } catch (err) {
      setError(err.message || (mode === 'reset' ? 'Reset failed' : 'Sign-in failed'))
    } finally {
      setSubmitting(false)
    }
  }

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
          <p className="mt-2 text-sm text-hae-slate">
            {mode === 'reset'
              ? 'We will email you a password reset link'
              : 'Sign in with your HAE account'}
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="border border-hae-line bg-white/95 p-4 shadow-[0_8px_28px_rgba(26,26,26,0.04)] sm:p-6"
        >
          <label className="block text-sm font-medium text-hae-ink">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          {mode === 'signin' ? (
            <label className="mt-4 block text-sm font-medium text-hae-ink">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
          ) : null}
          {error && <p className="mt-3 text-sm text-hae-red">{error}</p>}
          {message && <p className="mt-3 text-sm text-hae-green">{message}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full bg-hae-crimson px-4 py-2.5 text-sm font-semibold tracking-wide text-white uppercase hover:bg-hae-crimson-dark disabled:opacity-60"
          >
            {submitting
              ? mode === 'reset'
                ? 'Sending…'
                : 'Signing in…'
              : mode === 'reset'
                ? 'Send reset link'
                : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'reset' : 'signin')
              setError('')
              setMessage('')
            }}
            className="mt-3 w-full text-center text-sm font-semibold text-hae-crimson hover:underline"
          >
            {mode === 'signin' ? 'Forgot password?' : 'Back to sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
