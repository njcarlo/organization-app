import { useEffect, useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import LeadSelect from './LeadSelect'
import EventChecklist from './EventChecklist'
import CommentsPanel from './CommentsPanel'
import CategoryManagerModal from './CategoryManagerModal'
import { EVENT_KIND_OPTIONS, HEALTH_OPTIONS } from '../constants'
import { useEventCategories } from '../hooks/useEventCategories'
import { toNameList } from '../utils'

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

function draftFromEvent(event) {
  return {
    name: event.name || '',
    eventDate: event.eventDate || '',
    time: event.time || '',
    timeZone: event.timeZone || '',
    marketingDate: event.marketingDate || '',
    venue: event.venue || '',
    type: event.type || '',
    eventType: event.eventType || '',
    lead: toNameList(event.lead),
    instructor: event.instructor || '',
    moderator: event.moderator || '',
    zoomCoordinator: event.zoomCoordinator || '',
    guestSpeaker: event.guestSpeaker || '',
    reginaAvailable: event.reginaAvailable || '',
    health: event.health || 'not-started',
  }
}

/** Floating edit modal for an event — form fields + checklist + comments/@mentions. */
export default function EventCard({ event, onClose, onChanged, onDeleted }) {
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(() => draftFromEvent(event))
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)
  const { options: categoryOptions, addCategory, renameCategory, deleteCategory } =
    useEventCategories()

  useEffect(() => {
    setDraft(draftFromEvent(event))
  }, [event.id])

  const selectCategory = async (value, apply) => {
    if (value === '__manage_categories__') {
      setManageCategoriesOpen(true)
      return
    }
    if (value !== '__add_category__') {
      apply(value)
      return
    }
    const name = window.prompt('New category name')
    if (!name || !name.trim()) return
    const added = await addCategory(name)
    if (added) apply(added)
  }

  const renameAndSync = async (category, newName) => {
    await renameCategory(category, newName)
    if (draft.type === category.value) setDraft((d) => ({ ...d, type: newName.trim() }))
    onChanged?.()
  }

  const deleteAndSync = async (category) => {
    await deleteCategory(category)
    onChanged?.()
  }

  const save = async () => {
    if (!draft.name.trim() || saving) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'trackerEvents', event.id), {
        name: draft.name.trim(),
        eventDate: draft.eventDate,
        time: draft.time.trim(),
        timeZone: draft.timeZone.trim(),
        marketingDate: draft.marketingDate,
        venue: draft.venue.trim(),
        type: draft.type,
        eventType: draft.eventType,
        lead: draft.lead,
        instructor: draft.instructor.trim(),
        moderator: draft.moderator.trim(),
        zoomCoordinator: draft.zoomCoordinator.trim(),
        guestSpeaker: draft.guestSpeaker.trim(),
        reginaAvailable: draft.reginaAvailable.trim(),
        health: draft.health,
      })
      onChanged?.()
      onClose?.()
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
    onClose?.()
  }

  return (
    <>
    <Modal
      open
      onClose={handleClose}
      title={`Editing · ${event.name}`}
      size="xl"
      busy={saving}
      footer={
        <>
          <button type="button" className="hae-btn-secondary" onClick={removeEvent} disabled={saving}>
            Delete
          </button>
          <button type="button" className="hae-btn-secondary" onClick={handleClose} disabled={saving}>
            Close
          </button>
          <button
            type="button"
            className="hae-btn disabled:opacity-60"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
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
          <Field label="Time">
            <input
              className={fieldClass}
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            />
          </Field>
          <Field label="Time Zone">
            <input
              className={fieldClass}
              value={draft.timeZone}
              onChange={(e) => setDraft({ ...draft, timeZone: e.target.value })}
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
          <Field label="Category">
            <select
              className={fieldClass}
              value={draft.type}
              onChange={(e) => selectCategory(e.target.value, (v) => setDraft((d) => ({ ...d, type: v })))}
            >
              <option value="">Select category</option>
              {categoryOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
              <option value="__add_category__">+ Add category</option>
              <option value="__manage_categories__">Manage categories…</option>
            </select>
          </Field>
          <Field label="Event Type">
            <select
              className={fieldClass}
              value={draft.eventType}
              onChange={(e) => setDraft({ ...draft, eventType: e.target.value })}
            >
              <option value="">Select event type</option>
              {EVENT_KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
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
          <Field label="Instructor">
            <input
              className={fieldClass}
              value={draft.instructor}
              onChange={(e) => setDraft({ ...draft, instructor: e.target.value })}
            />
          </Field>
          <Field label="Moderator / Discussion Moderator">
            <input
              className={fieldClass}
              value={draft.moderator}
              onChange={(e) => setDraft({ ...draft, moderator: e.target.value })}
            />
          </Field>
          <Field label="Zoom Coordinator">
            <input
              className={fieldClass}
              value={draft.zoomCoordinator}
              onChange={(e) => setDraft({ ...draft, zoomCoordinator: e.target.value })}
            />
          </Field>
          <Field label="Guest Speaker">
            <input
              className={fieldClass}
              value={draft.guestSpeaker}
              onChange={(e) => setDraft({ ...draft, guestSpeaker: e.target.value })}
            />
          </Field>
          <Field label="Is Regina available?">
            <input
              className={fieldClass}
              value={draft.reginaAvailable}
              onChange={(e) => setDraft({ ...draft, reginaAvailable: e.target.value })}
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
        <div className="space-y-4 border-t border-hae-line/60 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <div>
            <h4 className="mb-2 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              Checklist
            </h4>
            <EventChecklist eventId={event.id} />
          </div>
          <div className="border-t border-hae-line/60 pt-4">
            <CommentsPanel parentType="trackerEvents" parentId={event.id} parentName={event.name} />
          </div>
        </div>
      </div>
    </Modal>
    <CategoryManagerModal
      open={manageCategoriesOpen}
      onClose={() => setManageCategoriesOpen(false)}
      options={categoryOptions}
      onRename={renameAndSync}
      onDelete={deleteAndSync}
    />
    </>
  )
}
