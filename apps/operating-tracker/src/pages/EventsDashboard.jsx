import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Modal, timeOfDayGreeting } from '@hae/ui'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase'
import LeadSelect from '../components/LeadSelect'
import EventCard from '../components/EventCard'
import ModuleImportPanel from '../components/ModuleImportPanel'
import { EVENT_FORMAT_OPTIONS, EVENT_TYPE_OPTIONS, HEALTH_OPTIONS } from '../constants'
import { eventTypeBadgeClass, groupEventsByWeek } from '../utils'

const emptyForm = {
  name: '',
  eventDate: '',
  type: '',
  lead: [],
  instructor: '',
  moderator: '',
  zoomCoordinator: '',
  time: '',
  timeZone: '',
  guestSpeaker: '',
  reginaAvailable: '',
  venue: '',
  format: '',
  marketingDate: '',
  health: 'not-started',
}

const cellInputClass =
  'w-full min-w-[7rem] rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-hae-ink outline-none hover:border-hae-line focus:border-hae-crimson focus:bg-white'

const cellSelectClass =
  'w-full min-w-[7rem] rounded border border-transparent px-1.5 py-1 text-[11px] font-medium outline-none hover:border-hae-line focus:border-hae-crimson cursor-pointer'

const COLUMN_COUNT = 15

function TextCell({ value, onChange, onCommit, placeholder }) {
  return (
    <input
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cellInputClass}
    />
  )
}

function DateCell({ value, onChange }) {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cellInputClass}
    />
  )
}

export default function EventsDashboard() {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [expandedId, setExpandedId] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'trackerEvents'))
    setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) =>
        (a.eventDate || '9999-99-99').localeCompare(b.eventDate || '9999-99-99')
      ),
    [events]
  )

  const weekGroups = useMemo(() => groupEventsByWeek(sortedEvents), [sortedEvents])

  const expandedEvent = useMemo(
    () => sortedEvents.find((event) => event.id === expandedId) || null,
    [sortedEvents, expandedId]
  )

  const updateField = useCallback((id, field, value) => {
    setEvents((prev) => prev.map((ev) => (ev.id === id ? { ...ev, [field]: value } : ev)))
  }, [])

  const commitField = useCallback((id, field, value) => {
    updateDoc(doc(db, 'trackerEvents', id), { [field]: value }).catch(() => {})
  }, [])

  const setAndCommit = useCallback(
    (id, field, value) => {
      updateField(id, field, value)
      commitField(id, field, value)
    },
    [updateField, commitField]
  )

  const close = () => {
    if (saving) return
    setOpen(false)
    setForm(emptyForm)
  }

  const openAdd = () => {
    setForm(emptyForm)
    setOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const maxOrder = events.reduce((m, ev) => Math.max(m, ev.order ?? 0), 0)
      await addDoc(collection(db, 'trackerEvents'), {
        name: form.name.trim(),
        eventDate: form.eventDate,
        type: form.type,
        lead: form.lead,
        instructor: form.instructor.trim(),
        moderator: form.moderator.trim(),
        zoomCoordinator: form.zoomCoordinator.trim(),
        time: form.time.trim(),
        timeZone: form.timeZone.trim(),
        guestSpeaker: form.guestSpeaker.trim(),
        reginaAvailable: form.reginaAvailable.trim(),
        venue: form.venue.trim(),
        format: form.format,
        marketingDate: form.marketingDate,
        health: form.health,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setOpen(false)
      setForm(emptyForm)
      load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading events dashboard…</p>

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hae-line pb-6">
        <div>
          {userProfile?.name && (
            <p className="font-display text-xl text-hae-ink">
              {timeOfDayGreeting()}, {userProfile.name}
            </p>
          )}
          <p className="mt-2 text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
            Harvard Alumni Entrepreneurs
          </p>
          <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
            Events & Programs Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-hae-slate">
            Every HAE event at a glance, grouped by week — click any cell to edit it directly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="hae-btn-secondary" onClick={() => setImportOpen(true)}>
            Import Events & Programs
          </button>
          <button type="button" className="hae-btn" onClick={openAdd}>
            + Add an Event
          </button>
        </div>
      </header>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Events & Programs"
      >
        <ModuleImportPanel
          moduleIds={['events']}
          defaultModuleId="events"
          compact
          onImported={() => {
            load()
          }}
        />
      </Modal>

      <Modal
        open={open}
        onClose={close}
        title="Add an event"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="event-dashboard-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Create event'}
            </button>
          </>
        }
      >
        <form id="event-dashboard-form" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium text-hae-slate">Complete Event Title</span>
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
            <span className="text-xs font-medium text-hae-slate">Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            >
              <option value="">Select type</option>
              {EVENT_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">HAE Lead</span>
            <LeadSelect value={form.lead} onChange={(lead) => setForm({ ...form, lead })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Instructor</span>
            <input
              value={form.instructor}
              onChange={(e) => setForm({ ...form, instructor: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Moderator / Discussion Moderator</span>
            <input
              value={form.moderator}
              onChange={(e) => setForm({ ...form, moderator: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Zoom Coordinator</span>
            <input
              value={form.zoomCoordinator}
              onChange={(e) => setForm({ ...form, zoomCoordinator: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Time</span>
            <input
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Time Zone</span>
            <input
              value={form.timeZone}
              onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Guest Speaker</span>
            <input
              value={form.guestSpeaker}
              onChange={(e) => setForm({ ...form, guestSpeaker: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Is Regina available?</span>
            <input
              value={form.reginaAvailable}
              onChange={(e) => setForm({ ...form, reginaAvailable: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
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
            <span className="text-xs font-medium text-hae-slate">Date of Marketing</span>
            <input
              type="date"
              value={form.marketingDate}
              onChange={(e) => setForm({ ...form, marketingDate: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Marketing Status</span>
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
      </Modal>

      <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
        <table className="w-full min-w-[1600px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Date of Event</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Complete Event Title</th>
              <th className="px-3 py-2 font-semibold">HAE Lead</th>
              <th className="px-3 py-2 font-semibold">Instructor</th>
              <th className="px-3 py-2 font-semibold">Moderator / Discussion Moderator</th>
              <th className="px-3 py-2 font-semibold">Zoom Coordinator</th>
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Time Zone</th>
              <th className="px-3 py-2 font-semibold">Guest Speaker</th>
              <th className="px-3 py-2 font-semibold">Is Regina available?</th>
              <th className="px-3 py-2 font-semibold">Online or In-Person</th>
              <th className="px-3 py-2 font-semibold">Date of Marketing</th>
              <th className="px-3 py-2 font-semibold">Marketing Status</th>
              <th className="px-3 py-2 font-semibold">Checklist</th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No events yet.
                </td>
              </tr>
            ) : (
              weekGroups.map((group) => (
                <Fragment key={group.key}>
                  <tr className="bg-hae-mist border-b border-hae-line">
                    <td
                      colSpan={COLUMN_COUNT}
                      className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-hae-ink uppercase"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.events.map((event) => (
                    <tr
                      key={event.id}
                      className={`border-b border-hae-line/70 hover:bg-hae-mist/40 ${
                        expandedId === event.id ? 'bg-hae-mist/40' : ''
                      }`}
                    >
                      <td className="px-1 py-1">
                        <DateCell
                          value={event.eventDate}
                          onChange={(v) => setAndCommit(event.id, 'eventDate', v)}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={event.type || ''}
                          onChange={(e) => setAndCommit(event.id, 'type', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`${cellSelectClass} ${eventTypeBadgeClass(event.type)}`}
                        >
                          <option value="">—</option>
                          {EVENT_TYPE_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <TextCell
                          value={event.name}
                          onChange={(v) => updateField(event.id, 'name', v)}
                          onCommit={(v) => commitField(event.id, 'name', v.trim())}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <LeadSelect
                          value={event.lead}
                          onChange={(lead) => setAndCommit(event.id, 'lead', lead)}
                          className={cellInputClass}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <TextCell
                          value={event.instructor}
                          onChange={(v) => updateField(event.id, 'instructor', v)}
                          onCommit={(v) => commitField(event.id, 'instructor', v.trim())}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <TextCell
                          value={event.moderator}
                          onChange={(v) => updateField(event.id, 'moderator', v)}
                          onCommit={(v) => commitField(event.id, 'moderator', v.trim())}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <TextCell
                          value={event.zoomCoordinator}
                          onChange={(v) => updateField(event.id, 'zoomCoordinator', v)}
                          onCommit={(v) => commitField(event.id, 'zoomCoordinator', v.trim())}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <TextCell
                          value={event.time}
                          onChange={(v) => updateField(event.id, 'time', v)}
                          onCommit={(v) => commitField(event.id, 'time', v.trim())}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <TextCell
                          value={event.timeZone}
                          onChange={(v) => updateField(event.id, 'timeZone', v)}
                          onCommit={(v) => commitField(event.id, 'timeZone', v.trim())}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <TextCell
                          value={event.guestSpeaker}
                          onChange={(v) => updateField(event.id, 'guestSpeaker', v)}
                          onCommit={(v) => commitField(event.id, 'guestSpeaker', v.trim())}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <TextCell
                          value={event.reginaAvailable}
                          onChange={(v) => updateField(event.id, 'reginaAvailable', v)}
                          onCommit={(v) => commitField(event.id, 'reginaAvailable', v.trim())}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={event.format || ''}
                          onChange={(e) => setAndCommit(event.id, 'format', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={cellSelectClass}
                        >
                          <option value="">—</option>
                          {EVENT_FORMAT_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <DateCell
                          value={event.marketingDate}
                          onChange={(v) => setAndCommit(event.id, 'marketingDate', v)}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={event.health || 'not-started'}
                          onChange={(e) => setAndCommit(event.id, 'health', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={cellSelectClass}
                        >
                          {HEALTH_OPTIONS.map((h) => (
                            <option key={h.value} value={h.value}>
                              {h.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1 text-center">
                        <button
                          type="button"
                          className="text-xs text-hae-slate underline hover:text-hae-crimson"
                          onClick={() => setExpandedId(event.id)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {expandedEvent ? (
        <EventCard
          event={expandedEvent}
          onClose={() => setExpandedId(null)}
          onChanged={load}
          onDeleted={() => {
            setExpandedId(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
