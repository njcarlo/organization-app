import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export default function Dashboard() {
  const [courses, setCourses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [sessions, setSessions] = useState([])
  const [checkIns, setCheckIns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [c, e, s, k] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'enrollments')),
        getDocs(collection(db, 'sessions')),
        getDocs(collection(db, 'checkIns')),
      ])
      if (cancelled) return
      setCourses(c.docs.map((d) => ({ id: d.id, ...d.data() })))
      setEnrollments(e.docs.map((d) => ({ id: d.id, ...d.data() })))
      setSessions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCheckIns(k.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const academy = courses.filter((c) => c.path === 'academy').length
    const flagship = courses.filter((c) => c.path === 'flagship').length
    const completed = enrollments.filter((e) =>
      ['Completed', 'Certificate Eligible'].includes(e.status)
    ).length
    const rate =
      enrollments.length === 0
        ? 0
        : Math.round((completed / enrollments.length) * 100)
    const upcomingSessions = sessions
      .filter((s) => s.date && s.date >= today)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 5)
    const upcomingCheckIns = checkIns
      .filter((c) => c.dueDate && c.dueDate >= today && c.status !== 'Completed')
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 5)
    return { academy, flagship, enrollmentCount: enrollments.length, rate, upcomingSessions, upcomingCheckIns }
  }, [courses, enrollments, sessions, checkIns])

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Staff · HAE Academy
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
          Learning Dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Staff overview of Academy Fast Track and Flagship courses, enrollments,
          office hours, and check-ins. For gaps and nudges, open{' '}
          <Link to="/tracking" className="font-semibold text-hae-crimson">
            Tracking
          </Link>
          . For templates, open{' '}
          <Link to="/authoring" className="font-semibold text-hae-crimson">
            Authoring
          </Link>
          .
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Academy courses', value: stats.academy },
          { label: 'Flagship courses', value: stats.flagship },
          { label: 'Enrollments', value: stats.enrollmentCount },
          { label: 'Completion rate', value: `${stats.rate}%` },
        ].map((s) => (
          <div key={s.label} className="border border-hae-line bg-white p-4">
            <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              {s.label}
            </div>
            <div className="mt-2 font-display text-3xl text-hae-ink">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-hae-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">Upcoming office hours</h2>
            <Link to="/sessions" className="text-xs font-semibold text-hae-crimson">
              View all
            </Link>
          </div>
          {stats.upcomingSessions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">No upcoming sessions</p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {stats.upcomingSessions.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="text-sm font-medium">{s.title || 'Office Hours'}</div>
                  <div className="text-xs text-hae-slate">
                    {s.date} · {s.courseName || '—'} · {s.zoomLink ? 'Zoom' : s.location || 'TBD'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-hae-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">Upcoming check-ins</h2>
            <Link to="/check-ins" className="text-xs font-semibold text-hae-crimson">
              View all
            </Link>
          </div>
          {stats.upcomingCheckIns.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">No upcoming check-ins</p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {stats.upcomingCheckIns.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="text-sm font-medium">
                    {c.type} · {c.learnerName || 'Learner'}
                  </div>
                  <div className="text-xs text-hae-slate">
                    Due {c.dueDate} · {c.courseName || '—'}
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
