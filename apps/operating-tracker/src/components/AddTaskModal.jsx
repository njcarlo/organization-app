import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import LeadSelect from './LeadSelect'
import {
  HEALTH_OPTIONS,
  LEADERSHIP_ATTENTION,
  PROJECT_DESTINATION_GROUPS,
  TASK_STATUSES,
} from '../constants'

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

const emptyProjectForm = {
  name: '',
  lead: [],
  promise: '',
  health: 'ongoing',
  targetDate: '',
  notes: '',
}

const emptyTaskForm = {
  name: '',
  dueDate: '',
  status: 'Not Started',
  priority: '',
  waitingOn: '',
  leadershipAttention: 'None',
  nextAction: '',
  notes: '',
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * Lets a user add a task from My Tasks without navigating to a project page.
 * They pick the category / sub category / project it belongs to (creating a
 * new project inline if needed), fill in the same fields TaskTable's "+ Add
 * Task" uses, and the task is auto-assigned to them.
 */
export default function AddTaskModal({ open, onClose, onCreated }) {
  const { userProfile, user } = useAuth()
  const [groups, setGroups] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [groupKey, setGroupKey] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectMode, setProjectMode] = useState('existing')
  const [projectId, setProjectId] = useState('')
  const [newProject, setNewProject] = useState(emptyProjectForm)
  const [taskForm, setTaskForm] = useState(emptyTaskForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const ownerName = userProfile?.name || user?.email || ''

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingGroups(true)
    setError('')
    setGroupKey('')
    setSubCategoryId('')
    setProjects([])
    setProjectMode('existing')
    setProjectId('')
    setNewProject(emptyProjectForm)
    setTaskForm(emptyTaskForm)

    const loadGroups = async () => {
      const staticGroups = await Promise.all(
        PROJECT_DESTINATION_GROUPS.map(async (g) => {
          const snap = await getDocs(collection(db, g.collectionName))
          const items = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          return { key: g.collectionName, label: g.label, items }
        })
      )

      const [sectionsSnap, sectionItemsSnap] = await Promise.all([
        getDocs(collection(db, 'customSections')),
        getDocs(collection(db, 'customSectionItems')),
      ])
      const sectionItems = sectionItemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const customGroups = sectionsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((section) => ({
          key: `customSectionItems:${section.id}`,
          label: section.label,
          items: sectionItems
            .filter((it) => it.sectionId === section.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        }))

      if (cancelled) return
      setGroups([...staticGroups, ...customGroups])
      setLoadingGroups(false)
    }

    loadGroups().catch((err) => {
      if (!cancelled) {
        setError(err.message || 'Failed to load categories')
        setLoadingGroups(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [open])

  const selectedGroup = useMemo(
    () => groups.find((g) => g.key === groupKey) || null,
    [groups, groupKey]
  )

  const selectedSubCategory = useMemo(
    () => selectedGroup?.items.find((it) => it.id === subCategoryId) || null,
    [selectedGroup, subCategoryId]
  )

  useEffect(() => {
    if (!subCategoryId) {
      setProjects([])
      setProjectId('')
      setProjectMode('existing')
      return
    }
    let cancelled = false
    setLoadingProjects(true)
    setProjectId('')
    getDocs(query(collection(db, 'projects'), where('programId', '==', subCategoryId)))
      .then((snap) => {
        if (cancelled) return
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        setProjects(list)
        setProjectMode(list.length ? 'existing' : 'new')
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load projects')
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false)
      })
    return () => {
      cancelled = true
    }
  }, [subCategoryId])

  const close = () => {
    if (saving) return
    onClose?.()
  }

  const canSubmit =
    Boolean(groupKey) &&
    Boolean(subCategoryId) &&
    Boolean(taskForm.name.trim()) &&
    (projectMode === 'existing' ? Boolean(projectId) : Boolean(newProject.name.trim()))

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || saving || !selectedSubCategory) return
    setSaving(true)
    setError('')
    try {
      let finalProjectId = projectId
      let finalProjectName = projects.find((p) => p.id === projectId)?.name || ''

      if (projectMode === 'new') {
        const maxOrder = projects.reduce((m, p) => Math.max(m, p.order ?? 0), -1)
        const projectRef = await addDoc(collection(db, 'projects'), {
          name: newProject.name.trim(),
          lead: newProject.lead,
          promise: newProject.promise.trim(),
          health: newProject.health,
          targetDate: newProject.targetDate || '',
          notes: newProject.notes.trim(),
          programId: subCategoryId,
          order: maxOrder + 1,
          createdAt: serverTimestamp(),
        })
        finalProjectId = projectRef.id
        finalProjectName = newProject.name.trim()
      }

      await addDoc(collection(db, 'tasks'), {
        name: taskForm.name.trim(),
        owner: ownerName ? [ownerName] : [],
        dueDate: taskForm.dueDate || '',
        status: taskForm.status,
        priority: taskForm.priority,
        waitingOn: taskForm.waitingOn.trim(),
        leadershipAttention: taskForm.leadershipAttention,
        nextAction: taskForm.nextAction.trim(),
        notes: taskForm.notes.trim(),
        projectId: finalProjectId,
        projectName: finalProjectName,
        programId: subCategoryId,
        programName: selectedSubCategory.name,
        createdAt: serverTimestamp(),
      })

      onCreated?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Failed to add task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add task"
      busy={saving}
      size="xl"
      footer={
        <>
          <button type="button" className="hae-btn-secondary" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="add-task-form"
            className="hae-btn disabled:opacity-60"
            disabled={!canSubmit || saving || loadingGroups}
          >
            {saving ? 'Adding…' : 'Add task'}
          </button>
        </>
      }
    >
      {loadingGroups ? (
        <p className="text-sm text-hae-slate">Loading categories…</p>
      ) : (
        <form id="add-task-form" onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-hae-red">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <select
                required
                value={groupKey}
                onChange={(e) => {
                  setGroupKey(e.target.value)
                  setSubCategoryId('')
                }}
                className={fieldClass}
              >
                <option value="">Select a category</option>
                {groups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sub category">
              <select
                required
                value={subCategoryId}
                onChange={(e) => setSubCategoryId(e.target.value)}
                disabled={!selectedGroup}
                className={`${fieldClass} disabled:opacity-50`}
              >
                <option value="">
                  {selectedGroup ? 'Select an item' : 'Choose a category first'}
                </option>
                {selectedGroup?.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
              {selectedGroup && selectedGroup.items.length === 0 ? (
                <span className="mt-1 block text-xs text-hae-slate">
                  Nothing in this category yet.
                </span>
              ) : null}
            </Field>
          </div>

          {subCategoryId ? (
            <div className="rounded-lg border border-hae-line/80 bg-hae-mist/30 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
                  Project
                </span>
                <div className="flex gap-3 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="project-mode"
                      checked={projectMode === 'existing'}
                      disabled={!projects.length}
                      onChange={() => setProjectMode('existing')}
                    />
                    Choose existing
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="project-mode"
                      checked={projectMode === 'new'}
                      onChange={() => setProjectMode('new')}
                    />
                    Add new project
                  </label>
                </div>
              </div>

              {loadingProjects ? (
                <p className="text-sm text-hae-slate">Loading projects…</p>
              ) : projectMode === 'existing' ? (
                <select
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select a project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    required
                    placeholder="Project name"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className={`${fieldClass} sm:col-span-2`}
                  />
                  <LeadSelect
                    placeholder="Lead"
                    className={fieldClass}
                    value={newProject.lead}
                    onChange={(lead) => setNewProject({ ...newProject, lead })}
                  />
                  <select
                    value={newProject.health}
                    onChange={(e) => setNewProject({ ...newProject, health: e.target.value })}
                    className={fieldClass}
                  >
                    {HEALTH_OPTIONS.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Promise / outcome"
                    value={newProject.promise}
                    onChange={(e) => setNewProject({ ...newProject, promise: e.target.value })}
                    className={`${fieldClass} sm:col-span-2`}
                  />
                  <input
                    type="date"
                    value={newProject.targetDate}
                    onChange={(e) => setNewProject({ ...newProject, targetDate: e.target.value })}
                    className={fieldClass}
                  />
                  <textarea
                    placeholder="Notes"
                    rows={2}
                    value={newProject.notes}
                    onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                    className={`${fieldClass} sm:col-span-2`}
                  />
                </div>
              )}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Task" className="sm:col-span-2">
              <input
                required
                placeholder="Task name"
                value={taskForm.name}
                onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Assigned to">
              <input disabled value={ownerName || 'You'} className={`${fieldClass} opacity-70`} />
            </Field>
            <Field label="Priority">
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                className={fieldClass}
              >
                <option value="">Auto</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={taskForm.status}
                onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                className={fieldClass}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due">
              <input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Waiting on">
              <input
                value={taskForm.waitingOn}
                onChange={(e) => setTaskForm({ ...taskForm, waitingOn: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Leadership">
              <select
                value={taskForm.leadershipAttention}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, leadershipAttention: e.target.value })
                }
                className={fieldClass}
              >
                {LEADERSHIP_ATTENTION.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Next action" className="sm:col-span-2">
              <input
                value={taskForm.nextAction}
                onChange={(e) => setTaskForm({ ...taskForm, nextAction: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea
                rows={3}
                value={taskForm.notes}
                onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                className={fieldClass}
              />
            </Field>
          </div>
        </form>
      )}
    </Modal>
  )
}
