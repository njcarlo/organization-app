import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { useAuth } from '@hae/ui'
import { db } from '../firebase'
import { matchesLearner } from '../utils/learner'

export default function StudentHome() {
  const { userProfile } = useAuth()
  const [enrollments, setEnrollments] = useState([])
  const [sessions, setSessions] = useState([])
  const [checkIns, setCheckIns] = useState([])
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [e, s, k, c] = await Promise.all([
        getDocs(collection(db, 'enrollments')),
        getDocs(collection(db, 'sessions')),
        getDocs(collection(db, 'checkIns')),
        getDocs(collection(db, 'certificates')),
      ])
      if (cancelled) return
      setEnrollments(e.docs.map((d) => ({ id: d.id, ...d.data() })))
      setSessions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCheckIns(k.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCertificates(c.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mine = useMemo(() => {
    const myEnrollments = enrollments.filter((e) =>
      matchesLearner(e, userProfile)
    )
    const courseIds = new Set(myEnrollments.map((e) => e.courseId).filter(Boolean))
    const today = new Date().toISOString().slice(0, 10)
    const upcomingSessions = sessions
      .filter((s) => courseIds.has(s.courseId) && s.date && s.date >= today)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 5)
    const upcomingCheckIns = checkIns
      .filter(
        (c) =>
          matchesLearner(c, userProfile) &&
          c.dueDate &&
          c.dueDate >= today &&
          c.status !== 'Completed'
      )
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 5)
    const myCerts = certificates.filter((c) => matchesLearner(c, userProfile))
    const inProgress = myEnrollments.filter((e) =>
      ['Enrolled', 'In Progress'].includes(e.status)
    ).length
    return {
      myEnrollments,
      upcomingSessions,
      upcomingCheckIns,
      myCerts,
      inProgress,
    }
  }, [enrollments, sessions, checkIns, certificates, userProfile])

  if (loading) return <p className="text-sm text-hae-slate">Loading your learning…</p>

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Student · HAE Academy
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
          My learning
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Welcome{userProfile?.name ? `, ${userProfile.name}` : ''}. Track your
          courses, upcoming office hours, check-ins, and certificates.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'My courses', value: mine.myEnrollments.length },
          { label: 'In progress', value: mine.inProgress },
          { label: 'Certificates', value: mine.myCerts.length },
        ].map((s) => (
          <div key={s.label} className="border border-hae-line bg-white p-4">
            <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              {s.label}
            </div>
            <div className="mt-2 font-display text-3xl text-hae-ink">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/catalog"
          className="bg-hae-crimson px-3 py-2 text-xs font-semibold tracking-wide text-white uppercase"
        >
          Browse catalog
        </Link>
        <Link
          to="/my-certificates"
          className="border border-hae-line px-3 py-2 text-xs font-semibold tracking-wide text-hae-ink uppercase"
        >
          My certificates
        </Link>
      </div>

      <section className="border border-hae-line bg-white">
        <div className="border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold">Your courses</h2>
        </div>
        {mine.myEnrollments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">
            You are not enrolled in any courses yet. Browse the catalog, or ask
            staff to enroll you.
          </p>
        ) : (
          <ul className="divide-y divide-hae-line">
            {mine.myEnrollments.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <Link
                    to={`/courses/${e.courseId}`}
                    className="text-sm font-semibold text-hae-crimson hover:underline"
                  >
                    {e.courseName || 'Course'}
                  </Link>
                  <div className="text-xs text-hae-slate">
                    {e.path === 'flagship' ? 'Flagship' : 'Academy'} · {e.status}
                    {typeof e.progress === 'number' ? ` · ${e.progress}%` : ''}
                  </div>
                </div>
                <Link
                  to={`/courses/${e.courseId}`}
                  className="text-xs font-semibold text-hae-ink"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-hae-line bg-white">
          <div className="border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">Upcoming office hours</h2>
          </div>
          {mine.upcomingSessions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">No upcoming sessions.</p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {mine.upcomingSessions.map((s) => (
                <li key={s.id} className="px-4 py-3 text-sm">
                  <div className="font-medium text-hae-ink">{s.title}</div>
                  <div className="text-xs text-hae-slate">
                    {s.courseName} · {s.date}
                    {s.time ? ` · ${s.time}` : ''}
                  </div>
                  {s.zoomLink ? (
                    <a
                      href={s.zoomLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-hae-crimson"
                    >
                      Join link
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-hae-line bg-white">
          <div className="border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">Upcoming check-ins</h2>
          </div>
          {mine.upcomingCheckIns.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">No upcoming check-ins.</p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {mine.upcomingCheckIns.map((c) => (
                <li key={c.id} className="px-4 py-3 text-sm">
                  <div className="font-medium text-hae-ink">{c.type} check-in</div>
                  <div className="text-xs text-hae-slate">
                    {c.courseName} · due {c.dueDate}
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
