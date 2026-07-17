import { useMemo, useState } from 'react'
import { Linkify } from '@hae/ui'
import {
  effectivePriority,
  formatDate,
  priorityBadgeClass,
  programNameOf,
  projectNameOf,
} from '../utils'
import TaskDetailPopup from './TaskDetailPopup'

const PAGE_SIZE = 5

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

export default function WaitingOnSection({ tasks, programsById, projectsById, onDataChanged }) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)

  const items = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'Complete' && String(t.waitingOn || '').trim())
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  }, [tasks])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const slice = items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const rows = [...slice]
  while (rows.length < PAGE_SIZE) rows.push(null)

  return (
    <section className="overflow-hidden rounded-xl border border-hae-line bg-white">
      <div className="border-b border-hae-line px-4 py-3">
        <h2 className="text-sm font-semibold text-hae-ink">Waiting On</h2>
        <p className="text-xs text-hae-slate">Tasks blocked on someone or something else</p>
      </div>
      <div className="hae-mobile-only">
        <div className="hae-mobile-cards p-3">
          {slice.length === 0 ? (
            <div className="hae-mobile-card text-center text-sm text-hae-slate">
              Nothing waiting
            </div>
          ) : (
            slice.map((task) => (
              <button
                key={task.id}
                type="button"
                className="hae-mobile-card"
                onClick={() => setSelected(task)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="hae-mobile-card__title min-w-0 flex-1">{task.name}</div>
                  <PriorityCell task={task} />
                </div>
                <div className="hae-mobile-card__meta">
                  <span>
                    Waiting on <Linkify text={task.waitingOn} />
                  </span>
                  <span>Needed by {formatDate(task.dueDate)}</span>
                  <span className="line-clamp-1">
                    {programNameOf(task, programsById)}
                    {projectNameOf(task, projectsById)
                      ? ` · ${projectNameOf(task, projectsById)}`
                      : ''}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="hae-desktop-only hae-table-scroll">
        <table className="w-full min-w-[640px] text-left lg:min-w-[820px]">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Priority</th>
              <th className="hae-col-lg-hide px-3 py-2 font-semibold">Program</th>
              <th className="hae-col-lg-hide px-3 py-2 font-semibold">Project</th>
              <th className="px-3 py-2 font-semibold">Task</th>
              <th className="px-3 py-2 font-semibold">Waiting On</th>
              <th className="px-3 py-2 font-semibold">Needed By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task, i) =>
              task ? (
                <tr
                  key={task.id}
                  className="h-11 cursor-pointer border-b border-hae-line/70 hover:bg-hae-mist/50"
                  onClick={() => setSelected(task)}
                >
                  <td className="px-3 py-2">
                    <PriorityCell task={task} />
                  </td>
                  <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                    {programNameOf(task, programsById)}
                  </td>
                  <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                    {projectNameOf(task, projectsById)}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium">{task.name}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    <Linkify text={task.waitingOn} />
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {formatDate(task.dueDate)}
                  </td>
                </tr>
              ) : (
                <tr key={`pad-${i}`} className="h-11 border-b border-hae-line/40">
                  <td colSpan={6} className="px-3 py-2">
                    &nbsp;
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <div className="flex h-10 items-center justify-between border-t border-hae-line px-4 text-xs text-hae-slate">
        <span>
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <TaskDetailPopup
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name || 'Task'}
        task={selected}
        programsById={programsById}
        projectsById={projectsById}
        editable
        onSaved={onDataChanged}
      />
    </section>
  )
}
