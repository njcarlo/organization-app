import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { useAuth } from '@hae/ui'
import { db } from '../firebase'
import { matchesLearner } from '../utils/learner'

export default function MyCertificates() {
  const { userProfile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const snap = await getDocs(collection(db, 'certificates'))
      if (cancelled) return
      setItems(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || ''))
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mine = useMemo(
    () => items.filter((c) => matchesLearner(c, userProfile)),
    [items, userProfile]
  )

  if (loading) return <p className="text-sm text-hae-slate">Loading certificates…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">
          My certificates
        </h1>
        <p className="mt-1 text-sm text-hae-slate">
          HAE Certificates of Completion issued to you
        </p>
      </header>

      {mine.length === 0 ? (
        <p className="text-sm text-hae-slate">
          No certificates yet. Complete an eligible course to receive one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {mine.map((c) => (
            <div key={c.id} className="border border-hae-line bg-white p-5">
              <div className="text-[11px] font-semibold tracking-wider text-hae-crimson uppercase">
                Certificate of Completion
              </div>
              <h2 className="mt-2 text-base font-semibold text-hae-ink">
                {c.courseName || 'Course'}
              </h2>
              <p className="mt-2 text-sm text-hae-slate">
                Issued {c.issuedAt || '—'} · {c.status || 'Issued'}
              </p>
              {c.courseId ? (
                <Link
                  to={`/courses/${c.courseId}`}
                  className="mt-4 inline-block text-xs font-semibold text-hae-crimson"
                >
                  View course →
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
