import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { NavIcon, timeOfDayGreeting } from '@hae/ui'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase'
import PrioritiesSection from '../components/PrioritiesSection'
import WaitingOnSection from '../components/WaitingOnSection'
import AttentionSection from '../components/AttentionSection'
import WinsSection from '../components/WinsSection'

const CATEGORIES = [
  { id: 'programs', label: 'Programs', collectionName: 'programs', pathPrefix: '/programs' },
  { id: 'academy', label: 'Academy', collectionName: 'academyPrograms', pathPrefix: '/academy' },
  {
    id: 'custom-programs',
    label: 'Custom Programs',
    collectionName: 'customPrograms',
    pathPrefix: '/custom-programs',
  },
]

const DASHBOARD_LINKS = [
  {
    id: 'programs',
    label: 'Programs',
    icon: 'folder',
  },
  {
    id: 'academy',
    label: 'Academy',
    icon: 'book',
  },
  {
    id: 'custom-programs',
    label: 'Custom Programs',
    icon: 'star',
  },
  {
    id: 'social-media',
    label: 'Social Media',
    icon: 'calendar',
    to: '/content-calendar',
  },
  {
    id: 'traffic-report',
    label: 'Traffic Report',
    icon: 'chart',
    to: '/events-dashboard',
  },
]

export default function Dashboard() {
  const { userProfile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(null)

  const loadData = useCallback(async () => {
    const [taskSnap, projectSnap, ...categorySnaps] = await Promise.all([
      getDocs(collection(db, 'tasks')),
      getDocs(collection(db, 'projects')),
      ...CATEGORIES.map((c) => getDocs(collection(db, c.collectionName))),
    ])
    setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setPrograms(
      categorySnaps.flatMap((snap, i) =>
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          category: CATEGORIES[i].id,
          pathPrefix: CATEGORIES[i].pathPrefix,
        }))
      )
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const programsById = useMemo(() => {
    const map = {}
    for (const p of programs) map[p.id] = p
    return map
  }, [programs])

  const categoryProgramIds = useMemo(
    () =>
      new Set(
        programs.filter((p) => p.category === category).map((p) => p.id)
      ),
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

  const header = (
    <header className="border-b border-hae-line pb-6">
      {userProfile?.name && (
        <p className="font-display text-xl text-hae-ink">
          {timeOfDayGreeting()}, {userProfile.name}
        </p>
      )}
      <p className="mt-2 text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
        Harvard Alumni Entrepreneurs
      </p>
      <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
        HAE Dashboard
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-hae-slate">
        Choose a dashboard to view.
      </p>
    </header>
  )

  if (!category) {
    return (
      <div className="space-y-8">
        {header}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DASHBOARD_LINKS.map((d) => {
            const content = (
              <>
                <NavIcon
                  name={d.icon}
                  className="[&>svg]:h-6 [&>svg]:w-6 text-hae-crimson"
                />
                <p className="mt-3 font-display text-lg text-hae-ink">{d.label}</p>
              </>
            )
            const className =
              'block rounded-lg border border-hae-line p-5 transition hover:border-hae-crimson hover:shadow-sm'
            return d.to ? (
              <Link key={d.id} to={d.to} className={className}>
                {content}
              </Link>
            ) : (
              <button
                key={d.id}
                type="button"
                onClick={() => setCategory(d.id)}
                className={`${className} text-left`}
              >
                {content}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {header}

      <div className="flex flex-wrap items-center gap-2 border-b border-hae-line">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className="mr-2 border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-hae-slate hover:text-hae-ink"
        >
          ← All dashboards
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${
              category === c.id
                ? 'border-hae-crimson text-hae-crimson'
                : 'border-transparent text-hae-slate'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <PrioritiesSection
        tasks={categoryTasks}
        programsById={programsById}
        projectsById={projectsById}
        onDataChanged={loadData}
      />
      <WaitingOnSection
        tasks={categoryTasks}
        programsById={programsById}
        projectsById={projectsById}
        onDataChanged={loadData}
      />
      <AttentionSection
        tasks={categoryTasks}
        projects={categoryProjects}
        programsById={programsById}
        projectsById={projectsById}
        onDataChanged={loadData}
      />
      <WinsSection
        tasks={categoryTasks}
        programsById={programsById}
        projectsById={projectsById}
        onDataChanged={loadData}
      />
    </div>
  )
}
