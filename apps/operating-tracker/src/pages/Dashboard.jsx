import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import PrioritiesSection from '../components/PrioritiesSection'
import WaitingOnSection from '../components/WaitingOnSection'
import AttentionSection from '../components/AttentionSection'
import WinsSection from '../components/WinsSection'
import {
  formatMoney,
  metricTypeLabel,
  pctTowardGoal,
  rollupProjectMetrics,
} from '../utils/projectMetrics'

export default function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [taskSnap, projectSnap, programSnap] = await Promise.all([
        getDocs(collection(db, 'tasks')),
        getDocs(collection(db, 'projects')),
        getDocs(collection(db, 'programs')),
      ])
      if (cancelled) return
      setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setPrograms(programSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const programsById = useMemo(() => {
    const map = {}
    for (const p of programs) map[p.id] = p
    return map
  }, [programs])

  const projectsById = useMemo(() => {
    const map = {}
    for (const p of projects) map[p.id] = p
    return map
  }, [projects])

  const metricProjects = useMemo(
    () =>
      projects
        .filter((p) => p.metricType)
        .sort(
          (a, b) => (Number(b.raisedCents) || 0) - (Number(a.raisedCents) || 0)
        ),
    [projects]
  )

  const metricsRollup = useMemo(
    () => rollupProjectMetrics(metricProjects),
    [metricProjects]
  )

  const maxBar = useMemo(
    () =>
      Math.max(
        1,
        ...metricProjects.map((p) =>
          Math.max(Number(p.raisedCents) || 0, Number(p.goalCents) || 0)
        )
      ),
    [metricProjects]
  )

  if (loading) {
    return <p className="text-sm text-hae-slate">Loading dashboard…</p>
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Harvard Alumni Entrepreneurs
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
          Operating Dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Live view of priorities, blockers, attention items, and wins across all programs.
        </p>
      </header>

      {metricProjects.length > 0 ? (
        <section className="border border-hae-line bg-white">
          <div className="border-b border-hae-line px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">Fundraising & analytics</h2>
            <p className="mt-0.5 text-xs text-hae-slate">
              {metricsRollup.count} project
              {metricsRollup.count === 1 ? '' : 's'} with metrics ·{' '}
              <span className="font-medium text-hae-ink">
                {formatMoney(metricsRollup.raisedCents)} raised
              </span>
              {metricsRollup.goalCents ? (
                <>
                  {' '}
                  of {formatMoney(metricsRollup.goalCents)}
                  {metricsRollup.pct != null ? ` (${metricsRollup.pct}%)` : ''}
                </>
              ) : null}
            </p>
          </div>

          <div className="space-y-3 border-b border-hae-line px-4 py-5 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
                Progress by project
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-hae-slate">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 bg-hae-crimson" /> Raised
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 bg-hae-mist ring-1 ring-hae-line" />{' '}
                  Goal
                </span>
              </div>
            </div>
            <ul className="space-y-3">
              {metricProjects.map((p) => {
                const raised = Number(p.raisedCents) || 0
                const goal = Number(p.goalCents) || 0
                const raisedPct = Math.round((raised / maxBar) * 100)
                const goalPct = goal ? Math.round((goal / maxBar) * 100) : 0
                const pct = pctTowardGoal(raised, goal)
                const href = p.programId ? `/programs/${p.programId}` : '/'
                return (
                  <li key={p.id}>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <Link
                          to={href}
                          className="text-sm font-semibold text-hae-crimson hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="text-[11px] text-hae-slate">
                          {metricTypeLabel(p.metricType)}
                          {programsById[p.programId]?.name
                            ? ` · ${programsById[p.programId].name}`
                            : ''}
                        </div>
                      </div>
                      <span className="font-display text-lg text-hae-ink">
                        {formatMoney(raised, p.currency)}
                        {goal ? (
                          <span className="text-sm text-hae-slate">
                            {' '}
                            / {formatMoney(goal, p.currency)}
                          </span>
                        ) : null}
                        {pct != null ? (
                          <span className="ml-2 text-xs font-semibold text-hae-slate">
                            {pct}%
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="relative h-3 overflow-hidden rounded-sm bg-hae-mist">
                      {goalPct > 0 ? (
                        <div
                          className="absolute inset-y-0 left-0 bg-[#d9d4cc]"
                          style={{ width: `${goalPct}%` }}
                        />
                      ) : null}
                      <div
                        className="absolute inset-y-0 left-0 bg-hae-crimson transition-[width] duration-500"
                        style={{ width: `${raisedPct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-hae-line bg-hae-mist/40 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
                  <th className="px-4 py-3 sm:px-5">Project</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Program</th>
                  <th className="px-3 py-3 text-right">Raised</th>
                  <th className="px-3 py-3 text-right">Goal</th>
                  <th className="px-4 py-3 text-right sm:px-5">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hae-line">
                {metricProjects.map((p) => {
                  const pct = pctTowardGoal(p.raisedCents, p.goalCents)
                  const href = p.programId ? `/programs/${p.programId}` : '/'
                  return (
                    <tr key={p.id} className="hover:bg-hae-mist/30">
                      <td className="px-4 py-3 sm:px-5">
                        <Link
                          to={href}
                          className="font-semibold text-hae-crimson hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.lead ? (
                          <div className="text-[11px] text-hae-slate">{p.lead}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-hae-slate">
                        {metricTypeLabel(p.metricType)}
                      </td>
                      <td className="px-3 py-3 text-hae-slate">
                        {programsById[p.programId]?.name || '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatMoney(p.raisedCents, p.currency)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-hae-slate">
                        {p.goalCents
                          ? formatMoney(p.goalCents, p.currency)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5">
                        {pct != null ? (
                          <div className="inline-flex min-w-[4.5rem] flex-col items-end gap-1">
                            <span className="text-xs font-semibold tabular-nums">
                              {pct}%
                            </span>
                            <div className="h-1 w-16 overflow-hidden rounded-sm bg-hae-mist">
                              <div
                                className="h-full bg-hae-crimson"
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-hae-slate">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-hae-line bg-hae-mist/40 text-sm font-semibold">
                  <td className="px-4 py-3 sm:px-5" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatMoney(metricsRollup.raisedCents)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-hae-slate">
                    {metricsRollup.goalCents
                      ? formatMoney(metricsRollup.goalCents)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right sm:px-5">
                    {metricsRollup.pct != null ? `${metricsRollup.pct}%` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      <PrioritiesSection
        tasks={tasks}
        programsById={programsById}
        projectsById={projectsById}
      />
      <WaitingOnSection
        tasks={tasks}
        programsById={programsById}
        projectsById={projectsById}
      />
      <AttentionSection
        tasks={tasks}
        projects={projects}
        programsById={programsById}
        projectsById={projectsById}
      />
      <WinsSection tasks={tasks} projectsById={projectsById} />
    </div>
  )
}
