import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { Modal, timeOfDayGreeting } from '@hae/ui'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase'
import LeadSelect from '../components/LeadSelect'
import EventCard from '../components/EventCard'
import { EVENT_FORMAT_OPTIONS, HEALTH_OPTIONS } from '../constants'
import { formatDate, formatLongDate, healthBadgeClass, healthLabel, namesLabel } from '../utils'

const emptyForm = {
  name: '',
  eventDate: '',
  eventTime: '',
  marketingDate: '',
  venue: '',
  format: '',
  lead: [],
  health: 'not-started',
}

export default function EventsDashboard() {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [expandedId, setExpandedId] = useState(null)

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

  const expandedEvent = useMemo(
    () => sortedEvents.find((event) => event.id === expandedId) || null,
    [sortedEvents, expandedId]
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
        eventTime: form.eventTime.trim(),
        marketingDate: form.marketingDate,
        venue: form.venue.trim(),
        format: form.format,
        lead: form.lead,
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
            Every HAE event at a glance — click a row to expand its card and checklist.
          </p>
        </div>
        <button type="button" className="hae-btn" onClick={openAdd}>
          + Add an Event
        </button>
      </header>

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
        <table className="w-full sm:min-w-[960px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Event Name</th>
              <th className="px-3 py-2 font-semibold">Date of Event</th>
              <th className="hae-col-sm-hide px-3 py-2 font-semibold">Time of Event with Timezone</th>
              <th className="hae-col-sm-hide px-3 py-2 font-semibold">Date of Marketing</th>
              <th className="hae-col-sm-hide px-3 py-2 font-semibold">Online or In-Person</th>
              <th className="hae-col-sm-hide px-3 py-2 font-semibold">HAE Lead</th>
              <th className="px-3 py-2 font-semibold">Marketing Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No events yet.
                </td>
              </tr>
            ) : (
              sortedEvents.map((event) => (
                <tr
                  key={event.id}
                  onClick={() => setExpandedId((id) => (id === event.id ? null : event.id))}
                  className={`cursor-pointer border-b border-hae-line/70 hover:bg-hae-mist/40 ${
                    expandedId === event.id ? 'bg-hae-mist/40' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-sm font-medium text-hae-ink">{event.name}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {event.eventDate ? formatLongDate(event.eventDate) : '—'}
                  </td>
                  <td className="hae-col-sm-hide px-3 py-2 text-sm text-hae-slate">{event.eventTime || '—'}</td>
                  <td className="hae-col-sm-hide px-3 py-2 text-sm text-hae-slate">
                    {event.marketingDate ? formatDate(event.marketingDate) : '—'}
                  </td>
                  <td className="hae-col-sm-hide px-3 py-2 text-sm text-hae-slate">{event.format || '—'}</td>
                  <td className="hae-col-sm-hide px-3 py-2 text-sm text-hae-slate">{namesLabel(event.lead) || '—'}</td>
                  <td className="px-3 py-2 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${healthBadgeClass(event.health)}`}
                    >
                      {healthLabel(event.health)}
                    </span>
                  </td>
                </tr>
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
