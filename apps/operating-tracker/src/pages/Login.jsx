import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Sign-in failed')
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
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-16 h-72 w-72 rounded-full bg-hae-coral/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-10 h-64 w-64 rounded-full bg-hae-crimson/10 blur-3xl"
      />

      <div className="relative w-full max-w-md animate-[fadeIn_0.5s_ease-out]">
        <div className="mb-8 text-center">
          <img
            src="/hae-logo.webp"
            alt="Harvard Alumni Entrepreneurs"
            className="mx-auto h-14 w-auto object-contain"
          />
          <h1 className="mt-5 font-display text-2xl text-hae-ink sm:text-3xl">Operating Tracker</h1>
          <p className="mt-2 text-sm text-hae-slate">
            Leadership hub for programs, projects, and tasks
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-hae-line bg-white/95 p-4 shadow-[0_12px_40px_rgba(26,26,26,0.06)] sm:p-6"
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
          {error && <p className="mt-3 text-sm text-hae-red">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full bg-hae-crimson px-4 py-2.5 text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-hae-crimson-dark disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-hae-slate">
          First install?{' '}
          <Link to="/setup" className="font-semibold text-hae-crimson hover:underline">
            Run setup
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
