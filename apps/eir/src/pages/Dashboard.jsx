import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { useAuth, PERMISSIONS } from '@hae/ui'
import { db } from '../firebase'

export default function Dashboard() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission(PERMISSIONS.EIR_MANAGE)
  const [experts, setExperts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const snap = await getDocs(collection(db, 'experts'))
      if (cancelled) return
      setExperts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const bookable = experts.filter((e) => e.status === 'Active')
    const tags = new Set()
    for (const e of bookable) {
      for (const t of e.expertise || []) tags.add(t)
    }
    return {
      total: experts.length,
      active: bookable.length,
      areas: tags.size,
      recent: [...bookable]
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .slice(0, 6),
    }
  }, [experts])

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          EiR · Expert Office Hours
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
          Expert Directory
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Connect founders with subject-matter experts for 30-minute Office Hours.
          Staff manage profiles here; members browse and book.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Experts', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: 'Expertise areas', value: stats.areas },
        ].map((s) => (
          <div key={s.label} className="border border-hae-line bg-white p-4">
            <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              {s.label}
            </div>
            <div className="mt-2 font-display text-3xl text-hae-ink">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="border border-hae-line bg-white p-4">
        <h2 className="text-sm font-semibold text-hae-ink">How Office Hours works</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-hae-slate">
          <li>Browse the Directory for SMEs by expertise or name.</li>
          <li>Open an expert profile and use their booking link.</li>
          <li>Book a 30-minute meeting and share goals in the form.</li>
          <li>Confirm the calendar invite and come prepared.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/directory"
            className="bg-hae-crimson px-3 py-2 text-xs font-semibold tracking-wide text-white uppercase"
          >
            Find an expert
          </Link>
          {canManage ? (
            <Link
              to="/manage"
              className="border border-hae-line px-3 py-2 text-xs font-semibold tracking-wide text-hae-ink uppercase"
            >
              Manage experts
            </Link>
          ) : (
            <Link
              to="/how-it-works"
              className="border border-hae-line px-3 py-2 text-xs font-semibold tracking-wide text-hae-ink uppercase"
            >
              How it works
            </Link>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-hae-slate">
            Featured experts
          </h2>
          <Link to="/directory" className="text-xs font-semibold text-hae-crimson">
            View directory
          </Link>
        </div>
        {stats.recent.length === 0 ? (
          <p className="text-sm text-hae-slate">
            {canManage
              ? 'No experts yet. Add profiles in Manage experts.'
              : 'No active experts in the directory yet. Check back soon.'}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.recent.map((e) => (
              <Link
                key={e.id}
                to={`/experts/${e.id}`}
                className="border border-hae-line bg-white p-4 transition-colors hover:border-hae-crimson"
              >
                <div className="text-sm font-semibold text-hae-ink">{e.name}</div>
                <div className="mt-1 text-xs text-hae-slate">
                  {e.title || 'Expert'}
                  {e.organization ? ` · ${e.organization}` : ''}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {(e.expertise || []).slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="bg-hae-mist px-1.5 py-0.5 text-[10px] font-medium text-hae-slate"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
