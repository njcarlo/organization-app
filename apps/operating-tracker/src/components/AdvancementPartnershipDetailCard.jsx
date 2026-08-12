import { useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { TrashIcon } from './ActionIcons'
import CommentsPanel from './CommentsPanel'
import { LinksTable, parseLinks } from './Links'
import { ADVANCEMENT_PARTNERSHIP_TYPE_OPTIONS, ADVANCEMENT_PARTNERSHIP_STATUS_OPTIONS } from '../constants'
import { formatMoney } from '../utils'

const inputClass =
  'w-full rounded border border-hae-crimson bg-white px-2 py-0.5 text-sm outline-none'

const COLLECTION = 'trackerAdvancementPartnerships'

/**
 * Floating popup for a Strategic Partnership / Custom Program row. Every
 * field edits inline in place (click a value, it becomes an input, blur/
 * Enter saves) — mirrors AdvancementProgramDetailCard.
 */
export default function AdvancementPartnershipDetailCard({ partnership, readOnly = false, onClose, onChanged, onDeleted }) {
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState(null)
  const [fieldValue, setFieldValue] = useState('')
  const [saving, setSaving] = useState(false)

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
    if (field === 'type' || field === 'status') {
      if (fieldValue !== partnership[field]) patch = { [field]: fieldValue }
    } else if (field === 'pipelineValue') {
      const num = Number(fieldValue) || 0
      if (num !== (partnership.pipelineValue ?? 0)) patch = { pipelineValue: num }
    } else if (field === 'partnerName' || field === 'programName' || field === 'nextSteps') {
      const trimmed = fieldValue.trim()
      if (trimmed !== (partnership[field] || '')) patch = { [field]: trimmed }
    }
    if (!patch) return

    setSaving(true)
    setError('')
    try {
      await updateDoc(doc(db, COLLECTION, partnership.id), patch)
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to save partnership')
    } finally {
      setSaving(false)
    }
  }

  const addLink = async (link) => {
    setError('')
    try {
      await updateDoc(doc(db, COLLECTION, partnership.id), {
        links: [...parseLinks(partnership.links), link],
      })
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to add link')
    }
  }

  const editLink = async (idx, link) => {
    setError('')
    try {
      await updateDoc(doc(db, COLLECTION, partnership.id), {
        links: parseLinks(partnership.links).map((l, i) => (i === idx ? link : l)),
      })
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to update link')
    }
  }

  const deleteLink = async (idx) => {
    setError('')
    try {
      await updateDoc(doc(db, COLLECTION, partnership.id), {
        links: parseLinks(partnership.links).filter((_, i) => i !== idx),
      })
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to remove link')
    }
  }

  const removePartnership = async () => {
    if (!confirm('Delete this partnership? This action cannot be undone.')) return
    setError('')
    try {
      await deleteDoc(doc(db, COLLECTION, partnership.id))
      onDeleted?.()
    } catch (err) {
      setError(err.message || 'Failed to delete partnership')
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

  const title = partnership.partnerName || partnership.type || 'Untitled partnership'

  return (
    <Modal
      open
      onClose={handleClose}
      title={title}
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
              onClick={removePartnership}
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
              Partnership Details
            </h4>
            <dl className="-my-1">
              <EditableRow
                label="Type"
                field="type"
                type="select"
                options={ADVANCEMENT_PARTNERSHIP_TYPE_OPTIONS}
                value={partnership.type || ADVANCEMENT_PARTNERSHIP_TYPE_OPTIONS[0]}
                display={partnership.type || '—'}
              />
              <EditableRow
                label="Name of Partner"
                field="partnerName"
                value={partnership.partnerName || ''}
                display={partnership.partnerName || '—'}
              />
              <EditableRow
                label="Name of Course / Program"
                field="programName"
                value={partnership.programName || ''}
                display={partnership.programName || '—'}
              />
              <EditableRow
                label="Pipeline Value"
                field="pipelineValue"
                type="number"
                value={partnership.pipelineValue ?? ''}
                display={formatMoney(partnership.pipelineValue)}
              />
              <EditableRow
                label="Status"
                field="status"
                type="select"
                options={ADVANCEMENT_PARTNERSHIP_STATUS_OPTIONS}
                value={partnership.status || ADVANCEMENT_PARTNERSHIP_STATUS_OPTIONS[0]}
                display={partnership.status || '—'}
              />
            </dl>
          </div>

          <div className="border-t border-hae-line/60 pt-3">
            <h4 className="mb-1 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              Next Steps
            </h4>
            {editingField === 'nextSteps' ? (
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
                onClick={() => startFieldEdit('nextSteps', partnership.nextSteps || '')}
              >
                {partnership.nextSteps || '—'}
              </button>
            )}
          </div>

          <div className="border-t border-hae-line/60 pt-3">
            <h4 className="mb-1 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">Links</h4>
            <LinksTable
              links={partnership.links}
              onAdd={readOnly ? undefined : addLink}
              onEdit={readOnly ? undefined : editLink}
              onDelete={readOnly ? undefined : deleteLink}
            />
          </div>
        </div>

        <div className="mt-4 border-t border-hae-line/60 pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <CommentsPanel parentType={COLLECTION} parentId={partnership.id} parentName={title} />
        </div>
      </div>
    </Modal>
  )
}
