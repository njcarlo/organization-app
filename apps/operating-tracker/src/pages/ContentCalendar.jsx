import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import SocialPostDetailCard from '../components/SocialPostDetailCard'
import GraphicDetailCard from '../components/GraphicDetailCard'
import {
  GRAPHICS_STATUS_OPTIONS,
  SOCIAL_GRAPHICS_STATUS_OPTIONS,
  SOCIAL_POST_STATUS_OPTIONS,
} from '../constants'
import {
  formatDate,
  graphicsStatusBadgeClass,
  socialGraphicsStatusBadgeClass,
  socialPostStatusBadgeClass,
} from '../utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toIsoDate(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function buildMonthCells(year, monthIndex) {
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ day, iso: toIsoDate(year, monthIndex, day) })
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const UNSCHEDULED_KEY = 'unscheduled'

function monthGroupKey(dateOfPosting) {
  if (!dateOfPosting) return UNSCHEDULED_KEY
  return dateOfPosting.slice(0, 7)
}

function monthGroupLabel(key) {
  if (key === UNSCHEDULED_KEY) return 'Unscheduled'
  const [year, month] = key.split('-').map(Number)
  return monthLabel(year, month - 1)
}

// Graphics Dashboard requests (trackerGraphicsRequests) are shown alongside
// posts, read live and placed by Date Needed — no copy is written, so editing
// a graphic here or on the dashboard is the same record.
function graphicToEntry(g) {
  return {
    key: `graphic:${g.id}`,
    kind: 'graphic',
    source: g,
    creative: g.title || '',
    eventOrProgram: g.eventOrProgram || '',
    status: g.status || GRAPHICS_STATUS_OPTIONS[0],
    statusClass: graphicsStatusBadgeClass(g.status),
    dateOfPosting: g.dateNeeded || '',
    fileUrl: g.url || '',
    peopleToTag: g.whoToTag || '',
  }
}

function postToEntry(p) {
  return {
    ...p,
    key: `post:${p.id}`,
    kind: 'post',
    source: p,
    status: p.status || SOCIAL_POST_STATUS_OPTIONS[0].value,
    statusClass: socialPostStatusBadgeClass(p.status),
  }
}

const emptyForm = {
  creative: '',
  status: SOCIAL_POST_STATUS_OPTIONS[0].value,
  dateOfPosting: '',
  graphicsStatus: SOCIAL_GRAPHICS_STATUS_OPTIONS[0].value,
}

/**
 * Social Media Content Calendar — Main Table groups creatives by month of posting
 * (sorted by date within each group); Calendar reflects the same data on a month grid.
 * Click a row/entry to open its detail card with file, hashtags, comments, and activity log.
 * Graphics Dashboard requests are merged in by Date Needed and open the graphic detail card.
 */
export default function ContentCalendar({ sectionReadOnly = false }) {
  const [tab, setTab] = useState('table')
  const [posts, setPosts] = useState([])
  const [graphics, setGraphics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [postSnap, graphicSnap] = await Promise.all([
        getDocs(collection(db, 'socialMediaPosts')),
        getDocs(collection(db, 'trackerGraphicsRequests')),
      ])
      setPosts(postSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setGraphics(graphicSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setError(err.message || 'Failed to load content calendar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(
    () => [...posts.map(postToEntry), ...graphics.map(graphicToEntry)],
    [posts, graphics]
  )

  const groupedRows = useMemo(() => {
    const groups = new Map()
    for (const row of rows) {
      const key = monthGroupKey(row.dateOfPosting)
      const list = groups.get(key) || []
      list.push(row)
      groups.set(key, list)
    }
    for (const list of groups.values()) {
      list.sort((a, b) => (a.dateOfPosting || '').localeCompare(b.dateOfPosting || ''))
    }
    const keys = [...groups.keys()].filter((k) => k !== UNSCHEDULED_KEY).sort()
    if (groups.has(UNSCHEDULED_KEY)) keys.push(UNSCHEDULED_KEY)
    return keys.map((key) => ({ key, label: monthGroupLabel(key), items: groups.get(key) }))
  }, [rows])

  const byDate = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      if (!row.dateOfPosting) continue
      const list = map.get(row.dateOfPosting) || []
      list.push(row)
      map.set(row.dateOfPosting, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.creative || '').localeCompare(b.creative || ''))
    }
    return map
  }, [rows])

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth])
  const todayIso = toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
  const selectedPosts = selectedDay ? byDate.get(selectedDay) || [] : []

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

  const openAdd = (iso) => setModal({ form: { ...emptyForm, dateOfPosting: iso || '' } })
  const closeModal = () => {
    if (saving) return
    setModal(null)
  }

  const submitModal = async (e) => {
    e.preventDefault()
    if (sectionReadOnly) return
    if (!modal?.form.creative.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const { form } = modal
      await addDoc(collection(db, 'socialMediaPosts'), {
        creative: form.creative.trim(),
        status: form.status,
        dateOfPosting: form.dateOfPosting,
        graphicsStatus: form.graphicsStatus,
        hashtags: '',
        linkedinGroups: '',
        peopleToTag: '',
        fileUrl: '',
        createdAt: serverTimestamp(),
      })
      setModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  const expandedRow = rows.find((r) => r.key === expandedId) || null

  if (loading) return <p className="text-sm text-hae-slate">Loading content calendar…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hae-line pb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
            Harvard Alumni Entrepreneurs
          </p>
          <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
            Social Media Calendar
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-hae-slate">
            Track creatives and Graphics Dashboard requests from draft to posting — grouped by
            month in the table, or laid out on the calendar.
          </p>
        </div>
        {!sectionReadOnly && (
          <button type="button" className="hae-btn" onClick={() => openAdd(selectedDay)}>
            + Add creative
          </button>
        )}
      </header>

      {error && <p className="text-sm text-hae-red">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('table')}
          className={`px-3 py-1.5 text-xs font-semibold uppercase ${
            tab === 'table' ? 'hae-btn' : 'hae-btn-secondary'
          }`}
        >
          Main Table
        </button>
        <button
          type="button"
          onClick={() => setTab('calendar')}
          className={`px-3 py-1.5 text-xs font-semibold uppercase ${
            tab === 'calendar' ? 'hae-btn' : 'hae-btn-secondary'
          }`}
        >
          Calendar
        </button>
      </div>

      <Modal
        open={!!modal}
        onClose={closeModal}
        title="Add creative"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="social-post-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Create creative'}
            </button>
          </>
        }
      >
        {modal ? (
          <form id="social-post-form" onSubmit={submitModal} className="grid gap-3 sm:grid-cols-2">
            {error && <p className="text-sm text-hae-red sm:col-span-2">{error}</p>}
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-hae-slate">Creative</span>
              <input
                autoFocus
                required
                value={modal.form.creative}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, creative: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Date of Posting</span>
              <input
                type="date"
                value={modal.form.dateOfPosting}
                onChange={(e) =>
                  setModal({ ...modal, form: { ...modal.form, dateOfPosting: e.target.value } })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Status</span>
              <select
                value={modal.form.status}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, status: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                {SOCIAL_POST_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-hae-slate">Graphics Status</span>
              <select
                value={modal.form.graphicsStatus}
                onChange={(e) =>
                  setModal({ ...modal, form: { ...modal.form, graphicsStatus: e.target.value } })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                {SOCIAL_GRAPHICS_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </form>
        ) : null}
      </Modal>

      {tab === 'table' ? (
        <div className="space-y-8">
          {groupedRows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-hae-slate">No creatives yet.</p>
          ) : (
            groupedRows.map((group) => (
              <div key={group.key} className="space-y-2">
                <h2 className="font-display text-lg text-hae-ink">{group.label}</h2>
                <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
                  <table className="w-full min-w-[1080px] text-left">
                    <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Creative</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Date of Posting</th>
                        <th className="px-3 py-2 font-semibold">Graphics Status</th>
                        <th className="px-3 py-2 font-semibold">File</th>
                        <th className="px-3 py-2 font-semibold">Hashtags</th>
                        <th className="px-3 py-2 font-semibold">LinkedIn Groups</th>
                        <th className="px-3 py-2 font-semibold">People to Tag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((row) => (
                        <tr
                          key={row.key}
                          onClick={() => setExpandedId(row.key)}
                          className="cursor-pointer border-b border-hae-line/70 hover:bg-hae-mist/40"
                        >
                          <td className="px-3 py-2 text-sm font-medium text-hae-ink">
                            <div className="flex items-center gap-2">
                              <span>{row.creative}</span>
                              {row.kind === 'graphic' ? (
                                <span className="rounded border border-hae-line px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-hae-slate uppercase">
                                  Graphic
                                </span>
                              ) : null}
                            </div>
                            {row.eventOrProgram ? (
                              <div className="text-xs font-normal text-hae-slate">{row.eventOrProgram}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${row.statusClass}`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-hae-slate">
                            {row.dateOfPosting ? formatDate(row.dateOfPosting) : '—'}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {row.kind === 'post' ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${socialGraphicsStatusBadgeClass(row.graphicsStatus)}`}
                              >
                                {row.graphicsStatus || SOCIAL_GRAPHICS_STATUS_OPTIONS[0].value}
                              </span>
                            ) : (
                              <span className="text-hae-slate">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {row.fileUrl ? (
                              <a
                                href={row.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-hae-crimson hover:underline"
                              >
                                Open file ↗
                              </a>
                            ) : (
                              <span className="text-hae-slate">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-hae-slate">{row.hashtags || '—'}</td>
                          <td className="px-3 py-2 text-sm text-hae-slate">{row.linkedinGroups || '—'}</td>
                          <td className="px-3 py-2 text-sm text-hae-slate">{row.peopleToTag || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
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
            <button type="button" onClick={goToday} className="hae-btn-secondary px-3 py-1.5 text-xs">
              Today
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-hae-line bg-hae-line text-xs">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-hae-mist/80 px-2 py-1.5 text-center font-semibold text-hae-slate uppercase">
                {d}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <div key={`blank-${i}`} className="min-h-[6rem] bg-hae-mist/20" />
              const dayEntries = byDate.get(cell.iso) || []
              const isToday = cell.iso === todayIso
              const isSelected = cell.iso === selectedDay
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDay(cell.iso)}
                  className={`min-h-[6rem] bg-white p-1.5 text-left align-top ${
                    isSelected ? 'ring-2 ring-inset ring-hae-crimson' : ''
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      isToday ? 'bg-hae-crimson text-white' : 'text-hae-ink'
                    }`}
                  >
                    {cell.day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEntries.slice(0, 3).map((p) => (
                      <div
                        key={p.key}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedId(p.key)
                        }}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${p.statusClass}`}
                        title={p.kind === 'graphic' ? `Graphic: ${p.creative}` : p.creative}
                      >
                        {p.kind === 'graphic' ? 'Graphic · ' : ''}
                        {p.creative}
                      </div>
                    ))}
                    {dayEntries.length > 3 ? (
                      <div className="text-[10px] text-hae-slate">+{dayEntries.length - 3} more</div>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>

          {selectedDay ? (
            <div className="rounded-xl border border-hae-line bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-lg text-hae-ink">{formatDate(selectedDay)}</h3>
                {!sectionReadOnly && (
                  <button type="button" className="hae-btn" onClick={() => openAdd(selectedDay)}>
                    + Add creative
                  </button>
                )}
              </div>
              {selectedPosts.length === 0 ? (
                <p className="text-sm text-hae-slate">Nothing scheduled for this day.</p>
              ) : (
                <ul className="space-y-2">
                  {selectedPosts.map((p) => (
                    <li key={p.key}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(p.key)}
                        className="flex w-full items-center justify-between rounded-md border border-hae-line/60 px-3 py-2 text-left hover:bg-hae-mist/40"
                      >
                        <span className="text-sm font-medium text-hae-ink">
                          {p.kind === 'graphic' ? (
                            <span className="mr-2 text-[10px] font-semibold tracking-wide text-hae-slate uppercase">
                              Graphic
                            </span>
                          ) : null}
                          {p.creative}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${p.statusClass}`}
                        >
                          {p.status}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}

      {expandedRow?.kind === 'graphic' ? (
        <GraphicDetailCard
          graphic={expandedRow.source}
          onClose={() => setExpandedId(null)}
          onChanged={load}
          readOnly={sectionReadOnly}
          onDeleted={() => {
            setExpandedId(null)
            load()
          }}
        />
      ) : expandedRow ? (
        <SocialPostDetailCard
          post={expandedRow.source}
          onClose={() => setExpandedId(null)}
          onChanged={load}
          readOnly={sectionReadOnly}
          onDeleted={() => {
            setExpandedId(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
