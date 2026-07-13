import { useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import LeadSelect from './LeadSelect'
import EventChecklist from './EventChecklist'
import { EVENT_FORMAT_OPTIONS, HEALTH_OPTIONS } from '../constants'
import { formatDate, formatLongDate, healthBadgeClass, healthLabel, namesLabel, toNameList } from '../utils'

/** Expanded event detail — headline fields + checklist, with inline edit/delete. */
export default function EventCard({ event, onChanged, onDeleted }) {
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)

  const startEdit = () => {
    setForm({
      name: event.name || '',
      eventDate: event.eventDate || '',
      eventTime: event.eventTime || '',
      marketingDate: event.marketingDate || '',
      venue: event.venue || '',
      format: event.format || '',
      lead: toNameList(event.lead),
      health: event.health || 'not-started',
    })
    setEditOpen(true)
  }

  const closeEdit = () => {
    if (saving) return
    setEditOpen(false)
    setForm(null)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!form?.name.trim() || saving) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'trackerEvents', event.id), {
        name: form.name.trim(),
        eventDate: form.eventDate,
        eventTime: form.eventTime.trim(),
        marketingDate: form.marketingDate,
        venue: form.venue.trim(),
        format: form.format,
        lead: form.lead,
        health: form.health,
      })
      setEditOpen(false)
      setForm(null)
      onChanged?.()
    } finally {
      setSaving(false)
    }
  }

  const removeEvent = async () => {
    if (!confirm(`Delete "${event.name}"? Its checklist is not cascade-deleted.`)) return
    await deleteDoc(doc(db, 'trackerEvents', event.id))
    onDeleted?.()
  }

  return (
    <div className="space-y-4 rounded-xl border border-hae-line bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-hae-ink">{event.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${healthBadgeClass(event.health)}`}
            >
              {healthLabel(event.health)}
            </span>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                Date of Event
              </dt>
              <dd className="text-hae-ink">{formatLongDate(event.eventDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                Time of Event
              </dt>
              <dd className="text-hae-ink">{event.eventTime || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                Date of Marketing
              </dt>
              <dd className="text-hae-ink">
                {event.marketingDate ? formatDate(event.marketingDate) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                Online or In-Person
              </dt>
              <dd className="text-hae-ink">{event.format || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                Venue
              </dt>
              <dd className="text-hae-ink">{event.venue || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                HAE Lead
              </dt>
              <dd className="text-hae-ink">{namesLabel(event.lead) || '—'}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={startEdit} className="hae-btn-secondary">
            Edit
          </button>
          <button
            type="button"
            onClick={removeEvent}
            className="text-xs text-hae-slate hover:text-hae-red"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="border-t border-hae-line/60 pt-3">
        <h4 className="mb-2 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
          Checklist
        </h4>
        <EventChecklist eventId={event.id} />
      </div>

      <Modal
        open={editOpen}
        onClose={closeEdit}
        title="Update event"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={closeEdit} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="event-card-edit-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Update event'}
            </button>
          </>
        }
      >
        {form ? (
          <form id="event-card-edit-form" onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-hae-slate">Event Title</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Date of Event</span>
              <input
                type="date"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Time of Event (with timezone)</span>
              <input
                value={form.eventTime}
                onChange={(e) => setForm({ ...form, eventTime: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Date of Marketing</span>
              <input
                type="date"
                value={form.marketingDate}
                onChange={(e) => setForm({ ...form, marketingDate: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Online or In-Person</span>
              <select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                <option value="">Select format</option>
                {EVENT_FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Venue</span>
              <input
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">HAE Lead</span>
              <LeadSelect value={form.lead} onChange={(lead) => setForm({ ...form, lead })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Status</span>
              <select
                value={form.health}
                onChange={(e) => setForm({ ...form, health: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                {HEALTH_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
