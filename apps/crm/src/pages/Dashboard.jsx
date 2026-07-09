import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { PIPELINE_STAGES } from '../constants'

export default function Dashboard() {
  const [contacts, setContacts] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [c, i] = await Promise.all([
        getDocs(collection(db, 'contacts')),
        getDocs(collection(db, 'interactions')),
      ])
      if (cancelled) return
      setContacts(c.docs.map((d) => ({ id: d.id, ...d.data() })))
      setInteractions(i.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const byStage = PIPELINE_STAGES.map((s) => ({
      ...s,
      count: contacts.filter((c) => c.stage === s.value).length,
    }))
    const recent = [...interactions]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 6)
    const followUps = contacts
      .filter((c) => c.followUpDate && c.followUpDate >= today)
      .sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''))
      .slice(0, 6)
    return { byStage, recent, followUps, total: contacts.length }
  }, [contacts, interactions])

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Milestone 3 · Relationships
        </p>
        <h1 className="mt-2 font-display text-4xl text-hae-ink md:text-5xl">
          CRM Dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Contacts, pipeline stages, interactions, and upcoming follow-ups across
          alumni, donors, partners, and prospects.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="border border-hae-line bg-white p-4">
          <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
            Total contacts
          </div>
          <div className="mt-2 font-display text-3xl text-hae-ink">{stats.total}</div>
        </div>
        {stats.byStage.map((s) => (
          <div key={s.value} className="border border-hae-line bg-white p-4">
            <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              {s.label}
            </div>
            <div className="mt-2 font-display text-3xl text-hae-ink">{s.count}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-hae-line bg-white">
          <div className="flex items-center justify-between border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">Recent interactions</h2>
            <Link to="/interactions" className="text-xs font-semibold text-hae-crimson">
              View all
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">No interactions yet</p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {stats.recent.map((i) => (
                <li key={i.id} className="px-4 py-3">
                  <div className="text-sm font-medium">
                    {i.type} · {i.contactName || 'Contact'}
                  </div>
                  <div className="text-xs text-hae-slate">
                    {i.date || '—'}
                    {i.subject ? ` · ${i.subject}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-hae-line bg-white">
          <div className="flex items-center justify-between border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">Upcoming follow-ups</h2>
            <Link to="/contacts" className="text-xs font-semibold text-hae-crimson">
              View contacts
            </Link>
          </div>
          {stats.followUps.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">No upcoming follow-ups</p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {stats.followUps.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-hae-slate">
                    Due {c.followUpDate} · {c.stage || '—'} · {c.type || '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
