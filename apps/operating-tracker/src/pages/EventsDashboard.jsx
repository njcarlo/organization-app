import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore'
import { Modal, timeOfDayGreeting } from '@hae/ui'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase'
import LeadSelect from '../components/LeadSelect'
import EventCard from '../components/EventCard'
import ModuleImportPanel from '../components/ModuleImportPanel'
import CategoryManagerModal from '../components/CategoryManagerModal'
import { useEventCategories } from '../hooks/useEventCategories'
import { EVENT_KIND_OPTIONS, HEALTH_OPTIONS } from '../constants'
import {
  formatLongDate,
  groupEventsByWeek,
  healthBadgeClass,
  healthLabel,
  namesLabel,
} from '../utils'

const emptyForm = {
  name: '',
  eventDate: '',
  type: '',
  eventType: '',
  lead: [],
  instructor: '',
  moderator: '',
  zoomCoordinator: '',
  time: '',
  timeZone: '',
  guestSpeaker: '',
  reginaAvailable: '',
  venue: '',
  marketingDate: '',
  health: 'not-started',
}

const COLUMN_COUNT = 14

export default function EventsDashboard({ sectionReadOnly = false }) {
  const { userProfile } = useAuth()
  const { options: categoryOptions, addCategory, renameCategory, deleteCategory, setCategoryColor } =
    useEventCategories()
  const categoryByValue = useMemo(() => {
    const map = new Map()
    categoryOptions.forEach((c) => map.set(c.value, c))
    return map
  }, [categoryOptions])
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [expandedId, setExpandedId] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [deleting, setDeleting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'trackerEvents'))
    setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const eventId = searchParams.get('event')
    if (!eventId || !events.length) return
    const target = events.find((e) => e.id === eventId)
    if (target) setExpandedId(target.id)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('event')
        return next
      },
      { replace: true }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, searchParams])

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) =>
        (a.eventDate || '9999-99-99').localeCompare(b.eventDate || '9999-99-99')
      ),
    [events]
  )

  const weekGroups = useMemo(() => groupEventsByWeek(sortedEvents), [sortedEvents])

  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const { archivedGroups, visibleGroups } = useMemo(() => {
    const archived = []
    const visible = []
    for (const group of weekGroups) {
      if (group.end && group.end < todayStart) archived.push(group)
      else visible.push(group)
    }
    return { archivedGroups: archived, visibleGroups: visible }
  }, [weekGroups, todayStart])

  const archivedEventCount = useMemo(
    () => archivedGroups.reduce((n, g) => n + g.events.length, 0),
    [archivedGroups]
  )

  const displayedGroups = showArchived ? weekGroups : visibleGroups

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

  const renameAndReload = async (category, newName) => {
    await renameCategory(category, newName)
    await load()
  }

  const deleteAndReload = async (category) => {
    await deleteCategory(category)
    await load()
  }

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = sortedEvents.length > 0 && selectedIds.size === sortedEvents.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sortedEvents.map((event) => event.id)))
  }

  const deleteSelected = async () => {
    if (sectionReadOnly || deleting || selectedIds.size === 0) return
    if (
      !confirm(
        `Delete ${selectedIds.size} event${selectedIds.size === 1 ? '' : 's'}? Their checklists are not cascade-deleted. This action cannot be undone.`
      )
    )
      return
    setDeleting(true)
    try {
      await Promise.all([...selectedIds].map((id) => deleteDoc(doc(db, 'trackerEvents', id))))
      setSelectedIds(new Set())
      if (expandedId && selectedIds.has(expandedId)) setExpandedId(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (sectionReadOnly || !form.name.trim() || saving) return
    setSaving(true)
    try {
      const maxOrder = events.reduce((m, ev) => Math.max(m, ev.order ?? 0), 0)
      await addDoc(collection(db, 'trackerEvents'), {
        name: form.name.trim(),
        eventDate: form.eventDate,
        type: form.type,
        eventType: form.eventType,
        lead: form.lead,
        instructor: form.instructor.trim(),
        moderator: form.moderator.trim(),
        zoomCoordinator: form.zoomCoordinator.trim(),
        time: form.time.trim(),
        timeZone: form.timeZone.trim(),
        guestSpeaker: form.guestSpeaker.trim(),
        reginaAvailable: form.reginaAvailable.trim(),
        venue: form.venue.trim(),
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
            Every HAE event at a glance, grouped by week — click a row to open, edit, and comment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && !sectionReadOnly ? (
            <button
              type="button"
              className="hae-btn-secondary border-hae-crimson text-hae-crimson disabled:opacity-60"
              onClick={deleteSelected}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
            </button>
          ) : null}
          {archivedEventCount > 0 ? (
            <button
              type="button"
              className="hae-btn-secondary"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived
                ? 'Hide past weeks'
                : `Show past weeks (${archivedEventCount})`}
            </button>
          ) : null}
          {!sectionReadOnly ? (
            <button type="button" className="hae-btn-secondary" onClick={() => setImportOpen(true)}>
              Import Events & Programs
            </button>
          ) : null}
          {!sectionReadOnly ? (
            <button type="button" className="hae-btn" onClick={openAdd}>
              + Add an Event
            </button>
          ) : null}
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

      <CategoryManagerModal
        open={manageCategoriesOpen}
        onClose={() => setManageCategoriesOpen(false)}
        options={categoryOptions}
        onAdd={addCategory}
        onRename={renameAndReload}
        onDelete={deleteAndReload}
        onRecolor={setCategoryColor}
      />

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
            <span className="text-xs font-medium text-hae-slate">Category</span>
            <select
              value={form.type}
              onChange={(e) => selectCategory(e.target.value, (v) => setForm((f) => ({ ...f, type: v })))}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
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
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Event Type</span>
            <select
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            >
              <option value="">Select event type</option>
              {EVENT_KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
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
        <table className="w-full min-w-[1500px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">
                {!sectionReadOnly && (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleSelectAll}
                    aria-label="Select all events"
                  />
                )}
              </th>
              <th className="px-3 py-2 font-semibold">Date of Event</th>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 font-semibold">Event Type</th>
              <th className="px-3 py-2 font-semibold">Complete Event Title</th>
              <th className="px-3 py-2 font-semibold">HAE Lead</th>
              <th className="px-3 py-2 font-semibold">Instructor</th>
              <th className="px-3 py-2 font-semibold">Moderator / Discussion Moderator</th>
              <th className="px-3 py-2 font-semibold">Zoom Coordinator</th>
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Time Zone</th>
              <th className="px-3 py-2 font-semibold">Guest Speaker</th>
              <th className="px-3 py-2 font-semibold">Date of Marketing</th>
              <th className="px-3 py-2 font-semibold">Marketing Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No events yet.
                </td>
              </tr>
            ) : displayedGroups.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-sm text-hae-slate">
                  All events are in past weeks.{' '}
                  <button
                    type="button"
                    className="font-semibold text-hae-crimson underline"
                    onClick={() => setShowArchived(true)}
                  >
                    Show past weeks
                  </button>
                </td>
              </tr>
            ) : (
              displayedGroups.map((group) => {
                const isArchived = group.end && group.end < todayStart
                return (
                <Fragment key={group.key}>
                  <tr className="bg-hae-mist border-b border-hae-line">
                    <td
                      colSpan={COLUMN_COUNT}
                      className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-hae-ink uppercase"
                    >
                      {group.label}
                      {isArchived ? (
                        <span className="ml-2 normal-case tracking-normal text-hae-slate">(archived)</span>
                      ) : null}
                    </td>
                  </tr>
                  {group.events.map((event) => (
                    <tr
                      key={event.id}
                      onClick={() => setExpandedId(event.id)}
                      className={`cursor-pointer border-b border-hae-line/70 hover:bg-hae-mist/40 ${
                        isArchived ? 'opacity-60' : ''
                      } ${
                        expandedId === event.id || selectedIds.has(event.id) ? 'bg-hae-mist/40' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-center">
                        {!sectionReadOnly && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(event.id)}
                            onChange={() => toggleSelected(event.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${event.name}`}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm whitespace-nowrap text-hae-ink">
                        {formatLongDate(event.eventDate)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${categoryByValue.get(event.type)?.className || 'bg-gray-200 text-black'}`}
                        >
                          {categoryByValue.get(event.type)?.label || event.type || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-ink">{event.eventType || '—'}</td>
                      <td className="px-3 py-2 text-sm font-medium text-hae-ink">{event.name}</td>
                      <td className="px-3 py-2 text-sm text-hae-ink">{namesLabel(event.lead) || '—'}</td>
                      <td className="px-3 py-2 text-sm text-hae-ink">{event.instructor || '—'}</td>
                      <td className="px-3 py-2 text-sm text-hae-ink">{event.moderator || '—'}</td>
                      <td className="px-3 py-2 text-sm text-hae-ink">{event.zoomCoordinator || '—'}</td>
                      <td className="px-3 py-2 text-sm text-hae-ink">{event.time || '—'}</td>
                      <td className="px-3 py-2 text-sm text-hae-ink">{event.timeZone || '—'}</td>
                      <td className="px-3 py-2 text-sm text-hae-ink">{event.guestSpeaker || '—'}</td>
                      <td className="px-3 py-2 text-sm whitespace-nowrap text-hae-ink">
                        {formatLongDate(event.marketingDate)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${healthBadgeClass(event.health)}`}
                        >
                          {healthLabel(event.health)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </Fragment>
                )
              })
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
          readOnly={sectionReadOnly}
        />
      ) : null}
    </div>
  )
}
