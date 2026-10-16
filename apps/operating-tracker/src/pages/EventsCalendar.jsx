import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { downloadIcs, FEATURES, useFeatures } from '@hae/ui'
import { db } from '../firebase'
import { useEventCategories } from '../hooks/useEventCategories'
import { formatDate, namesLabel } from '../utils'

const UNCATEGORIZED_CLASS = 'bg-gray-200 text-black'

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

function eventTimeLabel(event) {
  if (!event.time) return 'No time'
  return event.timeZone ? `${event.time} ${event.timeZone}` : event.time
}

export default function EventsCalendar() {
  const { isEnabled } = useFeatures()
  const canExportCalendar = isEnabled(FEATURES.CALENDAR_EXPORT)
  const navigate = useNavigate()
  const { options: categoryOptions } = useEventCategories()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const snap = await getDocs(collection(db, 'trackerEvents'))
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setLoadError(err.message || 'Failed to load events calendar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byEventDate = useMemo(() => {
    const map = new Map()
    for (const event of events) {
      if (!event.eventDate) continue
      const list = map.get(event.eventDate) || []
      list.push(event)
      map.set(event.eventDate, list)
    }
    for (const list of map.values()) list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return map
  }, [events])

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth])
  const todayIso = toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())

  const selectedEvents = useMemo(() => {
    if (!selectedDay) return []
    return byEventDate.get(selectedDay) || []
  }, [byEventDate, selectedDay])

  const eventsInView = useMemo(() => {
    const prefix = `${viewYear}-${pad2(viewMonth + 1)}-`
    return events.filter((event) => event.eventDate?.startsWith(prefix))
  }, [events, viewYear, viewMonth])

  const categoryByValue = useMemo(() => {
    const map = new Map()
    categoryOptions.forEach((c) => map.set(c.value, c))
    return map
  }, [categoryOptions])

  const categoryClass = (event) => categoryByValue.get(event.type)?.className || UNCATEGORIZED_CLASS

  // Legend shows only the categories that appear in the visible month.
  const legendCategories = useMemo(() => {
    const seen = new Map()
    for (const event of eventsInView) {
      const key = event.type || ''
      if (seen.has(key)) continue
      const category = categoryByValue.get(event.type)
      seen.set(key, {
        key,
        label: category?.label || event.type || 'Uncategorized',
        className: category?.className || UNCATEGORIZED_CLASS,
      })
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [eventsInView, categoryByValue])

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

  const openEvent = (event) => navigate(`/events-dashboard?event=${event.id}`)

  const exportIcs = () => {
    if (!eventsInView.length) return
    downloadIcs(
      'hae-events-calendar.ics',
      eventsInView.map((event) => ({
        uid: `event-${event.id}@hae-operating-tracker`,
        title: event.name || 'Event',
        date: event.eventDate,
        description: [
          event.time ? `Time: ${eventTimeLabel(event)}` : '',
          event.venue ? `Venue: ${event.venue}` : '',
          namesLabel(event.lead) ? `HAE Lead: ${namesLabel(event.lead)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      })),
      { calName: 'HAE Events Calendar' }
    )
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading events calendar…</p>
  if (loadError) {
    return (
      <p className="text-sm text-hae-crimson">
        Couldn't load the events calendar: {loadError}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Events Calendar</h1>
          <p className="mt-1 text-sm text-hae-slate">
            {eventsInView.length} event{eventsInView.length === 1 ? '' : 's'} in{' '}
            {monthLabel(viewYear, viewMonth)} from the Events &amp; Programs Dashboard.
          </p>
        </div>
        {canExportCalendar ? (
          <button
            type="button"
            onClick={exportIcs}
            disabled={!eventsInView.length}
            className="hae-btn-secondary disabled:opacity-50"
          >
            Export .ics
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
        {legendCategories.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] font-semibold text-hae-slate">
            {legendCategories.map((c) => (
              <span key={c.key} className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${c.className}`} /> {c.label}
              </span>
            ))}
          </div>
        ) : null}
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
            const dayEvents = byEventDate.get(cell.iso) || []
            const isToday = cell.iso === todayIso
            const isSelected = cell.iso === selectedDay
            const visible = dayEvents.slice(0, 3)
            const more = dayEvents.length - visible.length

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
                  {visible.map((event) => (
                    <div
                      key={event.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight ${categoryClass(event)}`}
                      title={event.type ? `${event.name} · ${event.type}` : event.name}
                    >
                      {event.name}
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
        <div className="border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold text-hae-ink">
            {selectedDay ? formatDate(selectedDay) : 'Select a day'}
          </h2>
        </div>
        {!selectedDay ? (
          <p className="px-4 py-6 text-sm text-hae-slate">Click a day to see its events.</p>
        ) : selectedEvents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">No events on this day.</p>
        ) : (
          <ul className="divide-y divide-hae-line">
            {selectedEvents.map((event) => (
              <li key={event.id} className="px-4 py-3 hover:bg-hae-mist/40">
                <div className="flex items-start gap-3">
                  <div className="w-16 shrink-0 pt-0.5 text-[11px] font-semibold uppercase text-hae-slate">
                    {eventTimeLabel(event)}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEvent(event)}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm font-semibold text-hae-ink">{event.name}</div>
                    {event.type ? (
                      <span
                        className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${categoryClass(event)}`}
                      >
                        {categoryByValue.get(event.type)?.label || event.type}
                      </span>
                    ) : null}
                    {event.venue ? (
                      <div className="text-xs text-hae-slate">{event.venue}</div>
                    ) : null}
                    {namesLabel(event.lead) ? (
                      <div className="text-xs text-hae-slate">
                        HAE Lead: {namesLabel(event.lead)}
                      </div>
                    ) : null}
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3 pl-[4.75rem]">
                  <button
                    type="button"
                    onClick={() => openEvent(event)}
                    className="text-xs font-semibold text-hae-crimson"
                  >
                    View event →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
      </div>
    </div>
  )
}
