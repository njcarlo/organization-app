import { useMemo, useState } from 'react'
import {
  formatDate,
  healthLabel,
  namesLabel,
  programNameOf,
  projectNameOf,
} from '../utils'
import TaskDetailPopup from './TaskDetailPopup'

const PAGE_SIZE = 5

export default function AttentionSection({
  tasks,
  projects,
  programsById,
  projectsById,
  onDataChanged,
}) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)

  const items = useMemo(() => {
    const rows = []

    for (const project of projects) {
      if (
        project.health === 'time-sensitive' ||
        project.health === 'needs-attention' ||
        project.health === 'at-risk'
      ) {
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
          owner: namesLabel(project.lead) || '—',
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
          raw: task,
          taskName: task.name,
          programId: task.programId,
          programName: programNameOf(task, programsById),
          projectName: projectNameOf(task, projectsById),
          issue: task.leadershipAttention,
          waitingOn: task.waitingOn || '—',
          leadershipAction: task.leadershipAttention,
          owner: namesLabel(task.owner) || '—',
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
      <div className="hae-mobile-only">
        <div className="hae-mobile-cards p-3">
          {slice.length === 0 ? (
            <div className="hae-mobile-card text-center text-sm text-hae-slate">
              Nothing needs attention
            </div>
          ) : (
            slice.map((row) => (
              <button
                key={row.id}
                type="button"
                className="hae-mobile-card"
                onClick={() => setSelected(row)}
              >
                <div className="hae-mobile-card__title">{row.taskName}</div>
                <div className="hae-mobile-card__meta">
                  <span>{row.issue}</span>
                  <span>Needed by {formatDate(row.dueDate)}</span>
                  <span>{row.owner}</span>
                  <span className="line-clamp-1">
                    {row.programName || '—'}
                    {row.projectName ? ` · ${row.projectName}` : ''}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="hae-desktop-only hae-table-scroll">
        <table className="w-full min-w-[640px] text-left lg:min-w-[900px]">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Issue</th>
              <th className="hae-col-lg-hide px-3 py-2 font-semibold">Program</th>
              <th className="hae-col-lg-hide px-3 py-2 font-semibold">Project</th>
              <th className="px-3 py-2 font-semibold">Task</th>
              <th className="px-3 py-2 font-semibold">Project Owner</th>
              <th className="px-3 py-2 font-semibold">Needed By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) =>
              row ? (
                <tr
                  key={row.id}
                  className="h-11 cursor-pointer border-b border-hae-line/70 hover:bg-hae-mist/50"
                  onClick={() => setSelected(row)}
                >
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.issue}</td>
                  <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                    {row.programName || '—'}
                  </td>
                  <td className="hae-col-lg-hide px-3 py-2 text-sm text-hae-slate">
                    {row.projectName}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium">{row.taskName}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.owner}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {formatDate(row.dueDate)}
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
        title={selected?.taskName || 'Details'}
        task={selected?.kind === 'task' ? selected.raw : null}
        programsById={programsById}
        projectsById={projectsById}
        editable={selected?.kind === 'task'}
        onSaved={onDataChanged}
        rows={
          selected && selected.kind === 'project'
            ? [
                { label: 'Type', value: 'Project' },
                { label: 'Issue', value: selected.issue },
                { label: 'Program', value: selected.programName || '—' },
                { label: 'Project', value: selected.projectName || '—' },
                { label: 'Owner', value: selected.owner || '—' },
                { label: 'Due', value: formatDate(selected.dueDate) },
              ]
            : []
        }
      />
    </section>
  )
}
