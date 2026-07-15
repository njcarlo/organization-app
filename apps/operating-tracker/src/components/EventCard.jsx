import { useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import LeadSelect from './LeadSelect'
import EventChecklist from './EventChecklist'
import { EVENT_FORMAT_OPTIONS, HEALTH_OPTIONS } from '../constants'
import { formatDate, formatLongDate, healthBadgeClass, healthLabel, namesLabel, toNameList } from '../utils'

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

function BadgeRow({ label, value, className }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">{label}</dt>
      <dd>
        <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${className}`}>
          {value}
        </span>
      </dd>
    </div>
  )
}

/** Floating popup for an event — details + checklist, with inline edit/save/delete. */
export default function EventCard({ event, onClose, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(null)

  const startEdit = () => {
    setDraft({
      name: event.name || '',
      eventDate: event.eventDate || '',
      eventTime: event.eventTime || '',
      marketingDate: event.marketingDate || '',
      venue: event.venue || '',
      format: event.format || '',
      lead: toNameList(event.lead),
      health: event.health || 'not-started',
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    if (saving) return
    setEditing(false)
    setDraft(null)
  }

  const saveEdit = async () => {
    if (!draft?.name.trim() || saving) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'trackerEvents', event.id), {
        name: draft.name.trim(),
        eventDate: draft.eventDate,
        eventTime: draft.eventTime.trim(),
        marketingDate: draft.marketingDate,
        venue: draft.venue.trim(),
        format: draft.format,
        lead: draft.lead,
        health: draft.health,
      })
      setEditing(false)
      setDraft(null)
      onChanged?.()
    } finally {
      setSaving(false)
    }
  }

  const removeEvent = async () => {
    if (!confirm(`Delete "${event.name}"? Its checklist is not cascade-deleted. This action cannot be undone.`)) return
    await deleteDoc(doc(db, 'trackerEvents', event.id))
    onDeleted?.()
  }

  const handleClose = () => {
    if (saving) return
    setEditing(false)
    setDraft(null)
    onClose?.()
  }

  const rows = [
    { label: 'Status', value: healthLabel(event.health), badge: healthBadgeClass(event.health) },
    { label: 'Date of Event', value: formatLongDate(event.eventDate) },
    { label: 'Time of Event', value: event.eventTime || '—' },
    { label: 'Date of Marketing', value: event.marketingDate ? formatDate(event.marketingDate) : '—' },
    { label: 'Online or In-Person', value: event.format || '—' },
    { label: 'Venue', value: event.venue || '—' },
    { label: 'HAE Lead', value: namesLabel(event.lead) || '—' },
  ]

  return (
    <Modal
      open
      onClose={handleClose}
      title={editing ? `Editing · ${event.name}` : event.name}
      size={editing ? 'md' : 'xl'}
      busy={saving}
      footer={
        editing ? (
          <>
            <button type="button" className="hae-btn-secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="hae-btn disabled:opacity-60"
              onClick={saveEdit}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="hae-btn-secondary" onClick={removeEvent}>
              Delete
            </button>
            <button type="button" className="hae-btn-secondary" onClick={startEdit}>
              Edit
            </button>
            <button type="button" className="hae-btn-secondary" onClick={handleClose}>
              Close
            </button>
          </>
        )
      }
    >
      {editing && draft ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event Title" className="sm:col-span-2">
            <input
              autoFocus
              className={fieldClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Date of Event">
            <input
              type="date"
              className={fieldClass}
              value={draft.eventDate}
              onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })}
            />
          </Field>
          <Field label="Time of Event">
            <input
              className={fieldClass}
              value={draft.eventTime}
              onChange={(e) => setDraft({ ...draft, eventTime: e.target.value })}
            />
          </Field>
          <Field label="Date of Marketing">
            <input
              type="date"
              className={fieldClass}
              value={draft.marketingDate}
              onChange={(e) => setDraft({ ...draft, marketingDate: e.target.value })}
            />
          </Field>
          <Field label="Online or In-Person">
            <select
              className={fieldClass}
              value={draft.format}
              onChange={(e) => setDraft({ ...draft, format: e.target.value })}
            >
              <option value="">Select format</option>
              {EVENT_FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Venue">
            <input
              className={fieldClass}
              value={draft.venue}
              onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
            />
          </Field>
          <Field label="HAE Lead">
            <LeadSelect
              className={fieldClass}
              value={draft.lead}
              onChange={(lead) => setDraft({ ...draft, lead })}
            />
          </Field>
          <Field label="Marketing Status">
            <select
              className={fieldClass}
              value={draft.health}
              onChange={(e) => setDraft({ ...draft, health: e.target.value })}
            >
              {HEALTH_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <dl className="-my-1">
            {rows.map((row) =>
              row.badge ? (
                <BadgeRow key={row.label} label={row.label} value={row.value} className={row.badge} />
              ) : (
                <Row key={row.label} label={row.label} value={row.value} />
              )
            )}
          </dl>
          <div className="mt-4 space-y-4 border-t border-hae-line/60 pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <h4 className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              Checklist
            </h4>
            <EventChecklist eventId={event.id} />
          </div>
        </div>
      )}
    </Modal>
  )
}
