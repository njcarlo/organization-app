import {
  effectivePriority,
  formatDate,
  priorityBadgeClass,
  programNameOf,
  projectNameOf,
  sortByPriorityThenDue,
  daysUntil,
} from '../utils'
import { useMemo, useState } from 'react'
import TaskDetailPopup, { taskDetailRows } from './TaskDetailPopup'

function PriorityCell({ task }) {
  const priority = effectivePriority(task)
  const isManual = Boolean(task.priority)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${priorityBadgeClass(priority)}`}
    >
      {priority}
      {isManual && <span className="text-[9px] opacity-70">M</span>}
    </span>
  )
}

function MobileTaskCards({ tasks, programsById, projectsById, emptyLabel, onOpen }) {
  if (!tasks.length) {
    return (
      <div className="hae-mobile-card text-center text-sm text-hae-slate">{emptyLabel}</div>
    )
  }
  return (
    <div className="hae-mobile-cards p-3">
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          className="hae-mobile-card"
          onClick={() => onOpen?.(task)}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="hae-mobile-card__title min-w-0 flex-1">{task.name}</div>
            <PriorityCell task={task} />
          </div>
          <div className="hae-mobile-card__meta">
            <span>Due {formatDate(task.dueDate)}</span>
            <span className="line-clamp-1">
              {programNameOf(task, programsById)}
              {projectNameOf(task, projectsById)
                ? ` · ${projectNameOf(task, projectsById)}`
                : ''}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

function DesktopTaskTable({ tasks, programsById, projectsById, emptyLabel }) {
  return (
    <div className="hae-table-scroll">
      <table className="w-full min-w-[640px] text-left lg:min-w-[900px]">
        <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
          <tr>
            <th className="px-3 py-2 font-semibold">Priority</th>
            <th className="hae-col-lg-hide px-3 py-2 font-semibold">Program</th>
            <th className="hae-col-lg-hide px-3 py-2 font-semibold">Project</th>
            <th className="px-3 py-2 font-semibold">Task</th>
            <th className="hae-col-sm-hide px-3 py-2 font-semibold">Project Owner</th>
            <th className="px-3 py-2 font-semibold">Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-sm text-hae-slate">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            tasks.map((task) => (
              <tr key={task.id} className="border-b border-hae-line/70 last:border-0">
                <td className="px-3 py-2">
                  <PriorityCell task={task} />
                </td>
                <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                  {programNameOf(task, programsById)}
                </td>
                <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                  {projectNameOf(task, projectsById)}
                </td>
                <td className="px-3 py-2 text-sm font-medium text-hae-ink">{task.name}</td>
                <td className="hae-col-sm-hide px-3 py-2 text-sm text-hae-slate">
                  {projectsById[task.projectId]?.lead || '—'}
                </td>
                <td className="px-3 py-2 text-sm text-hae-slate">
                  {formatDate(task.dueDate)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function PrioritiesSection({ tasks, programsById, projectsById }) {
  const [upcomingOpen, setUpcomingOpen] = useState(false)
  const [selected, setSelected] = useState(null)

  const { thisWeek, upcoming } = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'Complete')
    const week = []
    const later = []
    for (const t of active) {
      if (t.status === 'Time Sensitive') {
        week.push(t)
        continue
      }
      const d = daysUntil(t.dueDate)
      if (d !== null && d <= 7) week.push(t)
      else later.push(t)
    }
    week.sort(sortByPriorityThenDue)
    later.sort(sortByPriorityThenDue)
    return { thisWeek: week, upcoming: later }
  }, [tasks])

  const upcomingTop = upcoming.slice(0, 5)

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-hae-line bg-white">
        <div className="border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold text-hae-ink">This Week&apos;s Priorities</h2>
          <p className="text-xs text-hae-slate">
            Incomplete tasks due within 7 days, plus any flagged Time Sensitive
          </p>
        </div>
        <div className="hae-mobile-only">
          <MobileTaskCards
            tasks={thisWeek}
            programsById={programsById}
            projectsById={projectsById}
            emptyLabel="No priorities this week"
            onOpen={setSelected}
          />
        </div>
        <div className="hae-desktop-only">
          <DesktopTaskTable
            tasks={thisWeek}
            programsById={programsById}
            projectsById={projectsById}
            emptyLabel="No priorities this week"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-hae-line bg-white">
        <button
          type="button"
          onClick={() => setUpcomingOpen((o) => !o)}
          className="flex w-full items-center justify-between border-b border-hae-line px-4 py-3 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-hae-ink">Upcoming Tasks</h2>
            <p className="text-xs text-hae-slate">
              Due beyond 7 days · showing top {Math.min(5, upcoming.length)} of {upcoming.length}
            </p>
          </div>
          <span className="text-xs text-hae-slate">{upcomingOpen ? 'Hide' : 'Show'}</span>
        </button>
        {upcomingOpen ? (
          <>
            <div className="hae-mobile-only">
              <MobileTaskCards
                tasks={upcomingTop}
                programsById={programsById}
                projectsById={projectsById}
                emptyLabel="No upcoming tasks"
                onOpen={setSelected}
              />
            </div>
            <div className="hae-desktop-only">
              <DesktopTaskTable
                tasks={upcomingTop}
                programsById={programsById}
                projectsById={projectsById}
                emptyLabel="No upcoming tasks"
              />
            </div>
          </>
        ) : null}
      </div>

      <TaskDetailPopup
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name || 'Task'}
        rows={taskDetailRows(selected, { programsById, projectsById })}
        footer={
          <button
            type="button"
            className="hae-btn-secondary"
            onClick={() => setSelected(null)}
          >
            Close
          </button>
        }
      />
    </section>
  )
}
