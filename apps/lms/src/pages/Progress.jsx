import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { useAuth } from '@hae/ui'
import { db } from '../firebase'
import { BADGE_DEFS, computeLearnerScore } from '../learningInsights'

export default function Progress() {
  const { userProfile } = useAuth()
  const [enrollments, setEnrollments] = useState([])
  const [checkIns, setCheckIns] = useState([])
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)

  const email = (userProfile?.email || '').trim().toLowerCase()

  useEffect(() => {
    if (!email) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      const [e, k, c] = await Promise.all([
        getDocs(query(collection(db, 'enrollments'), where('learnerEmail', '==', email))),
        getDocs(query(collection(db, 'checkIns'), where('learnerEmail', '==', email))),
        getDocs(query(collection(db, 'certificates'), where('learnerEmail', '==', email))),
      ])
      if (cancelled) return
      setEnrollments(e.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCheckIns(k.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCertificates(c.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [email])

  const score = useMemo(
    () => computeLearnerScore({ enrollments, checkIns, certificates }),
    [enrollments, checkIns, certificates]
  )

  const earnedIds = new Set(score.badges.map((b) => b.id))

  if (loading) return <p className="text-sm text-hae-slate">Loading progress…</p>

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Student · Progress
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl">
          Points & badges
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Earn points as you progress through courses, complete check-ins, and
          receive certificates. Friendly motivation — not a public leaderboard.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-hae-line bg-white p-4 sm:col-span-1">
          <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
            Your points
          </div>
          <div className="mt-2 font-display text-4xl text-hae-ink">{score.points}</div>
        </div>
        <div className="border border-hae-line bg-white p-4">
          <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
            Badges earned
          </div>
          <div className="mt-2 font-display text-4xl text-hae-ink">
            {score.badges.length}
          </div>
        </div>
        <div className="border border-hae-line bg-white p-4">
          <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
            Certificates
          </div>
          <div className="mt-2 font-display text-4xl text-hae-ink">
            {certificates.length}
          </div>
        </div>
      </div>

      <section className="border border-hae-line bg-white">
        <div className="border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold">Badge collection</h2>
        </div>
        <ul className="grid gap-3 p-4 sm:grid-cols-2">
          {BADGE_DEFS.map((b) => {
            const earned = earnedIds.has(b.id)
            return (
              <li
                key={b.id}
                className={`rounded-md border px-4 py-3 ${
                  earned
                    ? 'border-hae-crimson/30 bg-hae-crimson/5'
                    : 'border-hae-line bg-hae-mist/30 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-hae-ink">{b.label}</div>
                    <div className="mt-1 text-xs text-hae-slate">{b.description}</div>
                  </div>
                  <div className="text-xs font-bold text-hae-crimson">+{b.points}</div>
                </div>
                <div className="mt-2 text-[11px] font-semibold tracking-wide uppercase text-hae-slate">
                  {earned ? 'Earned' : 'Locked'}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/"
          className="bg-hae-crimson px-3 py-2 text-xs font-semibold tracking-wide text-white uppercase"
        >
          Back to My learning
        </Link>
        <Link
          to="/catalog"
          className="border border-hae-line px-3 py-2 text-xs font-semibold tracking-wide text-hae-ink uppercase"
        >
          Browse catalog
        </Link>
      </div>
    </div>
  )
}
