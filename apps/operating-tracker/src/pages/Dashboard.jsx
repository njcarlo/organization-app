import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import PrioritiesSection from '../components/PrioritiesSection'
import WaitingOnSection from '../components/WaitingOnSection'
import AttentionSection from '../components/AttentionSection'
import WinsSection from '../components/WinsSection'

const CATEGORIES = [
  { id: 'programs', label: 'Programs', collectionName: 'programs' },
  { id: 'academy', label: 'Academy', collectionName: 'academyPrograms' },
  { id: 'custom-programs', label: 'Custom Programs', collectionName: 'customPrograms' },
]

export default function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(CATEGORIES[0].id)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [taskSnap, projectSnap, ...categorySnaps] = await Promise.all([
        getDocs(collection(db, 'tasks')),
        getDocs(collection(db, 'projects')),
        ...CATEGORIES.map((c) => getDocs(collection(db, c.collectionName))),
      ])
      if (cancelled) return
      setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setPrograms(
        categorySnaps.flatMap((snap, i) =>
          snap.docs.map((d) => ({ id: d.id, ...d.data(), category: CATEGORIES[i].id }))
        )
      )
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

  const categoryProgramIds = useMemo(
    () => new Set(programs.filter((p) => p.category === category).map((p) => p.id)),
    [programs, category]
  )

  const categoryTasks = useMemo(
    () => tasks.filter((t) => categoryProgramIds.has(t.programId)),
    [tasks, categoryProgramIds]
  )

  const categoryProjects = useMemo(
    () => projects.filter((p) => categoryProgramIds.has(p.programId)),
    [projects, categoryProgramIds]
  )

  const projectsById = useMemo(() => {
    const map = {}
    for (const p of categoryProjects) map[p.id] = p
    return map
  }, [categoryProjects])

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

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={
              category === c.id
                ? 'rounded-full bg-hae-crimson px-4 py-1.5 text-xs font-semibold text-white'
                : 'rounded-full border border-hae-line px-4 py-1.5 text-xs font-semibold text-hae-slate hover:bg-hae-mist'
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <PrioritiesSection
        tasks={categoryTasks}
        programsById={programsById}
        projectsById={projectsById}
      />
      <WaitingOnSection
        tasks={categoryTasks}
        programsById={programsById}
        projectsById={projectsById}
      />
      <AttentionSection
        tasks={categoryTasks}
        projects={categoryProjects}
        programsById={programsById}
        projectsById={projectsById}
      />
      <WinsSection tasks={categoryTasks} projectsById={projectsById} />
    </div>
  )
}
