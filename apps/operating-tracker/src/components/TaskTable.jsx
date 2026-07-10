import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { LEADERSHIP_ATTENTION, TASK_STATUSES } from '../constants'
import { effectivePriority, formatDate, priorityBadgeClass } from '../utils'

const emptyNew = {
  name: '',
  owner: '',
  dueDate: '',
  status: 'Not Started',
  priority: '',
  waitingOn: '',
  leadershipAttention: 'None',
  nextAction: '',
}

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

function isComplete(task) {
  return String(task.status || '').toLowerCase() === 'complete'
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-hae-slate/80 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

function StatusPill({ status }) {
  const s = status || '—'
  const tone =
    s === 'Complete'
      ? 'bg-emerald-50 text-hae-green'
      : s === 'Waiting' || s === 'Review'
        ? 'bg-amber-50 text-hae-yellow'
        : s === 'In Progress'
          ? 'bg-sky-50 text-sky-800'
          : 'bg-hae-mist text-hae-slate'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {s}
    </span>
  )
}

function TaskEditForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  title = 'Editing task',
  autoFocus = true,
}) {
  return (
    <div className="rounded-lg border border-hae-line/80 bg-white px-3 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-hae-slate uppercase">
          {title}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="hae-btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="hae-btn disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
      >
        <Field label="Task" className="sm:col-span-2">
          <input
            autoFocus={autoFocus}
            className={fieldClass}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Task name"
          />
        </Field>
        <Field label="Owner">
          <input
            className={fieldClass}
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
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
      </div>
    </div>
  )
}

const TaskTable = forwardRef(function TaskTable(
  {
    tasks,
    project,
    program,
    onChanged,
    showOwner = true,
    dense = false,
  },
  ref
) {
  const [adding, setAdding] = useState(false)
  const [newTask, setNewTask] = useState(emptyNew)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const { active, completed } = useMemo(() => {
    const a = []
    const c = []
    for (const t of tasks) {
      if (isComplete(t)) c.push(t)
      else a.push(t)
    }
    return { active: a, completed: c }
  }, [tasks])

  const visible = showCompleted ? [...active, ...completed] : active
  const colCount = dense ? (showOwner ? 9 : 8) : showOwner ? 5 : 4

  const startAdd = () => {
    setAdding(true)
    setNewTask({
      ...emptyNew,
      owner: project?.lead || '',
    })
    setEditingId(null)
    setDraft(null)
    setExpandedId(null)
  }

  useImperativeHandle(ref, () => ({ startAdd }))

  const cancelAdd = () => {
    setAdding(false)
    setNewTask(emptyNew)
  }

  const saveNew = async () => {
    if (!newTask.name.trim() || saving) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'tasks'), {
        name: newTask.name.trim(),
        owner: newTask.owner.trim(),
        dueDate: newTask.dueDate || '',
        status: newTask.status,
        priority: newTask.priority,
        waitingOn: newTask.waitingOn.trim(),
        leadershipAttention: newTask.leadershipAttention,
        nextAction: newTask.nextAction.trim(),
        projectId: project.id,
        projectName: project.name,
        programId: program.id,
        programName: program.name,
        createdAt: serverTimestamp(),
      })
      setAdding(false)
      setNewTask(emptyNew)
      onChanged?.()
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (task) => {
    setAdding(false)
    setEditingId(task.id)
    setExpandedId(task.id)
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

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(null)
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
      onChanged?.()
    } finally {
      setSaving(false)
    }
  }

  const removeTask = async (id) => {
    if (!confirm('Delete this task?')) return
    await deleteDoc(doc(db, 'tasks', id))
    onChanged?.()
  }

  const toggleExpand = (id) => {
    setExpandedId((cur) => (cur === id ? null : id))
  }

  return (
    <div className="space-y-3">
      {adding ? (
        <TaskEditForm
          draft={newTask}
          setDraft={setNewTask}
          onSave={saveNew}
          onCancel={cancelAdd}
          saving={saving}
          title="New task"
        />
      ) : null}

      {visible.length === 0 && !adding ? (
        <p className="px-1 py-6 text-center text-sm text-hae-slate">
          {tasks.length === 0
            ? 'No tasks yet'
            : 'No active tasks — show completed below if needed'}
        </p>
      ) : dense ? (
        <div className="overflow-x-auto rounded-lg border border-hae-line/70 bg-white/80">
          <table className="w-full min-w-[960px] table-fixed text-left">
            <thead className="text-[10px] tracking-wide text-hae-slate/80 uppercase">
              <tr className="border-b border-hae-line/80 bg-hae-mist/50">
                <th className="px-3 py-2 font-semibold">Task</th>
                {showOwner ? <th className="px-3 py-2 font-semibold">Owner</th> : null}
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Priority</th>
                <th className="px-3 py-2 font-semibold">Waiting</th>
                <th className="px-3 py-2 font-semibold">Leadership</th>
                <th className="px-3 py-2 font-semibold">Next</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {visible.map((task) =>
                editingId === task.id && draft ? (
                  <tr key={task.id} className="bg-amber-50/60">
                    <td colSpan={colCount} className="p-2">
                      <TaskEditForm
                        draft={draft}
                        setDraft={setDraft}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={task.id}
                    className={`group border-b border-hae-line/50 ${
                      isComplete(task) ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 text-sm font-medium text-hae-ink">
                      <span className="line-clamp-2">{task.name}</span>
                    </td>
                    {showOwner ? (
                      <td className="px-3 py-2.5 text-sm text-hae-slate">
                        {task.owner || '—'}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-hae-slate">
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={task.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeClass(
                          effectivePriority(task)
                        )}`}
                      >
                        {effectivePriority(task)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-hae-slate">
                      <span className="line-clamp-1">{task.waitingOn || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-hae-slate">
                      <span className="line-clamp-1">
                        {task.leadershipAttention || 'None'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-hae-slate">
                      <span className="line-clamp-1">{task.nextAction || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
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
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => {
            const open = expandedId === task.id
            const editing = editingId === task.id && draft
            return (
              <li
                key={task.id}
                className={`rounded-lg border border-hae-line/70 bg-white/90 ${
                  isComplete(task) ? 'opacity-65' : ''
                }`}
              >
                {editing ? (
                  <div className="p-2">
                    <TaskEditForm
                      draft={draft}
                      setDraft={setDraft}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      saving={saving}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleExpand(task.id)}
                        className="mt-0.5 shrink-0 rounded px-1 text-hae-slate hover:bg-hae-mist"
                        aria-expanded={open}
                        aria-label={open ? 'Collapse details' : 'Expand details'}
                      >
                        {open ? '▾' : '▸'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpand(task.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-hae-ink">
                            {task.name}
                          </span>
                          <StatusPill status={task.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-hae-slate">
                          {showOwner ? <span>{task.owner || 'Unassigned'}</span> : null}
                          <span>Due {formatDate(task.dueDate)}</span>
                          {task.nextAction ? (
                            <span className="line-clamp-1 text-hae-ink/70">
                              Next: {task.nextAction}
                            </span>
                          ) : null}
                        </div>
                      </button>
                      <div className="flex shrink-0 gap-2 pt-0.5">
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
                    </div>
                    {open ? (
                      <div className="grid gap-2 border-t border-hae-line/60 bg-hae-mist/40 px-3 py-3 text-xs text-hae-slate sm:grid-cols-3">
                        <div>
                          <div className="text-[10px] font-semibold tracking-wide uppercase text-hae-slate/70">
                            Priority
                          </div>
                          <div className="mt-0.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeClass(
                                effectivePriority(task)
                              )}`}
                            >
                              {effectivePriority(task)}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold tracking-wide uppercase text-hae-slate/70">
                            Waiting on
                          </div>
                          <div className="mt-0.5 text-hae-ink/80">
                            {task.waitingOn || '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold tracking-wide uppercase text-hae-slate/70">
                            Leadership
                          </div>
                          <div className="mt-0.5 text-hae-ink/80">
                            {task.leadershipAttention || 'None'}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {completed.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowCompleted((v) => !v)}
          className="text-xs font-medium text-hae-slate hover:text-hae-crimson"
        >
          {showCompleted
            ? 'Hide completed'
            : `Show ${completed.length} completed`}
        </button>
      ) : null}
    </div>
  )
})

export default TaskTable
