import { useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { ADVANCEMENT_PROGRAM_STATUS_OPTIONS } from '../constants'
import {
  advancementProgramStatusBadgeClass,
  formatMoney,
  pctToGoal,
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
      <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">{label}</dt>
      <dd className="text-sm text-hae-ink break-words">{value}</dd>
    </div>
  )
}

/**
 * Floating popup for a Revenue Generating Program — read view shows Program,
 * Purpose, and a Financial Report (Revenue / Goal / Forecast / % to Goal /
 * Status); staff can Edit in place or Delete. Mirrors GraphicDetailCard.
 */
export default function AdvancementProgramDetailCard({ program, readOnly = false, onClose, onChanged, onDeleted }) {
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const pct = pctToGoal(program.revenue, program.goal)

  const startEdit = () => {
    setDraft({
      name: program.name || '',
      purpose: program.purpose || '',
      revenue: program.revenue ?? '',
      goal: program.goal ?? '',
      forecast: program.forecast ?? '',
      status: program.status || ADVANCEMENT_PROGRAM_STATUS_OPTIONS[0],
      impactHighlights: program.impactHighlights || '',
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    if (saving) return
    setEditing(false)
    setDraft(null)
    setError('')
  }

  const saveRecord = async () => {
    if (!draft?.name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await updateDoc(doc(db, 'trackerAdvancementPrograms', program.id), {
        name: draft.name.trim(),
        purpose: draft.purpose.trim(),
        revenue: Number(draft.revenue) || 0,
        goal: Number(draft.goal) || 0,
        forecast: Number(draft.forecast) || 0,
        status: draft.status,
        impactHighlights: draft.impactHighlights.trim(),
      })
      setEditing(false)
      setDraft(null)
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to save program')
    } finally {
      setSaving(false)
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
    setEditing(false)
    setDraft(null)
    onClose?.()
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={editing ? `Editing · ${program.name || 'Untitled program'}` : program.name || 'Untitled program'}
      size="md"
      busy={saving}
      footer={
        editing ? (
          <>
            <button type="button" className="hae-btn-secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="hae-btn disabled:opacity-60" onClick={saveRecord} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            {!readOnly && (
              <button type="button" className="hae-btn-secondary" onClick={removeProgram}>
                Delete
              </button>
            )}
            {!readOnly && (
              <button type="button" className="hae-btn-secondary" onClick={startEdit}>
                Edit
              </button>
            )}
            <button type="button" className="hae-btn-secondary" onClick={handleClose}>
              Close
            </button>
          </>
        )
      }
    >
      {editing && draft ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Program" className="sm:col-span-2">
            <input
              autoFocus
              className={fieldClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Purpose" className="sm:col-span-2">
            <textarea
              rows={2}
              className={fieldClass}
              value={draft.purpose}
              onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
            />
          </Field>
          <Field label="Revenue (YTD)">
            <input
              type="number"
              min="0"
              step="1000"
              className={fieldClass}
              value={draft.revenue}
              onChange={(e) => setDraft({ ...draft, revenue: e.target.value })}
            />
          </Field>
          <Field label="Goal">
            <input
              type="number"
              min="0"
              step="1000"
              className={fieldClass}
              value={draft.goal}
              onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
            />
          </Field>
          <Field label="Forecast">
            <input
              type="number"
              min="0"
              step="1000"
              className={fieldClass}
              value={draft.forecast}
              onChange={(e) => setDraft({ ...draft, forecast: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className={fieldClass}
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              {ADVANCEMENT_PROGRAM_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Impact Highlights" className="sm:col-span-2">
            <textarea
              rows={2}
              className={fieldClass}
              placeholder="e.g. 121 applications | 12 finalists | Global exposure"
              value={draft.impactHighlights}
              onChange={(e) => setDraft({ ...draft, impactHighlights: e.target.value })}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-sm text-hae-red">{error}</p>}

          <div>
            <h4 className="mb-1 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">Purpose</h4>
            <p className="text-sm text-hae-ink">{program.purpose || '—'}</p>
          </div>

          <div className="border-t border-hae-line/60 pt-3">
            <h4 className="mb-2 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              Financial Report
            </h4>
            <dl className="-my-1">
              <Row label="Revenue (YTD)" value={formatMoney(program.revenue)} />
              <Row label="Goal" value={formatMoney(program.goal)} />
              <Row label="Forecast" value={formatMoney(program.forecast)} />
              <Row label="% to Goal" value={pct == null ? '—' : `${pct}%`} />
              <Row
                label="Status"
                value={
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${advancementProgramStatusBadgeClass(program.status)}`}
                  >
                    {program.status || '—'}
                  </span>
                }
              />
            </dl>
          </div>

          {program.impactHighlights ? (
            <div className="border-t border-hae-line/60 pt-3">
              <h4 className="mb-1 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
                Impact Highlights
              </h4>
              <p className="text-sm text-hae-ink">{program.impactHighlights}</p>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
