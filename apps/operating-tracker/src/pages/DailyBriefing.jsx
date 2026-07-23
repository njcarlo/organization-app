import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import DraggableList from '../components/DraggableList'

const ET_ZONE = 'America/New_York'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function timeInZone(date, timeZone) {
  if (!date || Number.isNaN(date.getTime())) return ''
  try {
    return date.toLocaleTimeString(undefined, { timeZone, hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatLongDate(dateIso) {
  if (!dateIso) return ''
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(dateIso) {
  if (!dateIso) return ''
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function greetingWord() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Converts a wall-clock time entered for a given IANA zone into a real Date,
 * without a timezone library: guess the instant, read back what that instant
 * looks like in the target zone via Intl, then correct by the difference.
 */
function zonedTimeToDate(dateIso, timeStr, timeZone) {
  if (!dateIso || !timeStr) return null
  const [y, m, d] = dateIso.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(guess)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {})
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return new Date(guess.getTime() + (guess.getTime() - asIfUtc))
}

function getActiveTravel(dateIso, travelList) {
  if (!dateIso) return null
  return (
    travelList.find(
      (t) => t.startDate && t.endDate && dateIso >= t.startDate && dateIso <= t.endDate
    ) || null
  )
}

function localTimeLabel(date, travelEntry) {
  if (!date || !travelEntry) return null
  const time = timeInZone(date, travelEntry.timeZone)
  return time ? `${time} (${travelEntry.label})` : null
}

function nextOrder(list) {
  return list.reduce((m, it) => Math.max(m, it.order ?? 0), 0) + 1
}

function isValidTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone })
    return true
  } catch {
    return false
  }
}

const inputClass =
  'w-full rounded-md border border-hae-line px-2 py-1.5 text-sm outline-none focus:border-hae-crimson'

function SectionCard({ title, meta, editing, onToggleEdit, extra, children }) {
  return (
    <section className="rounded-xl border border-hae-line bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-hae-ink">{title}</h2>
          {meta ? <p className="text-xs text-hae-slate">{meta}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {extra}
          <button type="button" onClick={onToggleEdit} className="text-xs font-semibold text-hae-crimson">
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function DailyBriefing() {
  const { user, userProfile } = useAuth()
  const firstName = (userProfile?.name || '').split(' ')[0]
  const [selectedDate, setSelectedDate] = useState(todayIso())
  const [syncedMeetings, setSyncedMeetings] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showResolvedTrackers, setShowResolvedTrackers] = useState(false)
  const [showResolvedReminders, setShowResolvedReminders] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [meetingSnap, itemSnap] = await Promise.all([
        getDocs(collection(db, 'execInboxMeetings')),
        getDocs(collection(db, 'dailyBriefingItems')),
      ])
      setSyncedMeetings(meetingSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setItems(itemSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const meetingAgendas = useMemo(() => items.filter((i) => i.section === 'meetingAgenda'), [items])
  const majorMeetings = useMemo(
    () => items.filter((i) => i.section === 'majorMeeting').sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [items]
  )
  const trackers = useMemo(
    () => items.filter((i) => i.section === 'tracker').sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [items]
  )
  const reminders = useMemo(
    () => items.filter((i) => i.section === 'reminder').sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [items]
  )
  const travel = useMemo(
    () =>
      items
        .filter((i) => i.section === 'travel')
        .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')),
    [items]
  )

  const patchLocal = (id, fields) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...fields } : it)))

  const addItem = async (section, fields) => {
    const ref = await addDoc(collection(db, 'dailyBriefingItems'), {
      section,
      ...fields,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
      updatedAt: serverTimestamp(),
    })
    setItems((prev) => [...prev, { id: ref.id, section, ...fields }])
    return ref.id
  }

  const commitField = async (id, fields) => {
    patchLocal(id, fields)
    await updateDoc(doc(db, 'dailyBriefingItems', id), { ...fields, updatedAt: serverTimestamp() })
  }

  const removeItem = async (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
    await deleteDoc(doc(db, 'dailyBriefingItems', id))
  }

  const reorder = async (section, reordered) => {
    setItems((prev) => {
      const others = prev.filter((it) => it.section !== section)
      return [...others, ...reordered.map((it, idx) => ({ ...it, order: idx }))]
    })
    const batch = writeBatch(db)
    reordered.forEach((item, idx) => {
      batch.update(doc(db, 'dailyBriefingItems', item.id), { order: idx })
    })
    await batch.commit()
  }

  const activeTravelForSelectedDate = useMemo(
    () => getActiveTravel(selectedDate, travel),
    [selectedDate, travel]
  )

  const dayMeetings = useMemo(() => {
    const synced = syncedMeetings
      .filter((m) => (m.start || '').slice(0, 10) === selectedDate)
      .map((m) => ({
        key: `synced-${m.id}`,
        meetingId: m.id,
        title: m.title,
        start: m.start,
        htmlLink: m.htmlLink,
        agendaDoc:
          meetingAgendas.find((a) => a.meetingId === m.id && a.date === selectedDate) || null,
      }))
    const manual = meetingAgendas
      .filter((a) => !a.meetingId && a.date === selectedDate)
      .map((a) => ({
        key: `manual-${a.id}`,
        meetingId: null,
        title: a.title,
        start: a.start,
        htmlLink: null,
        agendaDoc: a,
      }))
    return [...synced, ...manual].sort((a, b) => (a.start || '').localeCompare(b.start || ''))
  }, [syncedMeetings, meetingAgendas, selectedDate])

  const addManualMeeting = () =>
    addItem('meetingAgenda', {
      meetingId: null,
      date: selectedDate,
      title: '',
      start: '',
      agenda: '',
    })

  const saveMeetingAgenda = async (row, fields) => {
    if (row.agendaDoc) {
      await commitField(row.agendaDoc.id, fields)
    } else {
      await addItem('meetingAgenda', {
        meetingId: row.meetingId,
        date: selectedDate,
        title: row.title,
        start: row.start,
        agenda: '',
        ...fields,
      })
    }
  }

  const buildCopyText = () => {
    const lines = []
    lines.push('MEETINGS TODAY')
    lines.push(formatLongDate(selectedDate))
    if (dayMeetings.length === 0) lines.push('No meetings today.')
    dayMeetings.forEach((m) => {
      const start = m.start ? new Date(m.start) : null
      const et = start ? `${timeInZone(start, ET_ZONE)} ET` : '—'
      const local = start ? localTimeLabel(start, activeTravelForSelectedDate) : null
      const agenda = m.agendaDoc?.agenda
      lines.push(
        `${et}${local ? ` / ${local}` : ''} — ${m.title || 'Untitled meeting'}${agenda ? `: ${agenda}` : ''}`
      )
    })
    lines.push('')
    lines.push('MAJOR MEETINGS AND EVENTS')
    if (majorMeetings.length === 0) lines.push('None.')
    majorMeetings.forEach((r) => {
      const start = zonedTimeToDate(r.date, r.timeET, ET_ZONE)
      const local = start ? localTimeLabel(start, getActiveTravel(r.date, travel)) : null
      lines.push(
        `${r.date || ''} ${r.timeET ? `${r.timeET} ET` : ''}${local ? ` / ${local}` : ''} — ${r.meeting || ''}${r.comments ? ` (${r.comments})` : ''}`
      )
    })
    lines.push('')
    lines.push('TRACKERS')
    const openTrackers = trackers.filter((t) => !t.resolved)
    if (openTrackers.length === 0) lines.push('None.')
    openTrackers.forEach((t) => {
      lines.push(`${t.title || ''}${t.link ? ` — ${t.link}` : ''}`)
      if (t.notes) lines.push(t.notes)
    })
    lines.push('')
    lines.push('EMAILS TO RESPOND / THINGS TO DO / REMINDERS')
    const openReminders = reminders.filter((r) => !r.resolved)
    if (openReminders.length === 0) lines.push('None.')
    openReminders.forEach((r) => {
      lines.push(`${r.date ? `${r.date} — ` : ''}${r.account ? `${r.account}: ` : ''}${r.subject || ''}`)
      if (r.body) lines.push(r.body)
      if (r.comments) lines.push(`RR: ${r.comments}`)
    })
    return lines.join('\n')
  }

  const copyBriefing = async () => {
    await navigator.clipboard.writeText(buildCopyText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading daily briefing…</p>

  const openTrackerCount = trackers.filter((t) => !t.resolved).length
  const openReminderCount = reminders.filter((r) => !r.resolved).length

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-hae-slate">{formatLongDate(todayIso())}</p>
            <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">
              {greetingWord()}
              {firstName ? `, ${firstName}` : ''}
            </h1>
          </div>
          <button
            type="button"
            onClick={copyBriefing}
            className="rounded-md border border-hae-line px-3 py-2 text-sm font-semibold text-hae-ink hover:bg-hae-mist"
          >
            {copied ? 'Copied!' : 'Copy briefing'}
          </button>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-hae-slate">
          <span>
            {dayMeetings.length} meeting{dayMeetings.length === 1 ? '' : 's'} today
          </span>
          <span>
            {openTrackerCount} open tracker{openTrackerCount === 1 ? '' : 's'}
          </span>
          <span>
            {openReminderCount} thing{openReminderCount === 1 ? '' : 's'} to do
          </span>
        </div>
      </header>

      <TravelSection travel={travel} addItem={addItem} commitField={commitField} removeItem={removeItem} />

      <MeetingsTodaySection
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        dayMeetings={dayMeetings}
        activeTravel={activeTravelForSelectedDate}
        addManualMeeting={addManualMeeting}
        saveMeetingAgenda={saveMeetingAgenda}
        removeItem={removeItem}
      />

      <MajorMeetingsSection
        majorMeetings={majorMeetings}
        travel={travel}
        addItem={addItem}
        commitField={commitField}
        removeItem={removeItem}
        reorder={reorder}
      />

      <TrackersSection
        trackers={trackers}
        showResolved={showResolvedTrackers}
        setShowResolved={setShowResolvedTrackers}
        addItem={addItem}
        commitField={commitField}
        removeItem={removeItem}
        reorder={reorder}
      />

      <RemindersSection
        reminders={reminders}
        showResolved={showResolvedReminders}
        setShowResolved={setShowResolvedReminders}
        addItem={addItem}
        commitField={commitField}
        removeItem={removeItem}
        reorder={reorder}
      />
    </div>
  )
}

function TravelSection({ travel, addItem, commitField, removeItem }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ label: '', timeZone: '', startDate: '', endDate: '' })
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!draft.label.trim() || !draft.timeZone.trim() || !draft.startDate || !draft.endDate) return
    if (!isValidTimeZone(draft.timeZone.trim())) {
      setError('Not a recognized timezone — use an IANA name like "Europe/Rome", not a city or country name.')
      return
    }
    await addItem('travel', {
      label: draft.label.trim(),
      timeZone: draft.timeZone.trim(),
      startDate: draft.startDate,
      endDate: draft.endDate,
      order: nextOrder(travel),
    })
    setDraft({ label: '', timeZone: '', startDate: '', endDate: '' })
  }

  if (!open && travel.length === 0) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-hae-slate hover:text-hae-crimson"
      >
        + Add travel dates (shows local meeting times while traveling)
      </button>
    )
  }

  return (
    <section className="rounded-xl border border-hae-line bg-white p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="font-display text-lg text-hae-ink">
          Travel{' '}
          <span className="text-sm font-normal text-hae-slate">
            {travel.length ? `(${travel.length} trip${travel.length === 1 ? '' : 's'})` : '(none scheduled)'}
          </span>
        </h2>
        <span className="text-xs font-semibold text-hae-crimson">{open ? 'Done' : 'Edit'}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-hae-slate">
            Add upcoming travel so meeting times automatically show local time alongside ET.
          </p>
          {error ? <p className="text-xs text-hae-red">{error}</p> : null}
          {travel.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border border-hae-line/70 p-2 text-sm">
              <input
                defaultValue={t.label}
                onBlur={(e) => commitField(t.id, { label: e.target.value })}
                className={`${inputClass} sm:w-32`}
                placeholder="Label (e.g. Italy)"
              />
              <input
                defaultValue={t.timeZone}
                onBlur={(e) => {
                  const value = e.target.value.trim()
                  if (isValidTimeZone(value)) commitField(t.id, { timeZone: value })
                  else setError('Not a recognized timezone — use an IANA name like "Europe/Rome", not a city or country name.')
                }}
                className={`${inputClass} sm:w-44`}
                placeholder="IANA zone (e.g. Europe/Rome)"
              />
              <input
                type="date"
                defaultValue={t.startDate}
                onBlur={(e) => commitField(t.id, { startDate: e.target.value })}
                className={`${inputClass} sm:w-36`}
              />
              <input
                type="date"
                defaultValue={t.endDate}
                onBlur={(e) => commitField(t.id, { endDate: e.target.value })}
                className={`${inputClass} sm:w-36`}
              />
              <button
                type="button"
                onClick={() => removeItem(t.id)}
                className="text-xs text-hae-slate hover:text-hae-red"
              >
                Delete
              </button>
            </div>
          ))}
          <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Label (e.g. Italy)"
              className={`${inputClass} sm:w-32`}
            />
            <input
              value={draft.timeZone}
              onChange={(e) => setDraft({ ...draft, timeZone: e.target.value })}
              placeholder="IANA zone (e.g. Europe/Rome)"
              className={`${inputClass} sm:w-44`}
            />
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              className={`${inputClass} sm:w-36`}
            />
            <input
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              className={`${inputClass} sm:w-36`}
            />
            <button type="submit" className="rounded-md bg-hae-crimson px-3 py-1.5 text-sm font-semibold text-white">
              Add trip
            </button>
          </form>
        </div>
      ) : null}
    </section>
  )
}

function MeetingsTodaySection({
  selectedDate,
  setSelectedDate,
  dayMeetings,
  activeTravel,
  addManualMeeting,
  saveMeetingAgenda,
  removeItem,
}) {
  const [editing, setEditing] = useState(false)
  const now = new Date()
  const isToday = selectedDate === todayIso()
  const nextKey = isToday
    ? dayMeetings.find((m) => m.start && new Date(m.start) >= now)?.key
    : null

  return (
    <SectionCard
      title="Meetings Today"
      meta={formatLongDate(selectedDate)}
      editing={editing}
      onToggleEdit={() => setEditing((e) => !e)}
      extra={
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-md border border-hae-line px-2 py-1.5 text-sm text-hae-slate"
        />
      }
    >
      {editing ? (
        <>
          <div className="hae-table-scroll">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] tracking-wide text-hae-slate uppercase">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Time (ET)</th>
                  <th className="px-2 py-1.5 font-semibold">Local Time</th>
                  <th className="px-2 py-1.5 font-semibold">Details</th>
                  <th className="px-2 py-1.5 font-semibold">Agenda</th>
                  <th className="px-2 py-1.5 font-semibold w-10" />
                </tr>
              </thead>
              <tbody>
                {dayMeetings.map((row) => {
                  const start = row.start ? new Date(row.start) : null
                  const local = start ? localTimeLabel(start, activeTravel) : null
                  const isManual = row.meetingId === null
                  return (
                    <tr key={row.key} className="border-t border-hae-line/70 align-top">
                      <td className="px-2 py-2 text-hae-slate">
                        {isManual ? (
                          <input
                            type="time"
                            value={row.start ? row.start.slice(11, 16) : ''}
                            onChange={(e) => {
                              const start2 = `${selectedDate}T${e.target.value}`
                              saveMeetingAgenda(row, { start: start2 })
                            }}
                            className={inputClass}
                          />
                        ) : (
                          (start && timeInZone(start, ET_ZONE)) || '—'
                        )}
                      </td>
                      <td className="px-2 py-2 text-hae-slate">{local || '—'}</td>
                      <td className="px-2 py-2">
                        {isManual ? (
                          <input
                            value={row.title}
                            placeholder="Meeting details"
                            onChange={(e) => saveMeetingAgenda(row, { title: e.target.value })}
                            className={inputClass}
                          />
                        ) : row.htmlLink ? (
                          <a
                            href={row.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-hae-ink hover:text-hae-crimson"
                          >
                            {row.title}
                          </a>
                        ) : (
                          row.title
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          defaultValue={row.agendaDoc?.agenda || ''}
                          placeholder="Agenda notes"
                          onBlur={(e) => saveMeetingAgenda(row, { agenda: e.target.value })}
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        {isManual ? (
                          <button
                            type="button"
                            onClick={() => removeItem(row.agendaDoc.id)}
                            className="text-xs text-hae-slate hover:text-hae-red"
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addManualMeeting} className="mt-3 text-xs font-semibold text-hae-crimson">
            + Add meeting
          </button>
        </>
      ) : dayMeetings.length === 0 ? (
        <p className="text-sm text-hae-slate">No meetings today — enjoy the calm.</p>
      ) : (
        <ul className="space-y-2">
          {dayMeetings.map((row) => {
            const start = row.start ? new Date(row.start) : null
            const et = start ? timeInZone(start, ET_ZONE) : '—'
            const local = start ? localTimeLabel(start, activeTravel) : null
            const agenda = row.agendaDoc?.agenda
            return (
              <li
                key={row.key}
                className="flex gap-3 rounded-lg border-l-4 border-hae-crimson/60 bg-hae-mist/40 p-3"
              >
                <div className="w-20 shrink-0 text-sm font-semibold text-hae-ink">{et}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.htmlLink ? (
                      <a
                        href={row.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-hae-ink hover:text-hae-crimson"
                      >
                        {row.title || 'Untitled meeting'}
                      </a>
                    ) : (
                      <span className="font-medium text-hae-ink">{row.title || 'Untitled meeting'}</span>
                    )}
                    {row.key === nextKey ? (
                      <span className="rounded-full bg-hae-crimson px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Next
                      </span>
                    ) : null}
                  </div>
                  {local ? <p className="text-xs text-hae-slate">{local}</p> : null}
                  {agenda ? <p className="mt-1 text-xs text-hae-slate">{agenda}</p> : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

function MajorMeetingsSection({ majorMeetings, travel, addItem, commitField, removeItem, reorder }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ date: '', timeET: '', meeting: '', comments: '' })
  const today = todayIso()
  const upcoming = majorMeetings
    .filter((r) => !r.date || r.date >= today)
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.timeET || '').localeCompare(b.timeET || ''))

  const submit = async (e) => {
    e.preventDefault()
    if (!draft.meeting.trim()) return
    await addItem('majorMeeting', { ...draft, order: nextOrder(majorMeetings) })
    setDraft({ date: '', timeET: '', meeting: '', comments: '' })
  }

  return (
    <SectionCard
      title="Major Meetings and Events"
      editing={editing}
      onToggleEdit={() => setEditing((e) => !e)}
    >
      {editing ? (
        <>
          <DraggableList
            items={majorMeetings}
            onReorder={(reordered) => reorder('majorMeeting', reordered)}
            renderItem={(r) => {
              const start = zonedTimeToDate(r.date, r.timeET, ET_ZONE)
              const local = start ? localTimeLabel(start, getActiveTravel(r.date, travel)) : null
              return (
                <div className="grid gap-2 rounded-md border border-hae-line/70 p-2 sm:grid-cols-[9rem_6rem_8rem_1fr_1fr_auto]">
                  <input
                    type="date"
                    defaultValue={r.date}
                    onBlur={(e) => commitField(r.id, { date: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    type="time"
                    defaultValue={r.timeET}
                    onBlur={(e) => commitField(r.id, { timeET: e.target.value })}
                    className={inputClass}
                  />
                  <div className="flex items-center px-2 text-xs text-hae-slate">{local || '—'}</div>
                  <input
                    defaultValue={r.meeting}
                    placeholder="Meeting"
                    onBlur={(e) => commitField(r.id, { meeting: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    defaultValue={r.comments}
                    placeholder="RR Comments"
                    onBlur={(e) => commitField(r.id, { comments: e.target.value })}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(r.id)}
                    className="justify-self-end text-xs text-hae-slate hover:text-hae-red"
                  >
                    Delete
                  </button>
                </div>
              )
            }}
          />
          <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[9rem_6rem_1fr_1fr_auto]">
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              className={inputClass}
            />
            <input
              type="time"
              value={draft.timeET}
              onChange={(e) => setDraft({ ...draft, timeET: e.target.value })}
              className={inputClass}
            />
            <input
              value={draft.meeting}
              onChange={(e) => setDraft({ ...draft, meeting: e.target.value })}
              placeholder="Meeting"
              className={inputClass}
            />
            <input
              value={draft.comments}
              onChange={(e) => setDraft({ ...draft, comments: e.target.value })}
              placeholder="RR Comments"
              className={inputClass}
            />
            <button type="submit" className="rounded-md bg-hae-crimson px-3 py-1.5 text-sm font-semibold text-white">
              Add
            </button>
          </form>
        </>
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-hae-slate">Nothing upcoming.</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((r) => {
            const start = zonedTimeToDate(r.date, r.timeET, ET_ZONE)
            const local = start ? localTimeLabel(start, getActiveTravel(r.date, travel)) : null
            return (
              <li key={r.id} className="rounded-lg border border-hae-line/70 p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold text-hae-ink">{formatShortDate(r.date)}</span>
                  {r.timeET ? <span className="text-xs text-hae-slate">{r.timeET} ET</span> : null}
                  {local ? <span className="text-xs text-hae-slate">{local}</span> : null}
                </div>
                <p className="mt-0.5 font-medium text-hae-ink">{r.meeting}</p>
                {r.comments ? <p className="mt-0.5 text-xs text-hae-slate">{r.comments}</p> : null}
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

function TrackersSection({ trackers, showResolved, setShowResolved, addItem, commitField, removeItem, reorder }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: '', notes: '', link: '' })
  const visible = trackers.filter((t) => showResolved || !t.resolved)

  const submit = async (e) => {
    e.preventDefault()
    if (!draft.title.trim()) return
    await addItem('tracker', { ...draft, order: nextOrder(trackers), resolved: false })
    setDraft({ title: '', notes: '', link: '' })
  }

  return (
    <SectionCard
      title="Trackers"
      editing={editing}
      onToggleEdit={() => setEditing((e) => !e)}
      extra={
        <label className="flex items-center gap-1.5 text-xs text-hae-slate">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show resolved
        </label>
      }
    >
      {editing ? (
        <>
          <DraggableList
            items={visible}
            onReorder={(reordered) => reorder('tracker', reordered)}
            renderCheckbox={(t) => (
              <input
                type="checkbox"
                checked={!!t.resolved}
                onChange={(e) => commitField(t.id, { resolved: e.target.checked })}
                title="Resolved"
              />
            )}
            renderItem={(t) => (
              <div className="space-y-1.5 rounded-md border border-hae-line/70 p-2">
                <input
                  defaultValue={t.title}
                  placeholder="Title"
                  onBlur={(e) => commitField(t.id, { title: e.target.value })}
                  className={`${inputClass} font-semibold text-hae-red`}
                />
                <textarea
                  defaultValue={t.notes}
                  placeholder="Notes"
                  rows={2}
                  onBlur={(e) => commitField(t.id, { notes: e.target.value })}
                  className={inputClass}
                />
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={t.link}
                    placeholder="Link"
                    onBlur={(e) => commitField(t.id, { link: e.target.value })}
                    className={inputClass}
                  />
                  <button type="button" onClick={() => removeItem(t.id)} className="text-xs text-hae-slate hover:text-hae-red">
                    Delete
                  </button>
                </div>
              </div>
            )}
          />
          <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Title"
              className={inputClass}
            />
            <input
              value={draft.link}
              onChange={(e) => setDraft({ ...draft, link: e.target.value })}
              placeholder="Link"
              className={inputClass}
            />
            <button type="submit" className="rounded-md bg-hae-crimson px-3 py-1.5 text-sm font-semibold text-white">
              Add tracker
            </button>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Notes"
              rows={2}
              className={`${inputClass} sm:col-span-3`}
            />
          </form>
        </>
      ) : visible.length === 0 ? (
        <p className="text-sm text-hae-slate">Nothing tracked right now.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => (
            <li key={t.id} className="flex gap-3 rounded-lg border border-hae-line/70 p-3">
              <input
                type="checkbox"
                checked={!!t.resolved}
                onChange={(e) => commitField(t.id, { resolved: e.target.checked })}
                className="mt-1"
                title="Resolved"
              />
              <div className="min-w-0 flex-1">
                <p className={`font-semibold text-hae-red ${t.resolved ? 'line-through opacity-60' : ''}`}>
                  {t.title}
                </p>
                {t.notes ? (
                  <p className="mt-0.5 whitespace-pre-line text-xs text-hae-slate">{t.notes}</p>
                ) : null}
                {t.link ? (
                  <a
                    href={t.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-hae-crimson hover:underline"
                  >
                    Open ↗
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function RemindersSection({ reminders, showResolved, setShowResolved, addItem, commitField, removeItem, reorder }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ date: '', account: '', subject: '', body: '', comments: '' })
  const visible = reminders.filter((r) => showResolved || !r.resolved)

  const submit = async (e) => {
    e.preventDefault()
    if (!draft.subject.trim() && !draft.body.trim()) return
    await addItem('reminder', { ...draft, order: nextOrder(reminders), resolved: false })
    setDraft({ date: '', account: '', subject: '', body: '', comments: '' })
  }

  return (
    <SectionCard
      title="Emails to Respond / Things To Do / Reminders"
      editing={editing}
      onToggleEdit={() => setEditing((e) => !e)}
      extra={
        <label className="flex items-center gap-1.5 text-xs text-hae-slate">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show resolved
        </label>
      }
    >
      {editing ? (
        <>
          <DraggableList
            items={visible}
            onReorder={(reordered) => reorder('reminder', reordered)}
            renderCheckbox={(r) => (
              <input
                type="checkbox"
                checked={!!r.resolved}
                onChange={(e) => commitField(r.id, { resolved: e.target.checked })}
                title="Resolved"
              />
            )}
            renderItem={(r) => (
              <div className="grid gap-1.5 rounded-md border border-hae-line/70 p-2 sm:grid-cols-[7rem_8rem_1fr]">
                <input
                  type="date"
                  defaultValue={r.date}
                  onBlur={(e) => commitField(r.id, { date: e.target.value })}
                  className={inputClass}
                />
                <input
                  defaultValue={r.account}
                  placeholder="Account"
                  onBlur={(e) => commitField(r.id, { account: e.target.value })}
                  className={inputClass}
                />
                <input
                  defaultValue={r.subject}
                  placeholder="Subject"
                  onBlur={(e) => commitField(r.id, { subject: e.target.value })}
                  className={`${inputClass} font-semibold`}
                />
                <textarea
                  defaultValue={r.body}
                  placeholder="Details"
                  rows={2}
                  onBlur={(e) => commitField(r.id, { body: e.target.value })}
                  className={`${inputClass} sm:col-span-3`}
                />
                <div className="flex items-center gap-2 sm:col-span-3">
                  <input
                    defaultValue={r.comments}
                    placeholder="RR Comments"
                    onBlur={(e) => commitField(r.id, { comments: e.target.value })}
                    className={inputClass}
                  />
                  <button type="button" onClick={() => removeItem(r.id)} className="text-xs text-hae-slate hover:text-hae-red">
                    Delete
                  </button>
                </div>
              </div>
            )}
          />
          <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[7rem_8rem_1fr]">
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              className={inputClass}
            />
            <input
              value={draft.account}
              onChange={(e) => setDraft({ ...draft, account: e.target.value })}
              placeholder="Account"
              className={inputClass}
            />
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder="Subject"
              className={inputClass}
            />
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Details"
              rows={2}
              className={`${inputClass} sm:col-span-2`}
            />
            <button type="submit" className="rounded-md bg-hae-crimson px-3 py-1.5 text-sm font-semibold text-white">
              Add
            </button>
          </form>
        </>
      ) : visible.length === 0 ? (
        <p className="text-sm text-hae-slate">Nothing outstanding.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <li key={r.id} className="flex gap-3 rounded-lg border border-hae-line/70 p-3">
              <input
                type="checkbox"
                checked={!!r.resolved}
                onChange={(e) => commitField(r.id, { resolved: e.target.checked })}
                className="mt-1"
                title="Resolved"
              />
              <div className="min-w-0 flex-1">
                <div className={`font-semibold text-hae-ink ${r.resolved ? 'line-through opacity-60' : ''}`}>
                  {r.subject || 'Untitled'}
                </div>
                {r.date || r.account ? (
                  <p className="text-xs text-hae-slate">
                    {[r.date, r.account].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                {r.body ? <p className="mt-1 whitespace-pre-line text-xs text-hae-slate">{r.body}</p> : null}
                {r.comments ? (
                  <p className="mt-1 text-xs italic text-hae-slate">RR: {r.comments}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
