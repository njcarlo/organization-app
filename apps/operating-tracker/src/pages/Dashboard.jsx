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
import RestrictedHome from './RestrictedHome'

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

// The "Startup World Cup 2026" custom section (see
// scripts/promote-startup-world-cup-category.mjs) is surfaced here as its own
// dashboard category, visible to everyone regardless of sectionAccess, since
// its Firestore doc id isn't known until the migration runs.
const SWC_SECTION_LABEL = 'Startup World Cup 2026'
const SWC_CATEGORY_ID = 'startup-world-cup'

export const DASHBOARD_LINKS = [
  {
    id: 'programs',
    label: 'Programs',
    icon: 'folder',
    sectionId: 'programs',
  },
  {
    id: 'academy',
    label: 'Academy',
    icon: 'book',
    sectionId: 'academy',
  },
  {
    id: 'custom-programs',
    label: 'Custom Programs',
    icon: 'star',
    sectionId: 'custom-programs',
  },
  {
    id: 'social-media',
    label: 'Social Media',
    icon: 'calendar',
    to: '/content-calendar',
    sectionId: 'content',
  },
  {
    id: 'traffic-report',
    label: 'Traffic Report',
    icon: 'chart',
    to: '/events-dashboard',
    sectionId: 'events',
  },
]

export default function Dashboard() {
  const { userProfile, sectionAccess } = useAuth()
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [programs, setPrograms] = useState([])
  const [swcSection, setSwcSection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(null)

  const visibleLinks = useMemo(() => {
    const base = sectionAccess
      ? DASHBOARD_LINKS.filter((d) => sectionAccess.includes(d.sectionId))
      : DASHBOARD_LINKS
    if (!swcSection || base.some((d) => d.id === SWC_CATEGORY_ID)) return base
    return [
      ...base,
      { id: SWC_CATEGORY_ID, label: swcSection.label, icon: 'certificate', sectionId: swcSection.id },
    ]
  }, [sectionAccess, swcSection])

  const visibleCategories = useMemo(() => {
    const base = sectionAccess ? CATEGORIES.filter((c) => sectionAccess.includes(c.id)) : CATEGORIES
    if (!swcSection || base.some((c) => c.id === SWC_CATEGORY_ID)) return base
    return [
      ...base,
      {
        id: SWC_CATEGORY_ID,
        label: swcSection.label,
        collectionName: 'customSectionItems',
        pathPrefix: `/custom-sections/${swcSection.id}`,
      },
    ]
  }, [sectionAccess, swcSection])

  const loadData = useCallback(async () => {
    const [taskSnap, projectSnap, sectionSnap, itemSnap, ...categorySnaps] = await Promise.all([
      getDocs(collection(db, 'tasks')),
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'customSections')),
      getDocs(collection(db, 'customSectionItems')),
      ...CATEGORIES.map((c) => getDocs(collection(db, c.collectionName))),
    ])
    setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })))

    const swcDoc = sectionSnap.docs.find((d) => d.data().label === SWC_SECTION_LABEL)
    setSwcSection(swcDoc ? { id: swcDoc.id, label: swcDoc.data().label } : null)
    const swcItems = swcDoc
      ? itemSnap.docs
          .filter((d) => d.data().sectionId === swcDoc.id)
          .map((d) => ({
            id: d.id,
            ...d.data(),
            category: SWC_CATEGORY_ID,
            pathPrefix: `/custom-sections/${swcDoc.id}`,
          }))
      : []

    setPrograms([
      ...categorySnaps.flatMap((snap, i) =>
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          category: CATEGORIES[i].id,
          pathPrefix: CATEGORIES[i].pathPrefix,
        }))
      ),
      ...swcItems,
    ])
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

  if (sectionAccess && visibleLinks.length === 0) {
    return <RestrictedHome />
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
          {visibleLinks.map((d) => {
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
        {visibleCategories.map((c) => (
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
