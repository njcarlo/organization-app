import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { LEADERSHIP_ATTENTION, TASK_STATUSES } from '../constants'
import {
  effectivePriority,
  formatDate,
  priorityBadgeClass,
  programNameOf,
  projectNameOf,
  sortByPriorityThenDue,
} from '../utils'

const PAGE_SIZE = 10
const STATUS_FILTERS = [
  'Active',
  'All',
  'Not Started',
  'In Progress',
  'Waiting',
  'Review',
  'Complete',
]

const inputClass =
  'w-full rounded border border-hae-line bg-white px-2 py-1 text-sm outline-none focus:border-hae-crimson'

export default function MyTasks() {
  const { userProfile, isAdmin } = useAuth()
  const [tasks, setTasks] = useState([])
  const [programs, setPrograms] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewAll, setViewAll] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Active')
  const [page, setPage] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [taskSnap, programSnap, projectSnap] = await Promise.all([
      getDocs(collection(db, 'tasks')),
      getDocs(collection(db, 'programs')),
      getDocs(collection(db, 'projects')),
    ])
    setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setPrograms(programSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

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

  const filtered = useMemo(() => {
    let list = [...tasks]
    if (!(isAdmin && viewAll)) {
      const myName = (userProfile?.name || '').toLowerCase()
      list = list.filter((t) => (t.owner || '').toLowerCase() === myName)
    }
    if (statusFilter === 'Active') {
      list = list.filter((t) => t.status !== 'Complete')
    } else if (statusFilter !== 'All') {
      list = list.filter((t) => t.status === statusFilter)
    }
    list.sort(sortByPriorityThenDue)
    return list
  }, [tasks, isAdmin, viewAll, userProfile, statusFilter])

  useEffect(() => {
    setPage(0)
  }, [statusFilter, viewAll])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  )

  const startEdit = (task) => {
    setEditingId(task.id)
    setDraft({
      name: task.name || '',
      owner: task.owner || '',
      dueDate: task.dueDate || '',
      status: task.status || 'Not Started',
      priority: task.priority || '',
      waitingOn: task.waitingOn || '',
      leadershipAttention: task.leadershipAttention || 'None',
      nextAction: task.nextAction || '',
    })
  }

  const saveEdit = async () => {
    if (!draft?.name.trim() || saving) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'tasks', editingId), {
        name: draft.name.trim(),
        owner: draft.owner.trim(),
        dueDate: draft.dueDate || '',
        status: draft.status,
        priority: draft.priority,
        waitingOn: draft.waitingOn.trim(),
        leadershipAttention: draft.leadershipAttention,
        nextAction: draft.nextAction.trim(),
      })
      setEditingId(null)
      setDraft(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const removeTask = async (id) => {
    if (!confirm('Delete this task?')) return
    await deleteDoc(doc(db, 'tasks', id))
    await load()
  }

  const onEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    }
    if (e.key === 'Escape') {
      setEditingId(null)
      setDraft(null)
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading tasks…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
            {isAdmin && viewAll ? 'All Tasks' : 'My Tasks'}
          </h1>
          <p className="mt-1 text-sm text-hae-slate">
            {filtered.length} task{filtered.length === 1 ? '' : 's'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex rounded-md border border-hae-line bg-white p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewAll(false)}
              className={`rounded px-3 py-1.5 ${!viewAll ? 'bg-hae-crimson text-white' : 'text-hae-slate'}`}
            >
              My Tasks
            </button>
            <button
              type="button"
              onClick={() => setViewAll(true)}
              className={`rounded px-3 py-1.5 ${viewAll ? 'bg-hae-crimson text-white' : 'text-hae-slate'}`}
            >
              All Tasks
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              statusFilter === f
                ? 'bg-hae-ink text-white'
                : 'bg-white text-hae-slate border border-hae-line'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-hae-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Priority</th>
                <th className="px-3 py-2 font-semibold">Task</th>
                {isAdmin && viewAll && (
                  <th className="px-3 py-2 font-semibold">Owner</th>
                )}
                <th className="px-3 py-2 font-semibold">Program</th>
                <th className="px-3 py-2 font-semibold">Project</th>
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Waiting On</th>
                <th className="px-3 py-2 font-semibold">Leadership</th>
                <th className="px-3 py-2 font-semibold">Next Action</th>
                <th className="px-3 py-2 font-semibold w-20" />
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin && viewAll ? 11 : 10}
                    className="px-3 py-8 text-center text-sm text-hae-slate"
                  >
                    No tasks match this filter
                  </td>
                </tr>
              ) : (
                pageItems.map((task) =>
                  editingId === task.id && draft ? (
                    <tr key={task.id} className="bg-amber-50">
                      <td className="px-2 py-1">
                        <select
                          className={inputClass}
                          value={draft.priority}
                          onChange={(e) =>
                            setDraft({ ...draft, priority: e.target.value })
                          }
                        >
                          <option value="">Auto</option>
                          <option value="HIGH">HIGH</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="LOW">LOW</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          autoFocus
                          className={inputClass}
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          onKeyDown={onEditKeyDown}
                        />
                      </td>
                      {isAdmin && viewAll && (
                        <td className="px-2 py-1">
                          <input
                            className={inputClass}
                            value={draft.owner}
                            onChange={(e) =>
                              setDraft({ ...draft, owner: e.target.value })
                            }
                            onKeyDown={onEditKeyDown}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 text-sm text-hae-slate">
                        {programNameOf(task, programsById)}
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-slate">
                        {projectNameOf(task, projectsById)}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="date"
                          className={inputClass}
                          value={draft.dueDate}
                          onChange={(e) =>
                            setDraft({ ...draft, dueDate: e.target.value })
                          }
                          onKeyDown={onEditKeyDown}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={inputClass}
                          value={draft.status}
                          onChange={(e) =>
                            setDraft({ ...draft, status: e.target.value })
                          }
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={draft.waitingOn}
                          onChange={(e) =>
                            setDraft({ ...draft, waitingOn: e.target.value })
                          }
                          onKeyDown={onEditKeyDown}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={inputClass}
                          value={draft.leadershipAttention}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              leadershipAttention: e.target.value,
                            })
                          }
                        >
                          {LEADERSHIP_ATTENTION.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={draft.nextAction}
                          onChange={(e) =>
                            setDraft({ ...draft, nextAction: e.target.value })
                          }
                          onKeyDown={onEditKeyDown}
                        />
                      </td>
                      <td className="px-2 py-1 text-right text-xs">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="font-semibold text-hae-crimson"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={task.id} className="group border-b border-hae-line/70">
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityBadgeClass(effectivePriority(task))}`}
                        >
                          {effectivePriority(task)}
                          {task.priority ? (
                            <span className="text-[9px] opacity-70">M</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm font-medium">{task.name}</td>
                      {isAdmin && viewAll && (
                        <td className="px-3 py-2 text-sm text-hae-slate">
                          {task.owner || '—'}
                        </td>
                      )}
                      <td className="px-3 py-2 text-sm text-hae-slate">
                        {programNameOf(task, programsById)}
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-slate">
                        {projectNameOf(task, projectsById)}
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-slate">
                        {formatDate(task.dueDate)}
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-slate">{task.status}</td>
                      <td className="px-3 py-2 text-sm text-hae-slate">
                        {task.waitingOn || '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-slate">
                        {task.leadershipAttention || 'None'}
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-slate">
                        {task.nextAction || '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => startEdit(task)}
                            className="text-xs text-hae-slate hover:text-hae-crimson"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTask(task.id)}
                            className="text-xs text-hae-slate hover:text-hae-red"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="flex h-auto min-h-12 flex-col gap-2 border-t border-hae-line px-4 py-3 text-xs text-hae-slate sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:py-0">
          <span>
            Page {safePage + 1} of {totalPages}
          </span>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={`min-w-7 rounded px-2 py-1 ${
                  i === safePage
                    ? 'bg-hae-crimson text-white'
                    : 'hover:bg-hae-mist'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
