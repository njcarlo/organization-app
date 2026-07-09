import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  setDoc,
  doc,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { DEFAULT_PROGRAMS } from '../constants'

export default function Setup() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [alreadySetup, setAlreadySetup] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDocs(collection(db, 'users'))
        if (!cancelled) {
          setAlreadySetup(!snap.empty)
          setChecking(false)
        }
      } catch {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSetup = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // Re-check right before write to avoid double-seed race
      const existingUsers = await getDocs(collection(db, 'users'))
      if (!existingUsers.empty) {
        setAlreadySetup(true)
        setError('Setup already completed. Please sign in instead.')
        return
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      )
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'admin',
        createdAt: serverTimestamp(),
      })

      const existingPrograms = await getDocs(collection(db, 'programs'))
      if (existingPrograms.empty) {
        for (const program of DEFAULT_PROGRAMS) {
          await addDoc(collection(db, 'programs'), {
            ...program,
            createdAt: serverTimestamp(),
          })
        }
      }

      navigate('/')
    } catch (err) {
      setError(err.message || 'Setup failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-hae-mist text-hae-slate">
        Checking setup…
      </div>
    )
  }

  if (alreadySetup) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-hae-mist px-4 text-center">
        <img src="/hae-logo.webp" alt="HAE" className="mx-auto h-12 w-auto" />
        <h1 className="mt-6 font-display text-2xl text-hae-ink sm:text-3xl">Already set up</h1>
        <p className="mt-2 max-w-md text-sm text-hae-slate">
          Users already exist in this project. Sign in with an existing account, or ask an
          admin to add you.
        </p>
        <Link
          to="/login"
          className="mt-6 bg-hae-crimson px-4 py-2 text-sm font-semibold tracking-wide text-white uppercase"
        >
          Go to login
        </Link>
      </div>
    )
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
          <h1 className="mt-5 font-display text-2xl text-hae-ink sm:text-3xl">First-time setup</h1>
          <p className="mt-2 text-sm text-hae-slate">
            Creates the admin account and seeds all 11 programs.
          </p>
        </div>

        <form
          onSubmit={handleSetup}
          className="border border-hae-line bg-white/95 p-4 shadow-[0_12px_40px_rgba(26,26,26,0.06)] sm:p-6"
        >
          <label className="block text-sm font-medium">
            Your name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          {error && <p className="mt-3 text-sm text-hae-red">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full bg-hae-crimson px-4 py-2.5 text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-hae-crimson-dark disabled:opacity-60"
          >
            {submitting ? 'Setting up…' : 'Create admin & seed programs'}
          </button>
        </form>
      </div>
    </div>
  )
}
