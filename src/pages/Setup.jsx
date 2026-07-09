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

      for (const program of DEFAULT_PROGRAMS) {
        await addDoc(collection(db, 'programs'), {
          ...program,
          createdAt: serverTimestamp(),
        })
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
        <h1 className="font-display text-3xl text-hae-crimson">Already set up</h1>
        <p className="mt-2 max-w-md text-sm text-hae-slate">
          Users already exist in this project. Sign in with an existing account, or ask an
          admin to add you.
        </p>
        <Link
          to="/login"
          className="mt-6 rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold text-white"
        >
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#f3e8ea_0%,_#f7f5f2_45%,_#ebe7e0_100%)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="font-display text-5xl text-hae-crimson">HAE</div>
          <h1 className="mt-4 text-xl font-semibold text-hae-ink">First-time setup</h1>
          <p className="mt-2 text-sm text-hae-slate">
            Creates the admin account and seeds all 11 programs.
          </p>
        </div>

        <form
          onSubmit={handleSetup}
          className="rounded-xl border border-hae-line bg-white/90 p-6 shadow-sm"
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
            className="mt-5 w-full rounded-md bg-hae-crimson px-4 py-2.5 text-sm font-semibold text-white hover:bg-hae-crimson-dark disabled:opacity-60"
          >
            {submitting ? 'Setting up…' : 'Create admin & seed programs'}
          </button>
        </form>
      </div>
    </div>
  )
}
