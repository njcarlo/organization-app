import { useMemo, useState } from 'react'
import {
  formatDate,
  healthLabel,
  programNameOf,
  projectNameOf,
} from '../utils'

const PAGE_SIZE = 5

export default function AttentionSection({
  tasks,
  projects,
  programsById,
  projectsById,
}) {
  const [page, setPage] = useState(0)

  const items = useMemo(() => {
    const rows = []

    for (const project of projects) {
      if (project.health === 'needs-attention' || project.health === 'at-risk') {
        rows.push({
          id: `project-${project.id}`,
          kind: 'project',
          taskName: project.name,
          programId: project.programId,
          programName: programsById[project.programId]?.name,
          projectName: project.name,
          issue: healthLabel(project.health),
          waitingOn: '',
          leadershipAction: '—',
          owner: project.lead || '—',
          dueDate: project.targetDate || '',
        })
      }
    }

    for (const task of tasks) {
      if (
        task.leadershipAttention === 'Review Needed' ||
        task.leadershipAttention === 'Decision Needed'
      ) {
        rows.push({
          id: `task-${task.id}`,
          kind: 'task',
          taskName: task.name,
          programId: task.programId,
          programName: programNameOf(task, programsById),
          projectName: projectNameOf(task, projectsById),
          issue: task.leadershipAttention,
          waitingOn: task.waitingOn || '—',
          leadershipAction: task.leadershipAttention,
          owner: task.owner || '—',
          dueDate: task.dueDate || '',
        })
      }
    }

    return rows
  }, [tasks, projects, programsById, projectsById])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const slice = items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const rows = [...slice]
  while (rows.length < PAGE_SIZE) rows.push(null)

  return (
    <section className="overflow-hidden rounded-xl border border-hae-line bg-white">
      <div className="border-b border-hae-line px-4 py-3">
        <h2 className="text-sm font-semibold text-hae-ink">Attention Required</h2>
        <p className="text-xs text-hae-slate">
          At-risk projects and tasks needing leadership action
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Task</th>
              <th className="px-3 py-2 font-semibold">Program</th>
              <th className="px-3 py-2 font-semibold">Project</th>
              <th className="px-3 py-2 font-semibold">Issue</th>
              <th className="px-3 py-2 font-semibold">Waiting On</th>
              <th className="px-3 py-2 font-semibold">Leadership Action</th>
              <th className="px-3 py-2 font-semibold">Owner</th>
              <th className="px-3 py-2 font-semibold">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) =>
              row ? (
                <tr key={row.id} className="border-b border-hae-line/70 h-11">
                  <td className="px-3 py-2 text-sm font-medium">{row.taskName}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {row.programName || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.projectName}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.issue}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.waitingOn || '—'}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {row.leadershipAction}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.owner}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {formatDate(row.dueDate)}
                  </td>
                </tr>
              ) : (
                <tr key={`pad-${i}`} className="border-b border-hae-line/40 h-11">
                  <td colSpan={8} className="px-3 py-2">&nbsp;</td>
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
