import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { MEMBER_STATUSES } from '../constants'

export default function Dashboard() {
  const [members, setMembers] = useState([])
  const [memberships, setMemberships] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [m, ms, e] = await Promise.all([
        getDocs(collection(db, 'members')),
        getDocs(collection(db, 'memberships')),
        getDocs(collection(db, 'events')),
      ])
      if (cancelled) return
      setMembers(m.docs.map((d) => ({ id: d.id, ...d.data() })))
      setMemberships(ms.docs.map((d) => ({ id: d.id, ...d.data() })))
      setEvents(e.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const month = today.slice(0, 7)
    const active = members.filter((m) => m.status === 'active').length
    const renewalsDue = memberships.filter(
      (m) => m.renewalDate && m.renewalDate >= today && m.paymentStatus !== 'Paid'
    ).length
    const newThisMonth = members.filter(
      (m) => (m.joinDate || '').startsWith(month)
    ).length
    const upcomingEvents = events
      .filter((e) => e.date && e.date >= today)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 5)
    return { active, renewalsDue, newThisMonth, upcomingEvents }
  }, [members, memberships, events])

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Milestone 4 · AMS
        </p>
        <h1 className="mt-2 font-display text-4xl text-hae-ink md:text-5xl">
          Membership Dashboard
        </h1>
        <p className="mt-3 text-sm text-hae-slate">
          Active members, renewals due, new joins, and upcoming events.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Active members', value: stats.active, to: '/members' },
          { label: 'Renewals due', value: stats.renewalsDue, to: '/memberships' },
          { label: 'New this month', value: stats.newThisMonth, to: '/members' },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="border border-hae-line bg-white p-4 hover:border-hae-crimson">
            <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              {s.label}
            </div>
            <div className="mt-2 font-display text-3xl text-hae-ink">{s.value}</div>
          </Link>
        ))}
      </div>

      <section className="border border-hae-line bg-white">
        <div className="flex items-center justify-between border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold">Upcoming events</h2>
          <Link to="/events" className="text-xs font-semibold text-hae-crimson">
            View all
          </Link>
        </div>
        {stats.upcomingEvents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">No upcoming events</p>
        ) : (
          <ul className="divide-y divide-hae-line">
            {stats.upcomingEvents.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{e.name}</div>
                  <div className="text-xs text-hae-slate">{e.location || '—'}</div>
                </div>
                <div className="text-sm text-hae-slate">{e.date}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2 text-xs text-hae-slate">
        {MEMBER_STATUSES.map((s) => (
          <span key={s.value} className="border border-hae-line bg-white px-2 py-1">
            {s.label}: {members.filter((m) => m.status === s.value).length}
          </span>
        ))}
      </div>
    </div>
  )
}
