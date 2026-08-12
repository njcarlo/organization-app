import { useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { TrashIcon } from './ActionIcons'
import CommentsPanel from './CommentsPanel'
import { LinksTable, parseLinks } from './Links'
import { ADVANCEMENT_PROGRAM_STATUS_OPTIONS } from '../constants'
import {
  advancementProgramStatusBadgeClass,
  formatMoney,
  pctToGoal,
} from '../utils'

const inputClass =
  'w-full rounded border border-hae-crimson bg-white px-2 py-0.5 text-sm outline-none'

/**
 * Floating popup for a Revenue Generating Program. Every field edits inline
 * in place (click a value, it becomes an input, blur/Enter saves) — there is
 * no separate "editing" screen. Delete removes the whole program.
 */
export default function AdvancementProgramDetailCard({ program, readOnly = false, onClose, onChanged, onDeleted }) {
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState(null)
  const [fieldValue, setFieldValue] = useState('')
  const [saving, setSaving] = useState(false)

  const pct = pctToGoal(program.revenue, program.goal)

  const startFieldEdit = (field, value) => {
    if (readOnly) return
    setEditingField(field)
    setFieldValue(value)
  }
  const cancelFieldEdit = () => setEditingField(null)

  const commitFieldEdit = async () => {
    const field = editingField
    if (!field) return
    setEditingField(null)

    let patch = null
    if (field === 'name') {
      const trimmed = fieldValue.trim()
      if (trimmed && trimmed !== program.name) patch = { name: trimmed }
    } else if (field === 'revenue' || field === 'goal' || field === 'forecast') {
      const num = Number(fieldValue) || 0
      if (num !== (program[field] ?? 0)) patch = { [field]: num }
    } else if (field === 'status') {
      if (fieldValue !== program.status) patch = { status: fieldValue }
    } else if (field === 'impactHighlights') {
      const trimmed = fieldValue.trim()
      if (trimmed !== (program.impactHighlights || '')) patch = { impactHighlights: trimmed }
    }
    if (!patch) return

    setSaving(true)
    setError('')
    try {
      await updateDoc(doc(db, 'trackerAdvancementPrograms', program.id), patch)
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to save program')
    } finally {
      setSaving(false)
    }
  }

  const addLink = async (link) => {
    setError('')
    try {
      await updateDoc(doc(db, 'trackerAdvancementPrograms', program.id), {
        links: [...parseLinks(program.links), link],
      })
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to add link')
    }
  }

  const editLink = async (idx, link) => {
    setError('')
    try {
      await updateDoc(doc(db, 'trackerAdvancementPrograms', program.id), {
        links: parseLinks(program.links).map((l, i) => (i === idx ? link : l)),
      })
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to update link')
    }
  }

  const deleteLink = async (idx) => {
    setError('')
    try {
      await updateDoc(doc(db, 'trackerAdvancementPrograms', program.id), {
        links: parseLinks(program.links).filter((_, i) => i !== idx),
      })
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to remove link')
    }
  }

  const removeProgram = async () => {
    if (!confirm('Delete this program? This action cannot be undone.')) return
    setError('')
    try {
      await deleteDoc(doc(db, 'trackerAdvancementPrograms', program.id))
      onDeleted?.()
    } catch (err) {
      setError(err.message || 'Failed to delete program')
    }
  }

  const handleClose = () => {
    if (saving) return
    onClose?.()
  }

  const EditableRow = ({ label, field, value, display, type = 'text', options }) => {
    const isEditing = editingField === field
    return (
      <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0 sm:grid-cols-[8.5rem_1fr]">
        <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">{label}</dt>
        <dd className="text-sm text-hae-ink break-words">
          {isEditing ? (
            type === 'select' ? (
              <select
                autoFocus
                className={inputClass}
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                onBlur={commitFieldEdit}
              >
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                autoFocus
                type={type}
                className={inputClass}
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                onBlur={commitFieldEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur()
                  if (e.key === 'Escape') cancelFieldEdit()
                }}
              />
            )
          ) : (
            <button
              type="button"
              disabled={readOnly}
              className="text-left hover:text-hae-crimson disabled:cursor-default disabled:hover:text-hae-ink"
              onClick={() => startFieldEdit(field, value)}
            >
              {display}
            </button>
          )}
        </dd>
      </div>
    )
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={program.name || 'Untitled program'}
      size="xl"
      busy={saving}
      footer={
        <>
          {!readOnly && (
            <button
              type="button"
              className="hae-btn-secondary px-2.5 text-hae-slate hover:text-hae-red"
              title="Delete"
              aria-label="Delete"
              onClick={removeProgram}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          <button type="button" className="hae-btn-secondary" onClick={handleClose}>
            Close
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {error && <p className="text-sm text-hae-red">{error}</p>}

          <div>
            <h4 className="mb-2 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              Financial Report
            </h4>
            <dl className="-my-1">
              <EditableRow label="Program" field="name" value={program.name || ''} display={program.name || '—'} />
              <EditableRow
                label="Revenue (YTD)"
                field="revenue"
                type="number"
                value={program.revenue ?? ''}
                display={formatMoney(program.revenue)}
              />
              <EditableRow
                label="Goal"
                field="goal"
                type="number"
                value={program.goal ?? ''}
                display={formatMoney(program.goal)}
              />
              <EditableRow
                label="Forecast"
                field="forecast"
                type="number"
                value={program.forecast ?? ''}
                display={formatMoney(program.forecast)}
              />
              <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0 sm:grid-cols-[8.5rem_1fr]">
                <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">% to Goal</dt>
                <dd className="text-sm text-hae-ink break-words">{pct == null ? '—' : `${pct}%`}</dd>
              </div>
              <EditableRow
                label="Status"
                field="status"
                type="select"
                options={ADVANCEMENT_PROGRAM_STATUS_OPTIONS}
                value={program.status || ADVANCEMENT_PROGRAM_STATUS_OPTIONS[0]}
                display={
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${advancementProgramStatusBadgeClass(program.status)}`}
                  >
                    {program.status || '—'}
                  </span>
                }
              />
            </dl>
          </div>

          <div className="border-t border-hae-line/60 pt-3">
            <h4 className="mb-1 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              Impact Highlights
            </h4>
            {editingField === 'impactHighlights' ? (
              <textarea
                autoFocus
                rows={2}
                className={inputClass}
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                onBlur={commitFieldEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelFieldEdit()
                }}
              />
            ) : (
              <button
                type="button"
                disabled={readOnly}
                className="w-full text-left text-sm text-hae-ink hover:text-hae-crimson disabled:cursor-default disabled:hover:text-hae-ink"
                onClick={() => startFieldEdit('impactHighlights', program.impactHighlights || '')}
              >
                {program.impactHighlights || '—'}
              </button>
            )}
          </div>

          <div className="border-t border-hae-line/60 pt-3">
            <h4 className="mb-1 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">Links</h4>
            <LinksTable
              links={program.links}
              onAdd={readOnly ? undefined : addLink}
              onEdit={readOnly ? undefined : editLink}
              onDelete={readOnly ? undefined : deleteLink}
            />
          </div>
        </div>

        <div className="mt-4 border-t border-hae-line/60 pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <CommentsPanel parentType="trackerAdvancementPrograms" parentId={program.id} parentName={program.name} />
        </div>
      </div>
    </Modal>
  )
}
