import { Fragment, forwardRef, useImperativeHandle, useMemo, useState } from 'react'
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
import {
  effectivePriority,
  formatDate,
  isWaitingOn,
  normalizeTaskStatus,
  priorityBadgeClass,
  sortByStatus,
  statusBadgeClass,
  WAITING_ON_BADGE_CLASS,
} from '../utils'

const emptyNew = {
  name: '',
  owner: '',
  dueDate: '',
  status: 'Not Started',
  priority: '',
  waitingOn: '',
  leadershipAttention: 'None',
  nextAction: '',
  notes: '',
}

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

function isComplete(task) {
  return String(task.status || '').toLowerCase() === 'complete'
}

const emptySubtask = { name: '', status: 'Not Started', dueDate: '', notes: '' }

function makeSubtaskId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sub-${Date.now()}-${Math.random().toString(16).slice(2)}`
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

function StatusPill({ status, waitingOn = false }) {
  const s = status ? normalizeTaskStatus(status) : '—'
  return (
    <>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
          status
        )}`}
      >
        {s}
      </span>
      {waitingOn ? (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${WAITING_ON_BADGE_CLASS}`}
        >
          Waiting On
        </span>
      ) : null}
    </>
  )
}

function SubtaskForm({ draft, setDraft, onSave, onCancel, saving }) {
  return (
    <div
      className="grid gap-2 rounded-md border border-hae-line/60 bg-hae-mist/40 p-2 sm:grid-cols-[1fr_auto_auto_auto]"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
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
      <input
        autoFocus
        className={fieldClass}
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Subtask name"
      />
      <input
        type="date"
        className={fieldClass}
        value={draft.dueDate}
        onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
      />
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
      <textarea
        className={`${fieldClass} sm:col-span-4`}
        rows={2}
        placeholder="Notes"
        value={draft.notes}
        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
      />
    </div>
  )
}

function SubtaskList({
  task,
  editingSubtaskId,
  subtaskDraft,
  setSubtaskDraft,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  adding,
  newSubtask,
  setNewSubtask,
  onStartAdd,
  onSaveNew,
  onCancelAdd,
  saving,
}) {
  const subtasks = task.subtasks || []
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-wide text-hae-slate/70 uppercase">
          Subtasks
        </div>
        {!adding ? (
          <button
            type="button"
            onClick={onStartAdd}
            className="text-xs font-medium text-hae-slate hover:text-hae-crimson"
          >
            + Add subtask
          </button>
        ) : null}
      </div>
      {subtasks.length === 0 && !adding ? (
        <p className="text-xs text-hae-slate/70">No subtasks yet</p>
      ) : null}
      <ul className="space-y-1.5">
        {subtasks.map((sub) =>
          editingSubtaskId === sub.id && subtaskDraft ? (
            <li key={sub.id}>
              <SubtaskForm
                draft={subtaskDraft}
                setDraft={setSubtaskDraft}
                onSave={onSaveEdit}
                onCancel={onCancelEdit}
                saving={saving}
              />
            </li>
          ) : (
            <li
              key={sub.id}
              className="rounded-md border border-hae-line/50 bg-white px-2 py-1.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={sub.status} />
                <span className="min-w-0 flex-1 text-sm text-hae-ink">{sub.name}</span>
                <span className="text-xs whitespace-nowrap text-hae-slate">
                  Due {formatDate(sub.dueDate)}
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onStartEdit(sub)}
                    className="text-xs text-hae-slate hover:text-hae-crimson"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(sub.id)}
                    className="text-xs text-hae-slate hover:text-hae-red"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {sub.notes ? (
                <p className="mt-1 whitespace-pre-wrap text-xs text-hae-slate/90">
                  {sub.notes}
                </p>
              ) : null}
            </li>
          )
        )}
      </ul>
      {adding ? (
        <SubtaskForm
          draft={newSubtask}
          setDraft={setNewSubtask}
          onSave={onSaveNew}
          onCancel={onCancelAdd}
          saving={saving}
        />
      ) : null}
    </div>
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
        <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
          <textarea
            className={fieldClass}
            rows={3}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
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
  const [addingSubtaskFor, setAddingSubtaskFor] = useState(null)
  const [newSubtask, setNewSubtask] = useState(emptySubtask)
  const [editingSubtask, setEditingSubtask] = useState(null)
  const [subtaskDraft, setSubtaskDraft] = useState(null)
  const [subtaskSaving, setSubtaskSaving] = useState(false)

  const { active, completed } = useMemo(() => {
    const a = []
    const c = []
    for (const t of tasks) {
      if (isComplete(t)) c.push(t)
      else a.push(t)
    }
    a.sort(sortByStatus)
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
        notes: newTask.notes.trim(),
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
        notes: draft.notes.trim(),
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

  const startAddSubtask = (taskId) => {
    setEditingSubtask(null)
    setSubtaskDraft(null)
    setAddingSubtaskFor(taskId)
    setNewSubtask(emptySubtask)
  }

  const cancelAddSubtask = () => {
    setAddingSubtaskFor(null)
    setNewSubtask(emptySubtask)
  }

  const saveNewSubtask = async (task) => {
    if (!newSubtask.name.trim() || subtaskSaving) return
    setSubtaskSaving(true)
    try {
      const subtask = {
        id: makeSubtaskId(),
        name: newSubtask.name.trim(),
        status: newSubtask.status,
        dueDate: newSubtask.dueDate || '',
        notes: newSubtask.notes.trim(),
      }
      await updateDoc(doc(db, 'tasks', task.id), {
        subtasks: [...(task.subtasks || []), subtask],
      })
      setAddingSubtaskFor(null)
      setNewSubtask(emptySubtask)
      onChanged?.()
    } finally {
      setSubtaskSaving(false)
    }
  }

  const startEditSubtask = (sub) => {
    setAddingSubtaskFor(null)
    setEditingSubtask(sub.id)
    setSubtaskDraft({
      name: sub.name || '',
      status: normalizeTaskStatus(sub.status || 'Not Started'),
      dueDate: sub.dueDate || '',
      notes: sub.notes || '',
    })
  }

  const cancelEditSubtask = () => {
    setEditingSubtask(null)
    setSubtaskDraft(null)
  }

  const saveEditSubtask = async (task) => {
    if (!subtaskDraft?.name.trim() || subtaskSaving) return
    setSubtaskSaving(true)
    try {
      const updated = (task.subtasks || []).map((s) =>
        s.id === editingSubtask
          ? {
              ...s,
              name: subtaskDraft.name.trim(),
              status: subtaskDraft.status,
              dueDate: subtaskDraft.dueDate || '',
              notes: subtaskDraft.notes.trim(),
            }
          : s
      )
      await updateDoc(doc(db, 'tasks', task.id), { subtasks: updated })
      setEditingSubtask(null)
      setSubtaskDraft(null)
      onChanged?.()
    } finally {
      setSubtaskSaving(false)
    }
  }

  const removeSubtask = async (task, subtaskId) => {
    if (!confirm('Delete this subtask?')) return
    const updated = (task.subtasks || []).filter((s) => s.id !== subtaskId)
    await updateDoc(doc(db, 'tasks', task.id), { subtasks: updated })
    onChanged?.()
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
        <div className="hae-table-scroll rounded-lg border border-hae-line/70 bg-white/80">
          <table className="w-full min-w-[640px] text-left lg:min-w-[960px]">
            <thead className="text-[10px] tracking-wide text-hae-slate/80 uppercase">
              <tr className="border-b border-hae-line/80 bg-hae-mist/50">
                <th className="px-3 py-2 font-semibold">Task</th>
                {showOwner ? (
                  <th className="hae-col-sm-hide px-3 py-2 font-semibold">Owner</th>
                ) : null}
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="hae-col-sm-hide px-3 py-2 font-semibold">Priority</th>
                <th className="hae-col-lg-hide px-3 py-2 font-semibold">Waiting</th>
                <th className="hae-col-lg-hide px-3 py-2 font-semibold">Leadership</th>
                <th className="hae-col-sm-hide px-3 py-2 font-semibold">Next</th>
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
                  <Fragment key={task.id}>
                  <tr
                    className={`group border-b border-hae-line/50 ${
                      isComplete(task) ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 text-sm font-medium text-hae-ink">
                      <button
                        type="button"
                        onClick={() => toggleExpand(task.id)}
                        className="flex items-center gap-1.5 text-left"
                        aria-expanded={expandedId === task.id}
                        aria-label={
                          expandedId === task.id ? 'Collapse subtasks' : 'Expand subtasks'
                        }
                      >
                        <span className="shrink-0 text-hae-slate">
                          {expandedId === task.id ? '▾' : '▸'}
                        </span>
                        <span className="line-clamp-2">{task.name}</span>
                      </button>
                    </td>
                    {showOwner ? (
                      <td className="hae-col-sm-hide px-3 py-2.5 text-sm text-hae-slate">
                        {task.owner || '—'}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-hae-slate">
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <StatusPill status={task.status} waitingOn={isWaitingOn(task)} />
                      </div>
                    </td>
                    <td className="hae-col-sm-hide px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeClass(
                          effectivePriority(task)
                        )}`}
                      >
                        {effectivePriority(task)}
                      </span>
                    </td>
                    <td className="hae-col-lg-hide px-3 py-2.5 text-sm text-hae-slate">
                      <span className="line-clamp-1">{task.waitingOn || '—'}</span>
                    </td>
                    <td className="hae-col-lg-hide px-3 py-2.5 text-sm text-hae-slate">
                      <span className="line-clamp-1">
                        {task.leadershipAttention || 'None'}
                      </span>
                    </td>
                    <td className="hae-col-sm-hide px-3 py-2.5 text-sm text-hae-slate">
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
                  {expandedId === task.id ? (
                    <tr className="border-b border-hae-line/50 bg-hae-mist/30">
                      <td colSpan={colCount} className="px-3 py-3">
                        {task.notes ? (
                          <div className="mb-3">
                            <div className="text-[10px] font-semibold tracking-wide uppercase text-hae-slate/70">
                              Notes
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap text-xs text-hae-slate">
                              {task.notes}
                            </p>
                          </div>
                        ) : null}
                        <SubtaskList
                          task={task}
                          editingSubtaskId={editingSubtask}
                          subtaskDraft={subtaskDraft}
                          setSubtaskDraft={setSubtaskDraft}
                          onStartEdit={startEditSubtask}
                          onSaveEdit={() => saveEditSubtask(task)}
                          onCancelEdit={cancelEditSubtask}
                          onDelete={(subId) => removeSubtask(task, subId)}
                          adding={addingSubtaskFor === task.id}
                          newSubtask={newSubtask}
                          setNewSubtask={setNewSubtask}
                          onStartAdd={() => startAddSubtask(task.id)}
                          onSaveNew={() => saveNewSubtask(task)}
                          onCancelAdd={cancelAddSubtask}
                          saving={subtaskSaving}
                        />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
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
                          <StatusPill status={task.status} waitingOn={isWaitingOn(task)} />
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
                      <div className="border-t border-hae-line/60 bg-hae-mist/40 px-3 py-3">
                        <div className="grid gap-2 text-xs text-hae-slate sm:grid-cols-3">
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
                        {task.notes ? (
                          <div className="mt-3 border-t border-hae-line/50 pt-3 text-xs text-hae-slate">
                            <div className="text-[10px] font-semibold tracking-wide uppercase text-hae-slate/70">
                              Notes
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap">{task.notes}</p>
                          </div>
                        ) : null}
                        <div className="mt-3 border-t border-hae-line/50 pt-3">
                          <SubtaskList
                            task={task}
                            editingSubtaskId={editingSubtask}
                            subtaskDraft={subtaskDraft}
                            setSubtaskDraft={setSubtaskDraft}
                            onStartEdit={startEditSubtask}
                            onSaveEdit={() => saveEditSubtask(task)}
                            onCancelEdit={cancelEditSubtask}
                            onDelete={(subId) => removeSubtask(task, subId)}
                            adding={addingSubtaskFor === task.id}
                            newSubtask={newSubtask}
                            setNewSubtask={setNewSubtask}
                            onStartAdd={() => startAddSubtask(task.id)}
                            onSaveNew={() => saveNewSubtask(task)}
                            onCancelAdd={cancelAddSubtask}
                            saving={subtaskSaving}
                          />
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
