import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '@hae/ui'
import { db } from '../firebase'

/** Member-facing AMS home — upcoming events + own membership records. */
export default function MemberHome() {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [memberships, setMemberships] = useState([])
  const [loading, setLoading] = useState(true)
  const email = (userProfile?.email || '').trim().toLowerCase()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const eventSnap = await getDocs(collection(db, 'events'))
      let membershipList = []
      if (email) {
        const mSnap = await getDocs(
          query(collection(db, 'memberships'), where('memberEmail', '==', email))
        )
        membershipList = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      }
      if (cancelled) return
      setEvents(eventSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setMemberships(membershipList)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [email])

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return events
      .filter((ev) => !ev.date || ev.date >= today)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 8)
  }, [events])

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Member · AMS
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl">
          My membership
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Welcome{userProfile?.name ? `, ${userProfile.name}` : ''}. View your
          membership status and upcoming HAE events.
        </p>
      </header>

      <section className="border border-hae-line bg-white">
        <div className="border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold">Memberships</h2>
        </div>
        {memberships.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">
            No membership records linked to {email || 'your account'} yet.
          </p>
        ) : (
          <ul className="divide-y divide-hae-line">
            {memberships.map((m) => (
              <li key={m.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{m.tier || m.type || 'Membership'}</div>
                <div className="text-xs text-hae-slate">
                  {m.status || '—'}
                  {m.endDate ? ` · ends ${m.endDate}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-hae-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold">Upcoming events</h2>
          <Link to="/events" className="text-xs font-semibold text-hae-crimson">
            View all
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">No upcoming events.</p>
        ) : (
          <ul className="divide-y divide-hae-line">
            {upcoming.map((ev) => (
              <li key={ev.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{ev.name || ev.title}</div>
                <div className="text-xs text-hae-slate">
                  {ev.date || 'Date TBD'}
                  {ev.location ? ` · ${ev.location}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
