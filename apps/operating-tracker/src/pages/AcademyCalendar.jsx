import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toIsoDate(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toIsoDate(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${pad2(m)} ${period}`
}

function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return ''
  if (startTime && endTime) return `${formatTime(startTime)}–${formatTime(endTime)}`
  return formatTime(startTime || endTime)
}

function buildMonthCells(year, monthIndex) {
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, iso: toIsoDate(year, monthIndex, day) })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const emptyForm = {
  name: '',
  eventDate: '',
  time: '',
  location: '',
  notes: '',
  startTime: '',
  endTime: '',
}

export default function AcademyCalendar() {
  const { isStaff } = useAuth()
  const navigate = useNavigate()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [events, setEvents] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingKind, setEditingKind] = useState('event')
  const [form, setForm] = useState(emptyForm)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [eventSnap, programSnap] = await Promise.all([
        getDocs(collection(db, 'academyEvents')),
        getDocs(collection(db, 'academyPrograms')),
      ])
      setEvents(eventSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setPrograms(programSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setLoadError(err.message || 'Failed to load academy calendar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const items = useMemo(() => {
    const fromEvents = events
      .filter((event) => event.eventDate)
      .map((event) => ({
        id: event.id,
        kind: 'event',
        name: event.name,
        eventDate: event.eventDate,
        time: event.time,
        location: event.location,
        notes: event.notes,
      }))
    const fromPrograms = programs
      .filter((program) => program.startDate)
      .flatMap((program) => {
        const totalWeeks = Number(program.durationWeeks) > 0 ? Number(program.durationWeeks) : 1
        const timeRange = formatTimeRange(program.startTime, program.endTime)
        return Array.from({ length: totalWeeks }, (_, i) => ({
          id: program.id,
          kind: 'program',
          name: program.name,
          label: `${i + 1} of ${totalWeeks} – ${program.name}${timeRange ? ` (${timeRange})` : ''}`,
          eventDate: addDaysIso(program.startDate, i * 7),
          startDate: program.startDate,
          startTime: program.startTime,
          endTime: program.endTime,
          timeRange,
        }))
      })
    return [...fromEvents, ...fromPrograms]
  }, [events, programs])

  const byEventDate = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      const list = map.get(item.eventDate) || []
      list.push(item)
      map.set(item.eventDate, list)
    }
    for (const list of map.values()) list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return map
  }, [items])

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth])
  const todayIso = toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())

  const selectedEvents = useMemo(() => {
    if (!selectedDay) return []
    return byEventDate.get(selectedDay) || []
  }, [byEventDate, selectedDay])

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
    setSelectedDay(null)
  }

  const goToday = () => {
    const t = new Date()
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
    setSelectedDay(toIsoDate(t.getFullYear(), t.getMonth(), t.getDate()))
  }

  const close = () => {
    if (saving) return
    setOpen(false)
    setEditingId(null)
    setEditingKind('event')
    setForm(emptyForm)
  }

  const openAdd = (iso) => {
    setEditingId(null)
    setEditingKind('event')
    setForm({ ...emptyForm, eventDate: iso || selectedDay || '' })
    setOpen(true)
  }

  const openEdit = (item) => {
    setEditingId(item.id)
    setEditingKind(item.kind)
    setForm({
      name: item.name || '',
      eventDate: (item.kind === 'program' ? item.startDate : item.eventDate) || '',
      time: item.time || '',
      location: item.location || '',
      notes: item.notes || '',
      startTime: item.startTime || '',
      endTime: item.endTime || '',
    })
    setOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.eventDate || saving) return
    setSaving(true)
    try {
      if (editingKind === 'program') {
        await updateDoc(doc(db, 'academyPrograms', editingId), {
          name: form.name.trim(),
          startDate: form.eventDate,
          startTime: form.startTime,
          endTime: form.endTime,
        })
      } else {
        const payload = {
          name: form.name.trim(),
          eventDate: form.eventDate,
          time: form.time.trim(),
          location: form.location.trim(),
          notes: form.notes.trim(),
        }
        if (editingId) {
          await updateDoc(doc(db, 'academyEvents', editingId), payload)
        } else {
          await addDoc(collection(db, 'academyEvents'), {
            ...payload,
            createdAt: serverTimestamp(),
          })
        }
      }
      close()
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!editingId || saving || editingKind !== 'event') return
    if (!confirm('Delete this course date? This action cannot be undone.')) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'academyEvents', editingId))
      close()
      load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading academy calendar…</p>
  if (loadError) {
    return (
      <p className="text-sm text-hae-crimson">
        Couldn't load the academy calendar: {loadError}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Academy Calendar</h1>
          <p className="mt-1 text-sm text-hae-slate">
            Course start dates and event dates for {monthLabel(viewYear, viewMonth)} — separate
            from the main Operations Calendar.
          </p>
        </div>
        {isStaff ? (
          <button type="button" onClick={() => openAdd(null)} className="hae-btn">
            + Add course date
          </button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="border border-hae-line px-3 py-1.5 text-xs font-semibold text-hae-ink"
          aria-label="Previous month"
        >
          ←
        </button>
        <h2 className="min-w-[10rem] text-center font-display text-xl text-hae-ink">
          {monthLabel(viewYear, viewMonth)}
        </h2>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="border border-hae-line px-3 py-1.5 text-xs font-semibold text-hae-ink"
          aria-label="Next month"
        >
          →
        </button>
        <button
          type="button"
          onClick={goToday}
          className="border border-hae-line px-3 py-1.5 text-xs font-semibold text-hae-crimson"
        >
          Today
        </button>
        <div className="ml-auto flex items-center gap-3 text-[11px] font-semibold text-hae-slate">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-hae-ink" /> Course week
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-hae-crimson" /> Calendar event
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="overflow-hidden border border-hae-line bg-white lg:flex-1">
        <div className="grid grid-cols-7 border-b border-hae-line bg-hae-mist/80">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-1 py-2 text-center text-[11px] font-semibold tracking-wide text-hae-slate uppercase"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[5.5rem] border-b border-r border-hae-line/60 bg-hae-mist/30 sm:min-h-[7rem]"
                />
              )
            }
            const dayItems = byEventDate.get(cell.iso) || []
            const isToday = cell.iso === todayIso
            const isSelected = cell.iso === selectedDay
            const visible = dayItems.slice(0, 3)
            const more = dayItems.length - visible.length

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedDay(cell.iso)}
                className={`min-h-[5.5rem] border-b border-r border-hae-line/60 p-1.5 text-left align-top transition-colors sm:min-h-[7rem] ${
                  isSelected
                    ? 'bg-hae-crimson/5 ring-2 ring-inset ring-hae-crimson'
                    : isToday
                      ? 'bg-white ring-1 ring-inset ring-hae-crimson/40'
                      : 'bg-white hover:bg-hae-mist/40'
                }`}
              >
                <div
                  className={`mb-1 text-xs font-semibold ${
                    isToday ? 'text-hae-crimson' : 'text-hae-ink'
                  }`}
                >
                  {cell.day}
                </div>
                <div className="space-y-0.5">
                  {visible.map((item) => (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className={`truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight text-white ${
                        item.kind === 'program' ? 'bg-hae-ink' : 'bg-hae-crimson'
                      }`}
                      title={item.kind === 'program' ? item.label : item.name}
                    >
                      {item.kind === 'program' ? item.label : item.name}
                    </div>
                  ))}
                  {more > 0 ? (
                    <div className="px-1 text-[10px] font-semibold text-hae-slate">
                      +{more} more
                    </div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <aside className="w-full shrink-0 border border-hae-line bg-white lg:sticky lg:top-4 lg:w-80">
        <div className="flex items-center justify-between border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold text-hae-ink">
            {selectedDay ? formatDate(selectedDay) : 'Select a day'}
          </h2>
          {isStaff && selectedDay ? (
            <button
              type="button"
              onClick={() => openAdd(selectedDay)}
              className="text-xs font-semibold text-hae-crimson"
            >
              + Add
            </button>
          ) : null}
        </div>
        {!selectedDay ? (
          <p className="px-4 py-6 text-sm text-hae-slate">
            Click a day to see or add Academy course dates.
          </p>
        ) : selectedEvents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">No course dates on this day.</p>
        ) : (
          <ul className="divide-y divide-hae-line">
            {selectedEvents.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="px-4 py-3 hover:bg-hae-mist/40">
                <div className="flex items-start gap-3">
                  <div className="w-16 shrink-0 pt-0.5 text-[11px] font-semibold uppercase text-hae-slate">
                    {item.kind === 'program'
                      ? item.timeRange || 'All day'
                      : item.time || 'No time'}
                  </div>
                  <button
                    type="button"
                    onClick={() => (isStaff ? openEdit(item) : null)}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm font-semibold text-hae-ink">
                      {item.kind === 'program' ? item.label : item.name}
                    </div>
                    {item.kind === 'event' && item.location ? (
                      <div className="text-xs text-hae-slate">{item.location}</div>
                    ) : null}
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3 pl-[4.75rem]">
                  {item.kind === 'program' ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/academy/${item.id}`)}
                      className="text-xs font-semibold text-hae-slate hover:text-hae-ink"
                    >
                      View course →
                    </button>
                  ) : null}
                  {isStaff ? (
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="text-xs font-semibold text-hae-crimson"
                    >
                      Edit →
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
      </div>

      <Modal
        open={open}
        onClose={close}
        title={
          editingKind === 'program'
            ? 'Edit course start date'
            : editingId
              ? 'Edit course date'
              : 'Add course date'
        }
        busy={saving}
        footer={
          <>
            {editingId && editingKind === 'event' ? (
              <button
                type="button"
                className="hae-btn-secondary border-hae-crimson text-hae-crimson"
                onClick={remove}
                disabled={saving}
              >
                Delete
              </button>
            ) : null}
            <button type="button" className="hae-btn-secondary" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="academy-calendar-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add course date'}
            </button>
          </>
        }
      >
        <form id="academy-calendar-form" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {editingKind === 'program' ? (
            <p className="text-xs text-hae-slate sm:col-span-2">
              This edits the Academy course's own record — changes here sync directly to the
              course's page.
            </p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium text-hae-slate">
              {editingKind === 'program' ? 'Course name' : 'Course / event name'}
            </span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">
              {editingKind === 'program' ? 'Start date' : 'Date'}
            </span>
            <input
              required
              type="date"
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            />
          </label>
          {editingKind === 'program' ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Start time</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">End time</span>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : null}
          {editingKind === 'event' ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Time</span>
                <input
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  placeholder="e.g. 6:00 PM ET"
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium text-hae-slate">Location / link</span>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium text-hae-slate">Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : null}
        </form>
      </Modal>
    </div>
  )
}
