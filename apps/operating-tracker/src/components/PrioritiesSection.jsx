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

function TaskTableRows({ tasks, programsById, projectsById }) {
  return tasks.map((task) => (
    <tr key={task.id} className="border-b border-hae-line/70 last:border-0">
      <td className="px-3 py-2">
        <PriorityCell task={task} />
      </td>
      <td className="px-3 py-2 text-sm font-medium text-hae-ink">{task.name}</td>
      <td className="px-3 py-2 text-sm text-hae-slate">
        {programNameOf(task, programsById)}
      </td>
      <td className="px-3 py-2 text-sm text-hae-slate">
        {projectNameOf(task, projectsById)}
      </td>
      <td className="px-3 py-2 text-sm text-hae-slate">
        {projectsById[task.projectId]?.lead || '—'}
      </td>
      <td className="px-3 py-2 text-sm text-hae-slate">{formatDate(task.dueDate)}</td>
      <td className="px-3 py-2 text-sm text-hae-slate">{task.nextAction || '—'}</td>
    </tr>
  ))
}

export default function PrioritiesSection({ tasks, programsById, projectsById }) {
  const [upcomingOpen, setUpcomingOpen] = useState(false)

  const { thisWeek, upcoming } = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'Complete')
    const week = []
    const later = []
    for (const t of active) {
      const d = daysUntil(t.dueDate)
      if (d === null || d <= 7) week.push(t)
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
            Incomplete tasks due within 7 days (or with no due date)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Priority</th>
                <th className="px-3 py-2 font-semibold">Task</th>
                <th className="px-3 py-2 font-semibold">Program</th>
                <th className="px-3 py-2 font-semibold">Project</th>
                <th className="px-3 py-2 font-semibold">Project Owner</th>
                <th className="px-3 py-2 font-semibold">Due Date</th>
                <th className="px-3 py-2 font-semibold">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {thisWeek.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-hae-slate">
                    No priorities this week
                  </td>
                </tr>
              ) : (
                <TaskTableRows
                  tasks={thisWeek}
                  programsById={programsById}
                  projectsById={projectsById}
                />
              )}
            </tbody>
          </table>
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
        {upcomingOpen && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Priority</th>
                  <th className="px-3 py-2 font-semibold">Task</th>
                  <th className="px-3 py-2 font-semibold">Program</th>
                  <th className="px-3 py-2 font-semibold">Project</th>
                  <th className="px-3 py-2 font-semibold">Project Owner</th>
                  <th className="px-3 py-2 font-semibold">Due Date</th>
                  <th className="px-3 py-2 font-semibold">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {upcomingTop.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-hae-slate">
                      No upcoming tasks
                    </td>
                  </tr>
                ) : (
                  <TaskTableRows
                    tasks={upcomingTop}
                    programsById={programsById}
                    projectsById={projectsById}
                  />
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
