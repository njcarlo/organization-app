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
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [projects]
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
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-hae-slate">
            Fundraising & project metrics
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metricProjects.map((p) => {
              const pct = pctTowardGoal(p.raisedCents, p.goalCents)
              const program = programsById[p.programId]
              const href = p.programId ? `/programs/${p.programId}` : '/'
              return (
                <Link
                  key={p.id}
                  to={href}
                  className="border border-hae-line bg-white p-4 transition-colors hover:border-hae-crimson"
                >
                  <div className="text-[10px] font-semibold tracking-wider text-hae-crimson uppercase">
                    {metricTypeLabel(p.metricType)}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-hae-ink">{p.name}</div>
                  <div className="mt-1 text-xs text-hae-slate">
                    {program?.name || 'Program'}
                    {p.lead ? ` · ${p.lead}` : ''}
                  </div>
                  <div className="mt-3 font-display text-2xl text-hae-ink">
                    {formatMoney(p.raisedCents, p.currency)}
                    {p.goalCents ? (
                      <span className="text-base text-hae-slate">
                        {' '}
                        / {formatMoney(p.goalCents, p.currency)}
                      </span>
                    ) : null}
                  </div>
                  {pct != null ? (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded bg-hae-mist">
                        <div
                          className="h-full bg-hae-crimson"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-hae-slate">
                        {pct}% of goal
                      </div>
                    </div>
                  ) : null}
                </Link>
              )
            })}
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
