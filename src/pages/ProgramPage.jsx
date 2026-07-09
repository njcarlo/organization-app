import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import ProjectCard from '../components/ProjectCard'

export default function ProgramPage() {
  const { programId } = useParams()
  const [program, setProgram] = useState(null)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingProject, setAddingProject] = useState(false)
  const [newProject, setNewProject] = useState({
    name: '',
    lead: '',
    promise: '',
    health: 'on-track',
    targetDate: '',
  })

  const load = useCallback(async () => {
    const [programSnap, projectSnap, taskSnap] = await Promise.all([
      getDoc(doc(db, 'programs', programId)),
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'tasks')),
    ])

    if (!programSnap.exists()) {
      setProgram(null)
      setProjects([])
      setTasks([])
      setLoading(false)
      return
    }

    const prog = { id: programSnap.id, ...programSnap.data() }
    const allProjects = projectSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const allTasks = taskSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    setProgram(prog)
    setProjects(
      allProjects
        .filter((p) => p.programId === programId)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    )
    setTasks(allTasks.filter((t) => t.programId === programId))
    setLoading(false)
  }, [programId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const tasksByProject = useMemo(() => {
    const map = {}
    for (const t of tasks) {
      if (!map[t.projectId]) map[t.projectId] = []
      map[t.projectId].push(t)
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    }
    return map
  }, [tasks])

  const createProject = async (e) => {
    e.preventDefault()
    if (!newProject.name.trim()) return
    await addDoc(collection(db, 'projects'), {
      name: newProject.name.trim(),
      lead: newProject.lead.trim(),
      promise: newProject.promise.trim(),
      health: newProject.health,
      targetDate: newProject.targetDate || '',
      programId,
      createdAt: serverTimestamp(),
    })
    setNewProject({
      name: '',
      lead: '',
      promise: '',
      health: 'on-track',
      targetDate: '',
    })
    setAddingProject(false)
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading program…</p>
  if (!program) return <p className="text-sm text-hae-red">Program not found.</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-hae-crimson uppercase">
            Program
          </p>
          <h1 className="mt-1 font-display text-4xl text-hae-ink">{program.name}</h1>
          <p className="mt-1 text-sm text-hae-slate">
            Overall lead: {program.lead || '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddingProject((v) => !v)}
          className="rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold text-white hover:bg-hae-crimson-dark"
        >
          {addingProject ? 'Cancel' : '+ Add Project'}
        </button>
      </header>

      {addingProject && (
        <form
          onSubmit={createProject}
          className="grid gap-3 rounded-xl border border-hae-line bg-white p-4 sm:grid-cols-2"
        >
          <input
            required
            placeholder="Project name"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          />
          <input
            placeholder="Lead"
            value={newProject.lead}
            onChange={(e) => setNewProject({ ...newProject, lead: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          />
          <input
            placeholder="Promise / outcome"
            value={newProject.promise}
            onChange={(e) => setNewProject({ ...newProject, promise: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
          />
          <select
            value={newProject.health}
            onChange={(e) => setNewProject({ ...newProject, health: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm"
          >
            <option value="on-track">On Track</option>
            <option value="needs-attention">Needs Attention</option>
            <option value="at-risk">At Risk</option>
          </select>
          <input
            type="date"
            value={newProject.targetDate}
            onChange={(e) => setNewProject({ ...newProject, targetDate: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold text-white sm:col-span-2"
          >
            Create project
          </button>
        </form>
      )}

      <div className="space-y-4">
        {projects.length === 0 ? (
          <p className="text-sm text-hae-slate">No projects yet. Add one to get started.</p>
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              program={program}
              tasks={tasksByProject[project.id] || []}
              onChanged={load}
            />
          ))
        )}
      </div>
    </div>
  )
}
