import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import ProjectCard from '../components/ProjectCard'
import LeadSelect from '../components/LeadSelect'
import DraggableList from '../components/DraggableList'
import SelectionToolbar from '../components/SelectionToolbar'
import MoveCopyProjectModal from '../components/MoveCopyProjectModal'
import { HEALTH_OPTIONS } from '../constants'
import { namesLabel, normalizeHealth, sortByOrder } from '../utils'
import { logHistory } from '../utils/activityLog'

const emptyProject = {
  name: '',
  lead: [],
  promise: '',
  health: 'ongoing',
  targetDate: '',
  notes: '',
}

export default function ProgramPage() {
  const { programId } = useParams()
  const { user, userProfile } = useAuth()
  const [program, setProgram] = useState(null)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dense, setDense] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [newProject, setNewProject] = useState(emptyProject)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [moveModal, setMoveModal] = useState(null)

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
      allProjects.filter((p) => p.programId === programId).sort(sortByOrder)
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
      const maxOrder = projects.reduce((m, p) => Math.max(m, p.order ?? 0), -1)
      await addDoc(collection(db, 'projects'), {
        name: newProject.name.trim(),
        lead: newProject.lead,
        promise: newProject.promise.trim(),
        health: newProject.health,
        targetDate: newProject.targetDate || '',
        notes: newProject.notes.trim(),
        programId,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setNewProject(emptyProject)
      setOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const reorderProjects = async (reorderedItems) => {
    const batch = writeBatch(db)
    reorderedItems.forEach((p, i) => {
      if (p.order !== i) batch.update(doc(db, 'projects', p.id), { order: i })
    })
    await batch.commit()
    load()
  }

  const toggleSelect = (projectId, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(projectId)
      else next.delete(projectId)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const openMoveModal = (initialAction) => {
    setMoveModal({
      initialAction,
      projects: projects.filter((p) => selectedIds.has(p.id)),
    })
  }

  const closeMoveModal = () => setMoveModal(null)

  const handleMoveDone = () => {
    clearSelection()
    load()
  }

  const deleteSelected = async () => {
    const selected = projects.filter((p) => selectedIds.has(p.id))
    if (!selected.length) return
    const label =
      selected.length === 1 ? `project "${selected[0].name}"` : `${selected.length} projects`
    if (!confirm(`Delete ${label}? Tasks are not cascade-deleted. This action cannot be undone.`)) {
      return
    }
    await Promise.all(
      selected.map(async (p) => {
        await deleteDoc(doc(db, 'projects', p.id))
        logHistory({
          parentType: 'projects',
          parentId: p.id,
          parentName: p.name,
          programId: p.programId,
          action: 'deleted',
          snapshot: p,
          byId: user?.uid,
          byName: userProfile?.name || user?.email || 'Someone',
        })
      })
    )
    clearSelection()
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading program…</p>
  if (!program) return <p className="text-sm text-hae-red">Program not found.</p>

  const activeProjects = projects.filter((p) => normalizeHealth(p.health) !== 'completed')
  const completedProjects = projects.filter((p) => normalizeHealth(p.health) === 'completed')
  const visibleProjects = showCompleted ? projects : activeProjects

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
            Program
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-hae-ink sm:text-3xl">
            {program.name}
          </h1>
          <p className="mt-1 text-sm text-hae-slate">
            Overall lead: {namesLabel(program.lead) || '—'}
            {projects.length ? ` · ${projects.length} projects` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {completedProjects.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="hae-btn-secondary"
            >
              {showCompleted
                ? 'Hide completed'
                : `Show ${completedProjects.length} completed`}
            </button>
          ) : null}
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
          <LeadSelect
            placeholder="Lead"
            value={newProject.lead}
            onChange={(lead) => setNewProject({ ...newProject, lead })}
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
              {HEALTH_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>
          <input
            type="date"
            value={newProject.targetDate}
            onChange={(e) => setNewProject({ ...newProject, targetDate: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Notes"
            rows={3}
            value={newProject.notes}
            onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
          />
        </form>
      </Modal>

      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hae-line bg-white/60 px-4 py-10 text-center text-sm text-hae-slate">
            No projects yet. Add one to get started.
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hae-line bg-white/60 px-4 py-10 text-center text-sm text-hae-slate">
            All projects are complete — show completed above if needed.
          </div>
        ) : (
          <DraggableList
            items={visibleProjects}
            onReorder={reorderProjects}
            renderCheckbox={(project) => (
              <input
                type="checkbox"
                checked={selectedIds.has(project.id)}
                onChange={(e) => toggleSelect(project.id, e.target.checked)}
                aria-label={`Select ${project.name}`}
                className="h-4 w-4 shrink-0 rounded border-hae-line text-hae-crimson focus:ring-hae-crimson"
              />
            )}
            renderItem={(project) => (
              <ProjectCard
                project={project}
                program={program}
                programPath={`/programs/${programId}`}
                tasks={tasksByProject[project.id] || []}
                onChanged={load}
                dense={dense}
              />
            )}
          />
        )}
      </div>

      <SelectionToolbar
        count={selectedIds.size}
        onCopy={() => openMoveModal('copy')}
        onMoveTo={() => openMoveModal('move')}
        onDelete={deleteSelected}
        onClear={clearSelection}
      />

      <MoveCopyProjectModal
        open={!!moveModal}
        onClose={closeMoveModal}
        projects={moveModal?.projects}
        initialAction={moveModal?.initialAction}
        program={program}
        onDone={handleMoveDone}
      />
    </div>
  )
}
