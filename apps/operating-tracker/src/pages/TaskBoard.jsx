import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import ProjectCard from '../components/ProjectCard'
import AddTaskModal from '../components/AddTaskModal'
import {
  effectivePriority,
  formatDate,
  namesLabel,
  normalizeHealth,
  normalizeTaskStatus,
  priorityBadgeClass,
  sortByOrder,
  statusBadgeClass,
} from '../utils'

const VIEWS = [
  { id: 'board', label: 'Board' },
  { id: 'table', label: 'Table' },
  { id: 'timeline', label: 'Timeline' },
]

const SORT_OPTIONS = [
  { id: 'order', label: 'Manual order' },
  { id: 'az', label: 'A–Z' },
  { id: 'due', label: 'Next due date' },
]

function isCompleteTask(task) {
  return String(task.status || '').toLowerCase() === 'complete'
}

/** Flat, read-only rollup of tasks across all visible projects — for scanning
 * everything at once rather than opening each project's board group. */
function TaskBoardTable({ tasks, projectsById, programsById }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-hae-line bg-white/60 px-4 py-10 text-center text-sm text-hae-slate">
        No tasks match this filter.
      </div>
    )
  }
  return (
    <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
      <table className="w-full min-w-[880px] text-left">
        <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
          <tr>
            <th className="px-3 py-2 font-semibold">Task</th>
            <th className="px-3 py-2 font-semibold">Program / Project</th>
            <th className="px-3 py-2 font-semibold">Owner</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Due</th>
            <th className="px-3 py-2 font-semibold">Priority</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const project = projectsById[task.projectId]
            const program = programsById[task.programId]
            return (
              <tr
                key={task.id}
                className={`border-b border-hae-line/70 hover:bg-hae-mist/40 ${
                  isCompleteTask(task) ? 'opacity-60' : ''
                }`}
              >
                <td className="px-3 py-2 text-sm font-medium text-hae-ink">{task.name}</td>
                <td className="px-3 py-2 text-sm text-hae-slate">
                  {project ? (
                    <Link
                      to={`/programs/${task.programId}`}
                      className="hover:text-hae-crimson"
                    >
                      {(program?.name || task.programName || '—') + ' · ' + (project.name || task.projectName || '—')}
                    </Link>
                  ) : (
                    (program?.name || task.programName || '—') + ' · ' + (task.projectName || '—')
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-hae-slate">
                  {namesLabel(task.owner) || 'Unassigned'}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(task.status)}`}
                  >
                    {normalizeTaskStatus(task.status) || '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-hae-slate">{formatDate(task.dueDate)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeClass(effectivePriority(task))}`}
                  >
                    {effectivePriority(task)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Unified, cross-program board view: every project as a collapsible group of
 * tasks (same TaskTable/ProjectCard used on a single Program page), so you
 * can scan or edit tasks across the whole tracker without hopping between
 * program pages. Layout adapted from a Claude Design mockup; colors/fonts
 * stay on HAE tokens.
 */
export default function TaskBoard() {
  const [programs, setPrograms] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('board')
  const [programFilter, setProgramFilter] = useState('all')
  const [sortMode, setSortMode] = useState('order')
  const [showCompleted, setShowCompleted] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)

  const load = useCallback(async () => {
    const [programSnap, projectSnap, taskSnap] = await Promise.all([
      getDocs(collection(db, 'programs')),
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'tasks')),
    ])
    setPrograms(programSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortByOrder))
    setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const programsById = useMemo(
    () => Object.fromEntries(programs.map((p) => [p.id, p])),
    [programs]
  )

  const tasksByProject = useMemo(() => {
    const map = {}
    for (const t of tasks) {
      if (!map[t.projectId]) map[t.projectId] = []
      map[t.projectId].push(t)
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    }
    return map
  }, [tasks])

  // Projects live under many category collections (academy, chapters, ...),
  // not only `programs` — the board only covers the `programs` hierarchy.
  const trackerProjects = useMemo(
    () => projects.filter((p) => programsById[p.programId]),
    [projects, programsById]
  )

  const visibleProjects = useMemo(() => {
    let list = trackerProjects.filter((p) =>
      programFilter === 'all' ? true : p.programId === programFilter
    )
    if (!showCompleted) {
      list = list.filter((p) => normalizeHealth(p.health) !== 'completed')
    }
    if (sortMode === 'az') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    } else if (sortMode === 'due') {
      const nextDue = (p) => {
        const dated = (tasksByProject[p.id] || [])
          .filter((t) => t.dueDate && !isCompleteTask(t))
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        return dated[0]?.dueDate || '9999-99-99'
      }
      list = [...list].sort((a, b) => nextDue(a).localeCompare(nextDue(b)))
    } else {
      list = [...list].sort(sortByOrder)
    }
    return list
  }, [trackerProjects, programFilter, showCompleted, sortMode, tasksByProject])

  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects.map((p) => p.id)),
    [visibleProjects]
  )
  const visibleTasks = useMemo(
    () => tasks.filter((t) => visibleProjectIds.has(t.projectId)),
    [tasks, visibleProjectIds]
  )
  const projectsById = useMemo(
    () => Object.fromEntries(trackerProjects.map((p) => [p.id, p])),
    [trackerProjects]
  )

  const activeCount = visibleTasks.filter((t) => !isCompleteTask(t)).length
  const attentionCount = visibleTasks.filter(
    (t) => t.status === 'Needs Attention' || t.status === 'Time Sensitive'
  ).length
  const selectedProgram = programFilter === 'all' ? null : programsById[programFilter]

  if (loading) return <p className="text-sm text-hae-slate">Loading board…</p>

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
              Board
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-hae-ink sm:text-3xl">
              {selectedProgram ? selectedProgram.name : 'All programs'}
            </h1>
            <p className="mt-1 text-sm text-hae-slate">
              {visibleProjects.length} project{visibleProjects.length === 1 ? '' : 's'} ·{' '}
              {activeCount} active task{activeCount === 1 ? '' : 's'}
              {attentionCount ? ` · ${attentionCount} need attention` : ''}
            </p>
          </div>
          <button type="button" className="hae-btn" onClick={() => setAddTaskOpen(true)}>
            + New task
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-hae-line">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`px-3 py-2 text-sm font-semibold ${
                view === v.id
                  ? 'border-b-2 border-hae-crimson text-hae-ink'
                  : 'border-b-2 border-transparent text-hae-slate hover:text-hae-ink'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="rounded-md border border-hae-line bg-white px-3 py-1.5 text-xs font-medium text-hae-slate outline-none focus:border-hae-crimson"
          >
            <option value="all">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="rounded-md border border-hae-line bg-white px-3 py-1.5 text-xs font-medium text-hae-slate outline-none focus:border-hae-crimson"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                Sort: {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              showCompleted
                ? 'border-hae-crimson text-hae-crimson'
                : 'border-hae-line text-hae-slate hover:border-hae-slate'
            }`}
          >
            {showCompleted ? 'Showing completed projects' : 'Show completed projects'}
          </button>
        </div>
      </header>

      {view === 'timeline' ? (
        <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hae-line bg-hae-mist/40 text-center">
          <p className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-hae-slate">
            Timeline view — not designed yet
          </p>
          <p className="rounded-md bg-white px-2.5 py-1 text-xs text-hae-slate/80">
            Same tasks, plotted on due date
          </p>
        </div>
      ) : view === 'table' ? (
        <TaskBoardTable tasks={visibleTasks} projectsById={projectsById} programsById={programsById} />
      ) : visibleProjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hae-line bg-white/60 px-4 py-10 text-center text-sm text-hae-slate">
          No projects match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              program={programsById[project.programId]}
              programPath={`/programs/${project.programId}`}
              tasks={tasksByProject[project.id] || []}
              onChanged={load}
              defaultOpen
              showProgramTag={programFilter === 'all'}
            />
          ))}
        </div>
      )}

      <AddTaskModal open={addTaskOpen} onClose={() => setAddTaskOpen(false)} onCreated={load} />
    </div>
  )
}
