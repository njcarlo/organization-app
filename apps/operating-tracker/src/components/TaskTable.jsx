import { forwardRef, useImperativeHandle, useState } from 'react'
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
import { formatDate } from '../utils'

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
    <div className="px-3 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
          {title}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-hae-line px-3 py-1.5 text-xs font-semibold text-hae-slate hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-md bg-hae-crimson px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
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
  { tasks, project, program, onChanged, showOwner = true },
  ref
) {
  const [adding, setAdding] = useState(false)
  const [newTask, setNewTask] = useState(emptyNew)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const colCount = showOwner ? 9 : 8

  const startAdd = () => {
    setAdding(true)
    setNewTask({
      ...emptyNew,
      owner: project?.lead || '',
    })
    setEditingId(null)
    setDraft(null)
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] table-fixed text-left">
        <colgroup>
          <col className="w-[18%]" />
          {showOwner ? <col className="w-[10%]" /> : null}
          <col className="w-[10%]" />
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[11%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[7%]" />
        </colgroup>
        <thead className="text-[11px] tracking-wide text-hae-slate uppercase">
          <tr className="border-b border-hae-line">
            <th className="px-2 py-1.5 font-semibold">Task</th>
            {showOwner && <th className="px-2 py-1.5 font-semibold">Owner</th>}
            <th className="px-2 py-1.5 font-semibold">Due</th>
            <th className="px-2 py-1.5 font-semibold">Status</th>
            <th className="px-2 py-1.5 font-semibold">Priority</th>
            <th className="px-2 py-1.5 font-semibold">Waiting On</th>
            <th className="px-2 py-1.5 font-semibold">Leadership</th>
            <th className="px-2 py-1.5 font-semibold">Next Action</th>
            <th className="px-2 py-1.5 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {adding && (
            <tr className="bg-sky-50/80">
              <td colSpan={colCount}>
                <TaskEditForm
                  draft={newTask}
                  setDraft={setNewTask}
                  onSave={saveNew}
                  onCancel={cancelAdd}
                  saving={saving}
                  title="New task"
                />
              </td>
            </tr>
          )}

          {tasks.map((task) =>
            editingId === task.id && draft ? (
              <tr key={task.id} className="bg-amber-50/80">
                <td colSpan={colCount}>
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
              <tr key={task.id} className="group border-b border-hae-line/60">
                <td className="px-2 py-2 text-sm font-medium">
                  <span className="line-clamp-2">{task.name}</span>
                </td>
                {showOwner && (
                  <td className="px-2 py-2 text-sm text-hae-slate">
                    {task.owner || '—'}
                  </td>
                )}
                <td className="whitespace-nowrap px-2 py-2 text-sm text-hae-slate">
                  {formatDate(task.dueDate)}
                </td>
                <td className="px-2 py-2 text-sm text-hae-slate">{task.status}</td>
                <td className="px-2 py-2 text-sm text-hae-slate">
                  {task.priority || 'Auto'}
                </td>
                <td className="px-2 py-2 text-sm text-hae-slate">
                  <span className="line-clamp-2">{task.waitingOn || '—'}</span>
                </td>
                <td className="px-2 py-2 text-sm text-hae-slate">
                  <span className="line-clamp-2">
                    {task.leadershipAttention || 'None'}
                  </span>
                </td>
                <td className="px-2 py-2 text-sm text-hae-slate">
                  <span className="line-clamp-2">{task.nextAction || '—'}</span>
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(task)}
                      className="text-xs text-hae-slate hover:text-hae-crimson"
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      className="text-xs text-hae-slate hover:text-hae-red"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}

          {tasks.length === 0 && !adding && (
            <tr>
              <td
                colSpan={colCount}
                className="px-2 py-4 text-center text-sm text-hae-slate"
              >
                No tasks yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
})

export default TaskTable
