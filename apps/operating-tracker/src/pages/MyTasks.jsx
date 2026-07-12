import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { downloadIcs, FEATURES, Modal, useFeatures } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import LeadSelect from '../components/LeadSelect'
import { LEADERSHIP_ATTENTION, TASK_STATUSES } from '../constants'
import {
  effectivePriority,
  formatDate,
  isWaitingOn,
  namesLabel,
  normalizeTaskStatus,
  priorityBadgeClass,
  programNameOf,
  projectNameOf,
  sortByPriorityThenDue,
  statusBadgeClass,
  toNameList,
  WAITING_ON_BADGE_CLASS,
} from '../utils'

const PAGE_SIZE = 10
const STATUS_FILTERS = ['Active', 'All', ...TASK_STATUSES]

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

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

export default function MyTasks() {
  const { userProfile, isStaff } = useAuth()
  const { isEnabled } = useFeatures()
  const canExportCalendar = isEnabled(FEATURES.CALENDAR_EXPORT)
  const [tasks, setTasks] = useState([])
  const [programs, setPrograms] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewAll, setViewAll] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Active')
  const [page, setPage] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [editSurface, setEditSurface] = useState(null) // 'inline' | 'popup'
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
    if (!(isStaff && viewAll)) {
      const myName = (userProfile?.name || '').toLowerCase()
      list = list.filter((t) =>
        toNameList(t.owner).some((n) => n.toLowerCase() === myName)
      )
    }
    if (statusFilter === 'Active') {
      list = list.filter((t) => normalizeTaskStatus(t.status) !== 'Complete')
    } else if (statusFilter !== 'All') {
      list = list.filter((t) => normalizeTaskStatus(t.status) === statusFilter)
    }
    list.sort(sortByPriorityThenDue)
    return list
  }, [tasks, isStaff, viewAll, userProfile, statusFilter])

  useEffect(() => {
    setPage(0)
  }, [statusFilter, viewAll])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  )

  const colCount = isStaff && viewAll ? 11 : 10

  const startEdit = (task, surface = 'inline') => {
    setEditingId(task.id)
    setEditSurface(surface)
    setDraft({
      name: task.name || '',
      owner: toNameList(task.owner),
      dueDate: task.dueDate || '',
      status: normalizeTaskStatus(task.status || 'Not Started'),
      priority: task.priority || '',
      waitingOn: task.waitingOn || '',
      leadershipAttention: task.leadershipAttention || 'None',
      nextAction: task.nextAction || '',
      notes: task.notes || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditSurface(null)
    setDraft(null)
  }

  const saveEdit = async () => {
    if (!draft?.name.trim() || saving) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'tasks', editingId), {
        name: draft.name.trim(),
        owner: draft.owner,
        dueDate: draft.dueDate || '',
        status: draft.status,
        priority: draft.priority,
        waitingOn: draft.waitingOn.trim(),
        leadershipAttention: draft.leadershipAttention,
        nextAction: draft.nextAction.trim(),
        notes: draft.notes.trim(),
      })
      cancelEdit()
      await load()
    } finally {
      setSaving(false)
    }
  }

  const removeTask = async (id) => {
    if (!confirm('Delete this task?')) return
    await deleteDoc(doc(db, 'tasks', id))
    if (editingId === id) cancelEdit()
    await load()
  }

  const onEditKeyDown = (e) => {
    if (e.key === 'Escape') cancelEdit()
  }

  const exportIcs = () => {
    const dated = filtered.filter((t) => t.dueDate)
    if (!dated.length) return
    downloadIcs(
      isStaff && viewAll ? 'hae-all-tasks.ics' : 'hae-my-tasks.ics',
      dated.map((t) => ({
        uid: `task-${t.id}@hae-operating-tracker`,
        title: t.title || 'Task',
        date: t.dueDate,
        description: [
          t.status ? `Status: ${t.status}` : '',
          namesLabel(t.owner) ? `Owner: ${namesLabel(t.owner)}` : '',
          t.nextAction ? `Next: ${t.nextAction}` : '',
          programNameOf(t, programsById)
            ? `Program: ${programNameOf(t, programsById)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      })),
      { calName: isStaff && viewAll ? 'HAE All Tasks' : 'HAE My Tasks' }
    )
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading tasks…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
            {isStaff && viewAll ? 'All Tasks' : 'My Tasks'}
          </h1>
          <p className="mt-1 text-sm text-hae-slate">
            {filtered.length} task{filtered.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExportCalendar ? (
            <button
              type="button"
              onClick={exportIcs}
              disabled={!filtered.some((t) => t.dueDate)}
              className="rounded-md border border-hae-line px-3 py-2 text-xs font-semibold text-hae-ink hover:bg-hae-mist disabled:opacity-50"
            >
              Export calendar (.ics)
            </button>
          ) : null}
          {isStaff && (
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
        </div>
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

      {/* Mobile: card stack — tap opens edit popup */}
      <div className="hae-mobile-only hae-mobile-cards">
        {pageItems.length === 0 ? (
          <div className="hae-mobile-card text-center text-sm text-hae-slate">
            No tasks match this filter
          </div>
        ) : (
          pageItems.map((task) => (
            <button
              key={task.id}
              type="button"
              className="hae-mobile-card"
              onClick={() => startEdit(task, 'popup')}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="hae-mobile-card__title min-w-0 flex-1">{task.name}</div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityBadgeClass(effectivePriority(task))}`}
                >
                  {effectivePriority(task)}
                </span>
              </div>
              <div className="hae-mobile-card__meta">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(task.status)}`}
                >
                  {task.status ? normalizeTaskStatus(task.status) : '—'}
                </span>
                {isWaitingOn(task) ? (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${WAITING_ON_BADGE_CLASS}`}
                  >
                    Waiting On
                  </span>
                ) : null}
                <span>Due {formatDate(task.dueDate)}</span>
                {isStaff && viewAll ? (
                  <span>{namesLabel(task.owner) || 'Unassigned'}</span>
                ) : null}
                <span className="line-clamp-1">
                  {programNameOf(task, programsById)}
                  {projectNameOf(task, projectsById)
                    ? ` · ${projectNameOf(task, projectsById)}`
                    : ''}
                </span>
                {task.nextAction ? (
                  <span className="line-clamp-2 w-full text-hae-ink/75">
                    Next: {task.nextAction}
                  </span>
                ) : null}
                {task.notes ? (
                  <span className="line-clamp-2 w-full text-hae-ink/75">
                    Notes: {task.notes}
                  </span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>

      <Modal
        open={editSurface === 'popup' && Boolean(editingId && draft)}
        onClose={cancelEdit}
        title="Edit task"
        busy={saving}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="mr-auto text-xs text-hae-slate hover:text-hae-red"
              disabled={saving}
              onClick={() => editingId && removeTask(editingId)}
            >
              Delete
            </button>
            <button
              type="button"
              className="hae-btn-secondary"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="hae-btn disabled:opacity-60"
              disabled={saving}
              onClick={saveEdit}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {draft ? (
          <div className="grid gap-3 sm:grid-cols-2" onKeyDown={onEditKeyDown}>
            <Field label="Task" className="sm:col-span-2">
              <input
                autoFocus
                className={fieldClass}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Owner">
              <LeadSelect
                className={fieldClass}
                value={draft.owner}
                onChange={(owner) => setDraft({ ...draft, owner })}
              />
            </Field>
            <Field label="Priority">
              <select
                className={fieldClass}
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
              >
                <option value="">Auto</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                className={fieldClass}
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
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
                className={fieldClass}
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              />
            </Field>
            <Field label="Waiting on">
              <input
                className={fieldClass}
                value={draft.waitingOn}
                onChange={(e) => setDraft({ ...draft, waitingOn: e.target.value })}
              />
            </Field>
            <Field label="Leadership">
              <select
                className={fieldClass}
                value={draft.leadershipAttention}
                onChange={(e) =>
                  setDraft({ ...draft, leadershipAttention: e.target.value })
                }
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
                className={fieldClass}
                value={draft.nextAction}
                onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })}
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea
                className={fieldClass}
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
          </div>
        ) : null}
      </Modal>

      {/* Desktop: scrollable table with sticky first columns */}
      <div className="hae-desktop-only overflow-hidden rounded-xl border border-hae-line bg-white">
        <div className="hae-table-scroll">
          <table className="w-full min-w-[720px] text-left lg:min-w-[1100px]">
            <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Priority</th>
                <th className="px-3 py-2 font-semibold">Task</th>
                {isStaff && viewAll ? (
                  <th className="hae-col-sm-hide px-3 py-2 font-semibold">Owner</th>
                ) : null}
                <th className="hae-col-lg-hide px-3 py-2 font-semibold">Program</th>
                <th className="hae-col-lg-hide px-3 py-2 font-semibold">Project</th>
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="hae-col-lg-hide px-3 py-2 font-semibold">Waiting On</th>
                <th className="hae-col-lg-hide px-3 py-2 font-semibold">Leadership</th>
                <th className="hae-col-sm-hide px-3 py-2 font-semibold">Next Action</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-3 py-8 text-center text-sm text-hae-slate">
                    No tasks match this filter
                  </td>
                </tr>
              ) : (
                pageItems.map((task) =>
                  editingId === task.id && draft && editSurface === 'inline' ? (
                    <tr key={task.id} className="bg-amber-50/80">
                      <td colSpan={colCount} className="px-4 py-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
                              Editing task
                            </p>
                            <p className="text-sm text-hae-slate">
                              {programNameOf(task, programsById)}
                              {projectNameOf(task, projectsById)
                                ? ` · ${projectNameOf(task, projectsById)}`
                                : ''}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={cancelEdit} className="hae-btn-secondary">
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={saveEdit}
                              className="hae-btn disabled:opacity-60"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                        <div
                          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                          onKeyDown={onEditKeyDown}
                        >
                          <Field label="Task" className="sm:col-span-2">
                            <input
                              autoFocus
                              className={fieldClass}
                              value={draft.name}
                              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            />
                          </Field>
                          <Field label="Owner">
                            <LeadSelect
                              className={fieldClass}
                              value={draft.owner}
                              onChange={(owner) => setDraft({ ...draft, owner })}
                            />
                          </Field>
                          <Field label="Priority">
                            <select
                              className={fieldClass}
                              value={draft.priority}
                              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                            >
                              <option value="">Auto</option>
                              <option value="HIGH">HIGH</option>
                              <option value="MEDIUM">MEDIUM</option>
                              <option value="LOW">LOW</option>
                            </select>
                          </Field>
                          <Field label="Status">
                            <select
                              className={fieldClass}
                              value={draft.status}
                              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
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
                              className={fieldClass}
                              value={draft.dueDate}
                              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                            />
                          </Field>
                          <Field label="Waiting on">
                            <input
                              className={fieldClass}
                              value={draft.waitingOn}
                              onChange={(e) => setDraft({ ...draft, waitingOn: e.target.value })}
                            />
                          </Field>
                          <Field label="Leadership">
                            <select
                              className={fieldClass}
                              value={draft.leadershipAttention}
                              onChange={(e) =>
                                setDraft({ ...draft, leadershipAttention: e.target.value })
                              }
                            >
                              {LEADERSHIP_ATTENTION.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Next action">
                            <input
                              className={fieldClass}
                              value={draft.nextAction}
                              onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })}
                            />
                          </Field>
                          <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
                            <textarea
                              className={fieldClass}
                              rows={3}
                              value={draft.notes}
                              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                            />
                          </Field>
                        </div>
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
                      <td className="px-3 py-2 text-sm font-medium">
                        <span className="line-clamp-2">{task.name}</span>
                      </td>
                      {isStaff && viewAll ? (
                        <td className="hae-col-sm-hide px-3 py-2 text-sm text-hae-slate">
                          {namesLabel(task.owner) || '—'}
                        </td>
                      ) : null}
                      <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                        <span className="line-clamp-2">
                          {programNameOf(task, programsById)}
                        </span>
                      </td>
                      <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                        <span className="line-clamp-2">
                          {projectNameOf(task, projectsById)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-hae-slate">
                        {formatDate(task.dueDate)}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(task.status)}`}
                          >
                            {normalizeTaskStatus(task.status)}
                          </span>
                          {isWaitingOn(task) ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${WAITING_ON_BADGE_CLASS}`}
                            >
                              Waiting On
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                        <span className="line-clamp-2">{task.waitingOn || '—'}</span>
                      </td>
                      <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                        <span className="line-clamp-2">
                          {task.leadershipAttention || 'None'}
                        </span>
                      </td>
                      <td className="hae-col-sm-hide px-3 py-2 text-sm text-hae-slate">
                        <span className="line-clamp-2">{task.nextAction || '—'}</span>
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
                  i === safePage ? 'bg-hae-crimson text-white' : 'hover:bg-hae-mist'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile pagination */}
      <div className="hae-mobile-only flex items-center justify-between text-xs text-hae-slate">
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
                i === safePage ? 'bg-hae-crimson text-white' : 'border border-hae-line bg-white'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
