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

const inputClass =
  'w-full rounded border border-hae-line bg-white px-2 py-1 text-sm outline-none focus:border-hae-crimson'
const selectClass = inputClass

const TaskTable = forwardRef(function TaskTable(
  { tasks, project, program, onChanged, showOwner = true },
  ref
) {
  const [adding, setAdding] = useState(false)
  const [newTask, setNewTask] = useState(emptyNew)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const startAdd = () => {
    setAdding(true)
    setNewTask({
      ...emptyNew,
      owner: project?.lead || '',
    })
    setEditingId(null)
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

  const onNewKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveNew()
    }
    if (e.key === 'Escape') cancelAdd()
  }

  const onEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    }
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left">
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
            <th className="w-16 px-2 py-1.5 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {adding && (
            <tr className="bg-sky-50">
              <td className="px-2 py-1">
                <input
                  autoFocus
                  className={inputClass}
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  onKeyDown={onNewKeyDown}
                  placeholder="Task name"
                />
              </td>
              {showOwner && (
                <td className="px-2 py-1">
                  <input
                    className={inputClass}
                    value={newTask.owner}
                    onChange={(e) => setNewTask({ ...newTask, owner: e.target.value })}
                    onKeyDown={onNewKeyDown}
                  />
                </td>
              )}
              <td className="px-2 py-1">
                <input
                  type="date"
                  className={inputClass}
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  onKeyDown={onNewKeyDown}
                />
              </td>
              <td className="px-2 py-1">
                <select
                  className={selectClass}
                  value={newTask.status}
                  onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1">
                <select
                  className={selectClass}
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                >
                  <option value="">Auto</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </td>
              <td className="px-2 py-1">
                <input
                  className={inputClass}
                  value={newTask.waitingOn}
                  onChange={(e) => setNewTask({ ...newTask, waitingOn: e.target.value })}
                  onKeyDown={onNewKeyDown}
                />
              </td>
              <td className="px-2 py-1">
                <select
                  className={selectClass}
                  value={newTask.leadershipAttention}
                  onChange={(e) =>
                    setNewTask({ ...newTask, leadershipAttention: e.target.value })
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
                  value={newTask.nextAction}
                  onChange={(e) => setNewTask({ ...newTask, nextAction: e.target.value })}
                  onKeyDown={onNewKeyDown}
                />
              </td>
              <td className="px-2 py-1 text-right text-xs">
                <button
                  type="button"
                  onClick={saveNew}
                  className="font-semibold text-hae-crimson"
                >
                  Save
                </button>
              </td>
            </tr>
          )}

          {tasks.map((task) =>
            editingId === task.id && draft ? (
              <tr key={task.id} className="bg-amber-50">
                <td className="px-2 py-1">
                  <input
                    autoFocus
                    className={inputClass}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    onKeyDown={onEditKeyDown}
                  />
                </td>
                {showOwner && (
                  <td className="px-2 py-1">
                    <input
                      className={inputClass}
                      value={draft.owner}
                      onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
                      onKeyDown={onEditKeyDown}
                    />
                  </td>
                )}
                <td className="px-2 py-1">
                  <input
                    type="date"
                    className={inputClass}
                    value={draft.dueDate}
                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                    onKeyDown={onEditKeyDown}
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    className={selectClass}
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    className={selectClass}
                    value={draft.priority}
                    onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  >
                    <option value="">Auto</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass}
                    value={draft.waitingOn}
                    onChange={(e) => setDraft({ ...draft, waitingOn: e.target.value })}
                    onKeyDown={onEditKeyDown}
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    className={selectClass}
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
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass}
                    value={draft.nextAction}
                    onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })}
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
              <tr key={task.id} className="group border-b border-hae-line/60">
                <td className="px-2 py-2 text-sm font-medium">{task.name}</td>
                {showOwner && (
                  <td className="px-2 py-2 text-sm text-hae-slate">{task.owner || '—'}</td>
                )}
                <td className="px-2 py-2 text-sm text-hae-slate">{task.dueDate || '—'}</td>
                <td className="px-2 py-2 text-sm text-hae-slate">{task.status}</td>
                <td className="px-2 py-2 text-sm text-hae-slate">
                  {task.priority || 'Auto'}
                </td>
                <td className="px-2 py-2 text-sm text-hae-slate">
                  {task.waitingOn || '—'}
                </td>
                <td className="px-2 py-2 text-sm text-hae-slate">
                  {task.leadershipAttention || 'None'}
                </td>
                <td className="px-2 py-2 text-sm text-hae-slate">
                  {task.nextAction || '—'}
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
                colSpan={showOwner ? 9 : 8}
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
