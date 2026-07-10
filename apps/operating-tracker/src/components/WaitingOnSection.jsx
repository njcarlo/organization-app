import { useMemo, useState } from 'react'
import { formatDate, programNameOf, projectNameOf } from '../utils'

const PAGE_SIZE = 5

export default function WaitingOnSection({ tasks, programsById, projectsById }) {
  const [page, setPage] = useState(0)

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
              <div key={task.id} className="hae-mobile-card">
                <div className="hae-mobile-card__title">{task.name}</div>
                <div className="hae-mobile-card__meta">
                  <span>Waiting on {task.waitingOn}</span>
                  <span>Needed by {formatDate(task.dueDate)}</span>
                  <span className="line-clamp-1">
                    {programNameOf(task, programsById)}
                    {projectNameOf(task, projectsById)
                      ? ` · ${projectNameOf(task, projectsById)}`
                      : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="hae-desktop-only hae-table-scroll">
        <table className="w-full min-w-[520px] text-left lg:min-w-[700px]">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Task</th>
              <th className="px-3 py-2 font-semibold">Waiting On</th>
              <th className="hae-col-lg-hide px-3 py-2 font-semibold">Program</th>
              <th className="hae-col-lg-hide px-3 py-2 font-semibold">Project</th>
              <th className="px-3 py-2 font-semibold">Needed By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task, i) =>
              task ? (
                <tr key={task.id} className="h-11 border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm font-medium">{task.name}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{task.waitingOn}</td>
                  <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                    {programNameOf(task, programsById)}
                  </td>
                  <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                    {projectNameOf(task, projectsById)}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {formatDate(task.dueDate)}
                  </td>
                </tr>
              ) : (
                <tr key={`pad-${i}`} className="h-11 border-b border-hae-line/40">
                  <td colSpan={5} className="px-3 py-2">
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
    </section>
  )
}
