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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#f3e8ea_0%,_#f7f5f2_45%,_#ebe7e0_100%)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="font-display text-5xl text-hae-crimson">HAE</div>
          <p className="mt-2 text-sm text-hae-slate">Harvard Alumni Entrepreneurs</p>
          <h1 className="mt-4 text-xl font-semibold text-hae-ink">Operating Tracker</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-hae-line bg-white/90 p-6 shadow-sm backdrop-blur"
        >
          <label className="block text-sm font-medium text-hae-ink">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-hae-ink">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          {error && <p className="mt-3 text-sm text-hae-red">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-md bg-hae-crimson px-4 py-2.5 text-sm font-semibold text-white hover:bg-hae-crimson-dark disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-hae-slate">
          First install?{' '}
          <Link to="/setup" className="text-hae-crimson hover:underline">
            Run setup
          </Link>
        </p>
      </div>
    </div>
  )
}
