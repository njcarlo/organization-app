import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import PrioritiesSection from '../components/PrioritiesSection'
import WaitingOnSection from '../components/WaitingOnSection'
import AttentionSection from '../components/AttentionSection'
import WinsSection from '../components/WinsSection'

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

  if (loading) {
    return <p className="text-sm text-hae-slate">Loading dashboard…</p>
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Harvard Alumni Entrepreneurs
        </p>
        <h1 className="mt-2 font-display text-4xl text-hae-ink md:text-5xl">
          Operating Dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Live view of priorities, blockers, attention items, and wins across all programs.
        </p>
      </header>

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
