import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { downloadIcs, FEATURES, useFeatures } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import TaskDetailPopup, { taskDetailRows } from '../components/TaskDetailPopup'
import {
  daysUntil,
  effectivePriority,
  formatDate,
  namesLabel,
  priorityBadgeClass,
  programNameOf,
  projectNameOf,
  sortByPriorityThenDue,
  toNameList,
} from '../utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 2

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

export default function Calendar() {
  const { userProfile, isStaff } = useAuth()
  const { isEnabled } = useFeatures()
  const canExportCalendar = isEnabled(FEATURES.CALENDAR_EXPORT)

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [tasks, setTasks] = useState([])
  const [programs, setPrograms] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewAll, setViewAll] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Active')
  const [selectedDay, setSelectedDay] = useState(null)
  const [detailTask, setDetailTask] = useState(null)

  const load = useCallback(async () => {
    const [taskSnap, programSnap, projectSnap] = await Promise.all([
      getDocs(collection(db, 'tasks')),
      getDocs(collection(db, 'programs')),
      getDocs(collection(db, 'projects')),
    ])
    setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setPrograms(programSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const programsById = useMemo(() => {
    const map = {}
    for (const p of programs) map[p.id] = p
    return map
  }, [programs])

  const projectsById = useMemo(() => {
    const map = {}
    for (const p of projects) map[p.id] = p
    return map
  }, [projects])

  const filtered = useMemo(() => {
    let list = [...tasks]
    if (!(isStaff && viewAll)) {
      const myName = (userProfile?.name || '').toLowerCase()
      list = list.filter((t) =>
        toNameList(t.owner).some((n) => n.toLowerCase() === myName)
      )
    }
    if (statusFilter === 'Active') {
      list = list.filter((t) => t.status !== 'Complete')
    } else if (statusFilter === 'Complete') {
      list = list.filter((t) => t.status === 'Complete')
    }
    return list
  }, [tasks, isStaff, viewAll, userProfile, statusFilter])

  const byDueDate = useMemo(() => {
    const map = new Map()
    for (const task of filtered) {
      if (!task.dueDate) continue
      const list = map.get(task.dueDate) || []
      list.push(task)
      map.set(task.dueDate, list)
    }
    for (const list of map.values()) list.sort(sortByPriorityThenDue)
    return map
  }, [filtered])

  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  const todayIso = toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())

  const selectedTasks = useMemo(() => {
    if (!selectedDay) return []
    return byDueDate.get(selectedDay) || []
  }, [byDueDate, selectedDay])

  const datedInView = useMemo(() => {
    const prefix = `${viewYear}-${pad2(viewMonth + 1)}-`
    return filtered.filter((t) => t.dueDate && t.dueDate.startsWith(prefix))
  }, [filtered, viewYear, viewMonth])

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

  const exportIcs = () => {
    if (!datedInView.length) return
    downloadIcs(
      isStaff && viewAll ? 'hae-calendar-all.ics' : 'hae-calendar-mine.ics',
      datedInView.map((t) => ({
        uid: `task-${t.id}@hae-operating-tracker`,
        title: t.name || t.title || 'Task',
        date: t.dueDate,
        description: [
          t.status ? `Status: ${t.status}` : '',
          namesLabel(t.owner) ? `Owner: ${namesLabel(t.owner)}` : '',
          t.nextAction ? `Next: ${t.nextAction}` : '',
          `Program: ${programNameOf(t, programsById)}`,
        ]
          .filter(Boolean)
          .join('\n'),
      })),
      {
        calName:
          isStaff && viewAll ? 'HAE Operations Calendar' : 'HAE My Calendar',
      }
    )
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading calendar…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Calendar</h1>
          <p className="mt-1 text-sm text-hae-slate">
            {datedInView.length} due date{datedInView.length === 1 ? '' : 's'} in{' '}
            {monthLabel(viewYear, viewMonth)}
            {!(isStaff && viewAll) ? ' · your tasks' : ' · all tasks'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isStaff ? (
            <div className="flex overflow-hidden border border-hae-line">
              <button
                type="button"
                onClick={() => setViewAll(false)}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  !viewAll ? 'bg-hae-ink text-white' : 'bg-white text-hae-slate'
                }`}
              >
                Mine
              </button>
              <button
                type="button"
                onClick={() => setViewAll(true)}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  viewAll ? 'bg-hae-ink text-white' : 'bg-white text-hae-slate'
                }`}
              >
                All
              </button>
            </div>
          ) : null}
          {canExportCalendar ? (
            <button
              type="button"
              onClick={exportIcs}
              disabled={!datedInView.length}
              className="border border-hae-line px-3 py-1.5 text-xs font-semibold text-hae-ink disabled:opacity-50"
            >
              Export .ics
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
        </div>
        <div className="flex flex-wrap gap-2">
          {['Active', 'All', 'Complete'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold ${
                statusFilter === f
                  ? 'bg-hae-ink text-white'
                  : 'border border-hae-line bg-white text-hae-slate'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden border border-hae-line bg-white">
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
            const dayTasks = byDueDate.get(cell.iso) || []
            const isToday = cell.iso === todayIso
            const isSelected = cell.iso === selectedDay
            const overdue = dayTasks.some((t) => {
              const d = daysUntil(t.dueDate)
              return d !== null && d < 0 && t.status !== 'Complete'
            })
            const visible = dayTasks.slice(0, MAX_CHIPS)
            const more = dayTasks.length - visible.length

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
                      : overdue
                        ? 'bg-red-50/40 hover:bg-hae-mist/50'
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
                  {visible.map((t) => (
                    <div
                      key={t.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${priorityBadgeClass(
                        effectivePriority(t)
                      )}`}
                      title={t.name || t.title}
                    >
                      {t.name || t.title || 'Task'}
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

      <section className="border border-hae-line bg-white">
        <div className="border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold text-hae-ink">
            {selectedDay
              ? `Due ${formatDate(selectedDay)}`
              : 'Select a day'}
          </h2>
        </div>
        {!selectedDay ? (
          <p className="px-4 py-6 text-sm text-hae-slate">
            Click a day to see tasks due that date.
          </p>
        ) : selectedTasks.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">No tasks due this day.</p>
        ) : (
          <ul className="divide-y divide-hae-line">
            {selectedTasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setDetailTask(t)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-hae-mist/40"
                >
                  <div>
                    <div className="text-sm font-semibold text-hae-ink">
                      {t.name || t.title || 'Task'}
                    </div>
                    <div className="text-xs text-hae-slate">
                      {t.status || '—'}
                      {namesLabel(t.owner) ? ` · ${namesLabel(t.owner)}` : ''}
                      {` · ${programNameOf(t, programsById)}`}
                      {` · ${projectNameOf(t, projectsById)}`}
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${priorityBadgeClass(
                      effectivePriority(t)
                    )}`}
                  >
                    {effectivePriority(t)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TaskDetailPopup
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        title={detailTask?.name || detailTask?.title || 'Task'}
        rows={taskDetailRows(detailTask, { programsById, projectsById })}
      />
    </div>
  )
}
