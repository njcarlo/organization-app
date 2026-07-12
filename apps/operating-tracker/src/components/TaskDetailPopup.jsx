import { useEffect, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import LeadSelect from './LeadSelect'
import { LEADERSHIP_ATTENTION, TASK_STATUSES } from '../constants'
import {
  effectivePriority,
  formatDate,
  namesLabel,
  normalizeTaskStatus,
  priorityBadgeClass,
  programNameOf,
  projectNameOf,
  statusBadgeClass,
  toNameList,
} from '../utils'

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

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

function Row({ label, value }) {
  if (value == null) return null
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
        {label}
      </dt>
      <dd className="text-sm text-hae-ink break-words">{value}</dd>
    </div>
  )
}

function BadgeRow({ label, value, className }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
        {label}
      </dt>
      <dd>
        <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${className}`}>
          {value}
        </span>
      </dd>
    </div>
  )
}

/**
 * Read-only floating popup for task/attention cards, with optional inline editing.
 */
export default function TaskDetailPopup({
  open,
  onClose,
  title = 'Details',
  rows = [],
  task = null,
  programsById = {},
  projectsById = {},
  editable = false,
  onSaved,
  footer = null,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    setSaved(null)
  }, [task?.id])

  const canEdit = editable && Boolean(task?.id)
  const effectiveTask = task && saved ? { ...task, ...saved } : task
  const displayRows = effectiveTask
    ? taskDetailRows(effectiveTask, { programsById, projectsById })
    : rows

  const startEdit = () => {
    setDraft({
      name: effectiveTask.name || '',
      owner: toNameList(effectiveTask.owner),
      dueDate: effectiveTask.dueDate || '',
      status: normalizeTaskStatus(effectiveTask.status || 'Not Started'),
      priority: effectiveTask.priority || '',
      waitingOn: effectiveTask.waitingOn || '',
      leadershipAttention: effectiveTask.leadershipAttention || 'None',
      nextAction: effectiveTask.nextAction || '',
      notes: effectiveTask.notes || '',
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraft(null)
  }

  const save = async () => {
    if (!draft?.name.trim() || saving) return
    setSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        owner: draft.owner,
        dueDate: draft.dueDate || '',
        status: draft.status,
        priority: draft.priority,
        waitingOn: draft.waitingOn.trim(),
        leadershipAttention: draft.leadershipAttention,
        nextAction: draft.nextAction.trim(),
        notes: draft.notes.trim(),
      }
      await updateDoc(doc(db, 'tasks', task.id), payload)
      setSaved(payload)
      setEditing(false)
      setDraft(null)
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setEditing(false)
    setDraft(null)
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? `Editing · ${task?.name || title}` : title}
      size="md"
      footer={
        editing ? (
          <>
            <button type="button" className="hae-btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
            <button
              type="button"
              className="hae-btn disabled:opacity-60"
              disabled={saving}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          footer || (
            <>
              {canEdit ? (
                <button type="button" className="hae-btn-secondary" onClick={startEdit}>
                  Edit
                </button>
              ) : null}
              <button type="button" className="hae-btn-secondary" onClick={handleClose}>
                Close
              </button>
            </>
          )
        )
      }
    >
      {editing ? (
        <div
          className="grid gap-3 sm:grid-cols-2"
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancelEdit()
          }}
        >
          <Field label="Task" className="sm:col-span-2">
            <input
              autoFocus
              className={fieldClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Task name"
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
              onChange={(e) => setDraft({ ...draft, leadershipAttention: e.target.value })}
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
          <Field label="Notes" className="sm:col-span-2">
            <textarea
              className={fieldClass}
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </Field>
        </div>
      ) : (
        <dl className="-my-1">
          {displayRows.map((row) =>
            row.label === 'Status' ? (
              <BadgeRow
                key={row.label}
                label="Status"
                value={row.value}
                className={statusBadgeClass(row.value)}
              />
            ) : row.label === 'Priority' ? (
              <BadgeRow
                key={row.label}
                label="Priority"
                value={row.value}
                className={priorityBadgeClass(row.value)}
              />
            ) : (
              <Row key={row.label} label={row.label} value={row.value} />
            )
          )}
        </dl>
      )}
    </Modal>
  )
}

export function taskDetailRows(task, { programsById = {}, projectsById = {} } = {}) {
  if (!task) return []
  return [
    { label: 'Status', value: normalizeTaskStatus(task.status) || 'Not Started' },
    { label: 'Due', value: formatDate(task.dueDate) },
    { label: 'Owner', value: namesLabel(task.owner) || '—' },
    { label: 'Program', value: programNameOf(task, programsById) },
    { label: 'Project', value: projectNameOf(task, projectsById) },
    { label: 'Priority', value: effectivePriority(task) },
    { label: 'Waiting on', value: task.waitingOn || '—' },
    { label: 'Leadership', value: task.leadershipAttention || 'None' },
    { label: 'Next action', value: task.nextAction || '—' },
    { label: 'Notes', value: task.notes || '—' },
  ]
}
