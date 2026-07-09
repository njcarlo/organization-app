import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import {
  ACTIVE_STATUSES,
  COMPLETED_STATUSES,
  buildNudgeMailto,
  enrollmentRisk,
  todayIso,
} from '../learningInsights'

export default function Tracking() {
  const [enrollments, setEnrollments] = useState([])
  const [checkIns, setCheckIns] = useState([])
  const [certificates, setCertificates] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [pathFilter, setPathFilter] = useState('all')
  const [segment, setSegment] = useState('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [e, k, c, coursesSnap] = await Promise.all([
        getDocs(collection(db, 'enrollments')),
        getDocs(collection(db, 'checkIns')),
        getDocs(collection(db, 'certificates')),
        getDocs(collection(db, 'courses')),
      ])
      if (cancelled) return
      setEnrollments(e.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCheckIns(k.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCertificates(c.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCourses(coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const today = todayIso()

  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      if (pathFilter !== 'all' && (e.path || 'academy') !== pathFilter) return false
      return true
    })
  }, [enrollments, pathFilter])

  const insights = useMemo(() => {
    const active = filteredEnrollments.filter((e) =>
      ACTIVE_STATUSES.includes(e.status)
    )
    const completed = filteredEnrollments.filter((e) =>
      COMPLETED_STATUSES.includes(e.status)
    )
    const withRisk = filteredEnrollments
      .map((e) => ({
        ...e,
        risk: enrollmentRisk(e, checkIns, today),
      }))
      .filter((e) => e.risk.atRisk)

    const overdueCheckIns = checkIns.filter(
      (c) => c.dueDate && c.dueDate < today && c.status !== 'Completed'
    )
    const dueSoon = checkIns.filter(
      (c) =>
        c.dueDate &&
        c.dueDate >= today &&
        c.dueDate <=
          new Date(new Date(`${today}T00:00:00`).getTime() + 7 * 86400000)
            .toISOString()
            .slice(0, 10) &&
        c.status !== 'Completed'
    )

    const byCourse = {}
    for (const e of filteredEnrollments) {
      const key = e.courseId || e.courseName || 'unknown'
      if (!byCourse[key]) {
        byCourse[key] = {
          courseId: e.courseId,
          courseName: e.courseName || 'Course',
          path: e.path,
          total: 0,
          completed: 0,
          atRisk: 0,
          progressSum: 0,
        }
      }
      byCourse[key].total += 1
      byCourse[key].progressSum += Number(e.progress) || 0
      if (COMPLETED_STATUSES.includes(e.status)) byCourse[key].completed += 1
      if (enrollmentRisk(e, checkIns, today).atRisk) byCourse[key].atRisk += 1
    }

    const courseRows = Object.values(byCourse)
      .map((r) => ({
        ...r,
        avgProgress: r.total ? Math.round(r.progressSum / r.total) : 0,
        completionRate: r.total
          ? Math.round((r.completed / r.total) * 100)
          : 0,
      }))
      .sort((a, b) => b.atRisk - a.atRisk || a.completionRate - b.completionRate)

    const eligibleMissingCert = filteredEnrollments.filter((e) => {
      if (e.status !== 'Certificate Eligible' && e.status !== 'Completed') {
        return false
      }
      return !certificates.some(
        (c) =>
          c.enrollmentId === e.id ||
          (c.learnerEmail === e.learnerEmail && c.courseId === e.courseId)
      )
    })

    return {
      active: active.length,
      completed: completed.length,
      atRisk: withRisk.length,
      overdueCheckIns: overdueCheckIns.length,
      dueSoon: dueSoon.length,
      riskRows: withRisk.sort(
        (a, b) => (a.progress || 0) - (b.progress || 0)
      ),
      courseRows,
      overdueList: overdueCheckIns
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
        .slice(0, 20),
      dueSoonList: dueSoon
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
        .slice(0, 20),
      eligibleMissingCert,
    }
  }, [filteredEnrollments, checkIns, certificates, today])

  const visibleRisk = useMemo(() => {
    if (segment === 'overdue') {
      return insights.riskRows.filter((r) => r.risk.overdueCount > 0)
    }
    if (segment === 'not-started') {
      return insights.riskRows.filter(
        (r) => (r.progress || 0) === 0 && r.status === 'Enrolled'
      )
    }
    return insights.riskRows
  }, [insights.riskRows, segment])

  if (loading) return <p className="text-sm text-hae-slate">Loading tracking…</p>

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Staff · Tracking
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl">
          Learning tracking
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Real-time view of progress gaps, overdue check-ins, and certificate
          follow-ups. Use nudges to email learners from your inbox.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All paths' },
          { id: 'academy', label: 'Academy' },
          { id: 'flagship', label: 'Flagship' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setPathFilter(f.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              pathFilter === f.id
                ? 'bg-hae-ink text-white'
                : 'border border-hae-line bg-white text-hae-slate'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Active learners', value: insights.active },
          { label: 'Completed', value: insights.completed },
          { label: 'At risk', value: insights.atRisk },
          { label: 'Overdue check-ins', value: insights.overdueCheckIns },
          { label: 'Due in 7 days', value: insights.dueSoon },
        ].map((s) => (
          <div key={s.label} className="border border-hae-line bg-white p-4">
            <div className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              {s.label}
            </div>
            <div className="mt-2 font-display text-3xl text-hae-ink">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="border border-hae-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold">Learners needing attention</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All gaps' },
              { id: 'not-started', label: 'Not started' },
              { id: 'overdue', label: 'Overdue check-ins' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegment(s.id)}
                className={`rounded px-2 py-1 text-[11px] font-semibold ${
                  segment === s.id
                    ? 'bg-hae-crimson/10 text-hae-crimson'
                    : 'text-hae-slate hover:bg-hae-mist'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {visibleRisk.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">
            No learners match this filter. Nice work.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Learner</th>
                  <th className="px-3 py-2 font-semibold">Course</th>
                  <th className="px-3 py-2 font-semibold">Progress</th>
                  <th className="px-3 py-2 font-semibold">Why</th>
                  <th className="px-3 py-2 font-semibold w-28" />
                </tr>
              </thead>
              <tbody>
                {visibleRisk.map((row) => (
                  <tr key={row.id} className="border-b border-hae-line/70">
                    <td className="px-3 py-2 text-sm">
                      <div className="font-medium text-hae-ink">
                        {row.learnerName || '—'}
                      </div>
                      <div className="text-xs text-hae-slate">
                        {row.learnerEmail || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-hae-slate">
                      {row.courseName || '—'}
                      <div className="text-xs">
                        {row.path === 'flagship' ? 'Flagship' : 'Academy'} ·{' '}
                        {row.status}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-hae-slate">
                      {row.progress ?? 0}%
                    </td>
                    <td className="px-3 py-2 text-xs text-hae-slate">
                      {row.risk.reasons.join(' · ')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.learnerEmail ? (
                        <a
                          href={buildNudgeMailto({
                            learnerEmail: row.learnerEmail,
                            learnerName: row.learnerName,
                            courseName: row.courseName,
                            reasons: row.risk.reasons,
                          })}
                          className="text-xs font-semibold text-hae-crimson"
                        >
                          Nudge
                        </a>
                      ) : (
                        <span className="text-xs text-hae-slate">No email</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-hae-line bg-white">
          <div className="border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">By course</h2>
          </div>
          {insights.courseRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">No enrollment data.</p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {insights.courseRows.map((c) => (
                <li
                  key={c.courseId || c.courseName}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-hae-ink">
                      {c.courseName}
                    </div>
                    <div className="text-xs text-hae-slate">
                      {c.total} enrolled · {c.completionRate}% complete · avg{' '}
                      {c.avgProgress}% · {c.atRisk} at risk
                    </div>
                  </div>
                  {c.courseId ? (
                    <Link
                      to={`/courses/${c.courseId}`}
                      className="text-xs font-semibold text-hae-crimson"
                    >
                      Open
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-hae-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">Certificate follow-ups</h2>
            <Link
              to="/certificates"
              className="text-xs font-semibold text-hae-crimson"
            >
              Issue certificates
            </Link>
          </div>
          {insights.eligibleMissingCert.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">
              No completed learners missing a certificate record.
            </p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {insights.eligibleMissingCert.slice(0, 12).map((e) => (
                <li key={e.id} className="px-4 py-3 text-sm">
                  <div className="font-medium text-hae-ink">
                    {e.learnerName} · {e.courseName}
                  </div>
                  <div className="text-xs text-hae-slate">
                    {e.status} · {e.learnerEmail || 'no email'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-hae-line bg-white">
          <div className="border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">Overdue check-ins</h2>
          </div>
          {insights.overdueList.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">None overdue.</p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {insights.overdueList.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      {c.type} · {c.learnerName || 'Learner'}
                    </div>
                    <div className="text-xs text-hae-slate">
                      Due {c.dueDate} · {c.courseName || '—'}
                    </div>
                  </div>
                  {c.learnerEmail ? (
                    <a
                      href={buildNudgeMailto({
                        learnerEmail: c.learnerEmail,
                        learnerName: c.learnerName,
                        courseName: c.courseName,
                        reasons: [`Overdue ${c.type} check-in`],
                      })}
                      className="text-xs font-semibold text-hae-crimson"
                    >
                      Nudge
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-hae-line bg-white">
          <div className="border-b border-hae-line px-4 py-3">
            <h2 className="text-sm font-semibold">Check-ins due soon</h2>
          </div>
          {insights.dueSoonList.length === 0 ? (
            <p className="px-4 py-6 text-sm text-hae-slate">None in the next 7 days.</p>
          ) : (
            <ul className="divide-y divide-hae-line">
              {insights.dueSoonList.map((c) => (
                <li key={c.id} className="px-4 py-3 text-sm">
                  <div className="font-medium">
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

      <p className="text-xs text-hae-slate">
        {courses.length} courses in catalog · tracking is computed live from
        enrollments, check-ins, and certificates (no separate industry pack).
      </p>
    </div>
  )
}
