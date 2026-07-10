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
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import ProjectCard from '../components/ProjectCard'
import { sortByHealth } from '../utils'
import {
  METRIC_TYPES,
  formatMoney,
  parseDollarsToCents,
  rollupProjectMetrics,
} from '../utils/projectMetrics'

const emptyProject = {
  name: '',
  lead: '',
  promise: '',
  health: 'on-track',
  targetDate: '',
  metricType: '',
  goalDollars: '',
  raisedDollars: '',
  metricsNotes: '',
}

/**
 * Generic version of ProgramPage — same Projects/Tasks structure, but backed
 * by a different top-level Firestore collection (e.g. academyPrograms,
 * customPrograms) so it can power additional sidebar categories.
 */
export default function CategoryProgramPage({ collectionName, categoryLabel }) {
  const { itemId } = useParams()
  const [program, setProgram] = useState(null)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dense, setDense] = useState(false)
  const [newProject, setNewProject] = useState(emptyProject)

  const load = useCallback(async () => {
    setError('')
    try {
      const [programSnap, projectSnap, taskSnap] = await Promise.all([
        getDoc(doc(db, collectionName, itemId)),
        getDocs(collection(db, 'projects')),
        getDocs(collection(db, 'tasks')),
      ])

      if (!programSnap.exists()) {
        setProgram(null)
        setProjects([])
        setTasks([])
        return
      }

      const prog = { id: programSnap.id, ...programSnap.data() }
      const allProjects = projectSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const allTasks = taskSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      setProgram(prog)
      setProjects(
        allProjects.filter((p) => p.programId === itemId).sort(sortByHealth)
      )
      setTasks(allTasks.filter((t) => t.programId === itemId))
    } catch (err) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [collectionName, itemId])

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

  const close = () => {
    if (saving) return
    setOpen(false)
    setNewProject(emptyProject)
  }

  const createProject = async (e) => {
    e.preventDefault()
    if (!newProject.name.trim() || saving) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'projects'), {
        name: newProject.name.trim(),
        lead: newProject.lead.trim(),
        promise: newProject.promise.trim(),
        health: newProject.health,
        targetDate: newProject.targetDate || '',
        metricType: newProject.metricType || '',
        goalCents: newProject.metricType
          ? parseDollarsToCents(newProject.goalDollars)
          : null,
        raisedCents: newProject.metricType
          ? parseDollarsToCents(newProject.raisedDollars)
          : null,
        currency: 'usd',
        metricsNotes: newProject.metricType
          ? newProject.metricsNotes.trim()
          : '',
        lmsCourseId: '',
        programId: itemId,
        createdAt: serverTimestamp(),
      })
      setNewProject(emptyProject)
      setOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>
  if (error) return <p className="text-sm text-hae-red">{error}</p>
  if (!program)
    return <p className="text-sm text-hae-red">{categoryLabel} item not found.</p>

  const metricsRollup = rollupProjectMetrics(projects)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
            {categoryLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-hae-ink sm:text-3xl">
            {program.name}
          </h1>
          <p className="mt-1 text-sm text-hae-slate">
            Overall lead: {program.lead || '—'}
            {projects.length ? ` · ${projects.length} projects` : ''}
            {metricsRollup.count
              ? ` · ${formatMoney(metricsRollup.raisedCents)} / ${formatMoney(metricsRollup.goalCents)} across ${metricsRollup.count} metric project${metricsRollup.count === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDense((v) => !v)}
            className="hae-btn-secondary"
            title={dense ? 'Switch to compact list' : 'Show full table'}
          >
            {dense ? 'Compact list' : 'Dense table'}
          </button>
          <button type="button" className="hae-btn" onClick={() => setOpen(true)}>
            + Add Project
          </button>
        </div>
      </header>

      <Modal
        open={open}
        onClose={close}
        title="Create project"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="create-project-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Create project'}
            </button>
          </>
        }
      >
        <form id="create-project-form" onSubmit={createProject} className="grid gap-3 sm:grid-cols-2">
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Status</span>
            <select
              value={newProject.health}
              onChange={(e) => setNewProject({ ...newProject, health: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            >
              <option value="time-sensitive">Time Sensitive</option>
              <option value="not-started">Not Started</option>
              <option value="on-track">On Track</option>
              <option value="needs-attention">Needs Attention</option>
              <option value="at-risk">At Risk</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <input
            type="date"
            value={newProject.targetDate}
            onChange={(e) => setNewProject({ ...newProject, targetDate: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm"
          />
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium text-hae-slate">Metrics (optional)</span>
            <select
              value={newProject.metricType}
              onChange={(e) => setNewProject({ ...newProject, metricType: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            >
              {METRIC_TYPES.map((t) => (
                <option key={t.value || 'none'} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {newProject.metricType ? (
            <>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Goal ($)"
                value={newProject.goalDollars}
                onChange={(e) =>
                  setNewProject({ ...newProject, goalDollars: e.target.value })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Raised / spent ($)"
                value={newProject.raisedDollars}
                onChange={(e) =>
                  setNewProject({ ...newProject, raisedDollars: e.target.value })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              />
              <input
                placeholder="Metrics notes"
                value={newProject.metricsNotes}
                onChange={(e) =>
                  setNewProject({ ...newProject, metricsNotes: e.target.value })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm sm:col-span-2"
              />
            </>
          ) : null}
        </form>
      </Modal>

      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hae-line bg-white/60 px-4 py-10 text-center text-sm text-hae-slate">
            No projects yet. Add one to get started.
          </div>
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              program={program}
              tasks={tasksByProject[project.id] || []}
              onChanged={load}
              dense={dense}
            />
          ))
        )}
      </div>
    </div>
  )
}
