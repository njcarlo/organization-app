import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { courseEarningsCents, formatMoney } from '../money'

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
    const coursesById = {}
    for (const c of courses) coursesById[c.id] = c
    const earnings = courseEarningsCents(enrollments, coursesById)
    const upcomingSessions = sessions
      .filter((s) => s.date && s.date >= today)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 5)
    const upcomingCheckIns = checkIns
      .filter((c) => c.dueDate && c.dueDate >= today && c.status !== 'Completed')
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 5)

    const paymentBreakdown = { Paid: 0, Pending: 0, Overdue: 0, Waived: 0, Comp: 0 }
    for (const e of enrollments) {
      const status = e.paymentStatus || 'Pending'
      if (paymentBreakdown[status] != null) paymentBreakdown[status] += 1
    }

    const courseEarnings = courses
      .map((c) => {
        const mine = enrollments.filter((e) => e.courseId === c.id)
        const { paidCents, pendingCents } = courseEarningsCents(mine, {
          [c.id]: c,
        })
        return { ...c, paidCents, pendingCents, enrollmentCount: mine.length }
      })
      .filter((c) => c.priceCents || c.paidCents || c.pendingCents)
      .sort((a, b) => (b.paidCents || 0) - (a.paidCents || 0))

    const maxBar = Math.max(
      1,
      ...courseEarnings.map((c) => (c.paidCents || 0) + (c.pendingCents || 0))
    )
    const paidTotal = earnings.paidCents || 0

    return {
      academy,
      flagship,
      enrollmentCount: enrollments.length,
      rate,
      paidEarnings: earnings.paidCents,
      pendingEarnings: earnings.pendingCents,
      upcomingSessions,
      upcomingCheckIns,
      courseEarnings,
      maxBar,
      paidTotal,
      paymentBreakdown,
    }
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Academy courses', value: stats.academy },
          { label: 'Flagship courses', value: stats.flagship },
          { label: 'Enrollments', value: stats.enrollmentCount },
          { label: 'Completion rate', value: `${stats.rate}%` },
          { label: 'Paid earnings', value: formatMoney(stats.paidEarnings) },
        ].map((s) => (
          <div key={s.label} className="border border-hae-line bg-white p-4">
            <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              {s.label}
            </div>
            <div className="mt-2 font-display text-3xl text-hae-ink">{s.value}</div>
          </div>
        ))}
      </div>

      {stats.courseEarnings.length > 0 ? (
        <section className="border border-hae-line bg-white">
          <div className="border-b border-hae-line px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">Earnings & analytics</h2>
            <p className="mt-0.5 text-xs text-hae-slate">
              Course tuition × payment status ·{' '}
              <span className="font-medium text-hae-ink">
                {formatMoney(stats.paidEarnings)} paid
              </span>
              {stats.pendingEarnings ? (
                <>
                  {' '}
                  · {formatMoney(stats.pendingEarnings)} pending
                </>
              ) : null}
            </p>
          </div>

          <div className="grid gap-0 border-b border-hae-line lg:grid-cols-[1fr_220px]">
            <div className="space-y-3 px-4 py-5 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
                  Earnings by course
                </h3>
                <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-hae-slate">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-3 bg-hae-crimson" /> Paid
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-3 bg-hae-mist ring-1 ring-hae-line" />{' '}
                    Pending
                  </span>
                </div>
              </div>
              <ul className="space-y-3">
                {stats.courseEarnings.map((c) => {
                  const paidPct = Math.round(
                    ((c.paidCents || 0) / stats.maxBar) * 100
                  )
                  const pendingPct = Math.round(
                    ((c.pendingCents || 0) / stats.maxBar) * 100
                  )
                  return (
                    <li key={c.id}>
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                        <Link
                          to={`/courses/${c.id}`}
                          className="text-sm font-semibold text-hae-crimson hover:underline"
                        >
                          {c.name}
                        </Link>
                        <span className="font-display text-lg text-hae-ink">
                          {formatMoney(c.paidCents)}
                        </span>
                      </div>
                      <div className="flex h-3 overflow-hidden rounded-sm bg-hae-mist">
                        <div
                          className="h-full bg-hae-crimson transition-[width] duration-500"
                          style={{ width: `${paidPct}%` }}
                          title={`Paid ${formatMoney(c.paidCents)}`}
                        />
                        <div
                          className="h-full bg-[#c5c0b8] transition-[width] duration-500"
                          style={{ width: `${pendingPct}%` }}
                          title={`Pending ${formatMoney(c.pendingCents)}`}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="border-t border-hae-line px-4 py-5 sm:px-5 lg:border-t-0 lg:border-l">
              <h3 className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
                Payment status
              </h3>
              <ul className="mt-3 space-y-2">
                {Object.entries(stats.paymentBreakdown).map(([label, count]) => {
                  const total = stats.enrollmentCount || 1
                  const pct = Math.round((count / total) * 100)
                  return (
                    <li key={label}>
                      <div className="flex justify-between text-xs">
                        <span className="text-hae-slate">{label}</span>
                        <span className="font-semibold text-hae-ink">
                          {count}
                          <span className="ml-1 font-normal text-hae-slate">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-hae-mist">
                        <div
                          className={
                            label === 'Paid'
                              ? 'h-full bg-hae-crimson'
                              : label === 'Overdue'
                                ? 'h-full bg-[#8B1E1E]'
                                : 'h-full bg-[#c5c0b8]'
                          }
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-hae-line bg-hae-mist/40 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
                  <th className="px-4 py-3 sm:px-5">Course</th>
                  <th className="px-3 py-3">Path</th>
                  <th className="px-3 py-3 text-right">Enrolled</th>
                  <th className="px-3 py-3 text-right">Tuition</th>
                  <th className="px-3 py-3 text-right">Paid</th>
                  <th className="px-3 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right sm:px-5">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hae-line">
                {stats.courseEarnings.map((c) => {
                  const share =
                    stats.paidTotal > 0
                      ? Math.round(((c.paidCents || 0) / stats.paidTotal) * 100)
                      : 0
                  return (
                    <tr key={c.id} className="hover:bg-hae-mist/30">
                      <td className="px-4 py-3 sm:px-5">
                        <Link
                          to={`/courses/${c.id}`}
                          className="font-semibold text-hae-crimson hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 capitalize text-hae-slate">
                        {c.path || '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {c.enrollmentCount}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-hae-slate">
                        {c.priceCents != null
                          ? formatMoney(c.priceCents, c.currency)
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-hae-ink">
                        {formatMoney(c.paidCents)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-hae-slate">
                        {c.pendingCents
                          ? formatMoney(c.pendingCents)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5">
                        <div className="inline-flex min-w-[4.5rem] flex-col items-end gap-1">
                          <span className="text-xs font-semibold tabular-nums">
                            {share}%
                          </span>
                          <div className="h-1 w-16 overflow-hidden rounded-sm bg-hae-mist">
                            <div
                              className="h-full bg-hae-crimson"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-hae-line bg-hae-mist/40 text-sm font-semibold">
                  <td className="px-4 py-3 sm:px-5" colSpan={4}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatMoney(stats.paidEarnings)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-hae-slate">
                    {stats.pendingEarnings
                      ? formatMoney(stats.pendingEarnings)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right sm:px-5">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

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
