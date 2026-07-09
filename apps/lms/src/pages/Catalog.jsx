import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { LEARNING_PATHS } from '../constants'
import { CATALOG_STATUSES } from '../utils/learner'

export default function Catalog() {
  const [courses, setCourses] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'courses'))
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => CATALOG_STATUSES.includes(c.status))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setCourses(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(
    () => (filter === 'all' ? courses : courses.filter((c) => c.path === filter)),
    [courses, filter]
  )

  if (loading) return <p className="text-sm text-hae-slate">Loading catalog…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Catalog</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Open Academy and Flagship courses you can explore
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { value: 'all', label: 'All' },
          ...LEARNING_PATHS,
        ].map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-xs font-semibold ${
              filter === f.value
                ? 'bg-hae-ink text-white'
                : 'border border-hae-line bg-white text-hae-slate'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-hae-slate">
          No open courses right now. Check back soon, or contact Academy staff.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((c) => (
            <Link
              key={c.id}
              to={`/courses/${c.id}`}
              className="border border-hae-line bg-white p-4 transition-colors hover:border-hae-crimson"
            >
              <div className="text-[11px] font-semibold tracking-wider text-hae-crimson uppercase">
                {c.path === 'flagship' ? 'Flagship Deep Dive' : 'Academy Fast Track'}
              </div>
              <h2 className="mt-2 text-base font-semibold text-hae-ink">{c.name}</h2>
              <p className="mt-1 text-xs text-hae-slate">
                {c.facilitator ? `${c.facilitator} · ` : ''}
                {c.durationWeeks ? `${c.durationWeeks} weeks · ` : ''}
                {c.status}
              </p>
              {c.description ? (
                <p className="mt-3 line-clamp-3 text-sm text-hae-slate">{c.description}</p>
              ) : null}
              <span className="mt-4 inline-block text-xs font-semibold text-hae-crimson">
                View course →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
