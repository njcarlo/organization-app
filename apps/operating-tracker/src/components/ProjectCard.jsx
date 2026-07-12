import { useMemo, useRef, useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { HEALTH_OPTIONS } from '../constants'
import { daysUntil, formatDate, healthBadgeClass, healthLabel, normalizeHealth } from '../utils'
import {
  METRIC_TYPES,
  centsToDollarsInput,
  formatMoney,
  hasProjectMetrics,
  metricTypeLabel,
  parseDollarsToCents,
  pctTowardGoal,
} from '../utils/projectMetrics'
import TaskTable from './TaskTable'

const inputClass =
  'rounded border border-hae-line bg-white px-2 py-1 text-sm outline-none focus:border-hae-crimson'

function isComplete(task) {
  return String(task.status || '').toLowerCase() === 'complete'
}

function MetricTile({ label, value, hint }) {
  return (
    <div className="border border-hae-line bg-white px-3 py-2.5">
      <div className="text-[10px] font-semibold tracking-wider text-hae-slate uppercase">
        {label}
      </div>
      <div className="mt-1 font-display text-xl text-hae-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-hae-slate">{hint}</div> : null}
    </div>
  )
}

export default function ProjectCard({
  project,
  program,
  tasks,
  onChanged,
  dense = false,
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const tableRef = useRef(null)

  const summary = useMemo(() => {
    const active = tasks.filter((t) => !isComplete(t))
    const completed = tasks.length - active.length
    const dated = active
      .filter((t) => t.dueDate)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    const nextDue = dated[0]?.dueDate || null
    return {
      activeCount: active.length,
      completedCount: completed,
      nextDue,
    }
  }, [tasks])

  const metrics = useMemo(() => {
    if (!hasProjectMetrics(project)) return null
    const pct = pctTowardGoal(project.raisedCents, project.goalCents)
    const days = daysUntil(project.targetDate)
    return {
      pct,
      days,
      currency: project.currency || 'usd',
    }
  }, [project])

  const startEdit = () => {
    setDraft({
      name: project.name || '',
      lead: project.lead || '',
      promise: project.promise || '',
      health: normalizeHealth(project.health || 'ongoing'),
      targetDate: project.targetDate || '',
      metricType: project.metricType || '',
      goalDollars: centsToDollarsInput(project.goalCents),
      raisedDollars: centsToDollarsInput(project.raisedCents),
      currency: project.currency || 'usd',
      metricsNotes: project.metricsNotes || '',
      lmsCourseId: project.lmsCourseId || '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!draft?.name.trim()) return
    await updateDoc(doc(db, 'projects', project.id), {
      name: draft.name.trim(),
      lead: draft.lead.trim(),
      promise: draft.promise.trim(),
      health: draft.health,
      targetDate: draft.targetDate || '',
      metricType: draft.metricType || '',
      goalCents: draft.metricType ? parseDollarsToCents(draft.goalDollars) : null,
      raisedCents: draft.metricType ? parseDollarsToCents(draft.raisedDollars) : null,
      currency: draft.metricType ? draft.currency || 'usd' : 'usd',
      metricsNotes: draft.metricType ? draft.metricsNotes.trim() : '',
      lmsCourseId: draft.lmsCourseId.trim(),
    })
    setEditing(false)
    setDraft(null)
    onChanged?.()
  }

  const removeProject = async () => {
    if (!confirm(`Delete project "${project.name}"? Tasks are not cascade-deleted.`)) return
    await deleteDoc(doc(db, 'projects', project.id))
    onChanged?.()
  }

  const handleAddTask = () => {
    setOpen(true)
    requestAnimationFrame(() => tableRef.current?.startAdd())
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hae-line/80 bg-white/85 shadow-[0_1px_0_rgba(26,26,26,0.03)] backdrop-blur-[2px]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hae-line/70 bg-hae-mist/35 px-4 py-3.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
        >
          {editing && draft ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <input
                className={`${inputClass} w-full font-semibold`}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <input
                  className={inputClass}
                  placeholder="Lead"
                  value={draft.lead}
                  onChange={(e) => setDraft({ ...draft, lead: e.target.value })}
                />
                <label className="flex items-center gap-1">
                  <span className="text-xs font-medium text-hae-slate">Status</span>
                  <select
                    className={inputClass}
                    value={draft.health}
                    onChange={(e) => setDraft({ ...draft, health: e.target.value })}
                  >
                    {HEALTH_OPTIONS.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={draft.targetDate}
                  onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })}
                />
              </div>
              <input
                className={`${inputClass} w-full`}
                placeholder="Promise / outcome"
                value={draft.promise}
                onChange={(e) => setDraft({ ...draft, promise: e.target.value })}
              />
              <div className="grid gap-2 border-t border-hae-line/70 pt-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-hae-slate">Metrics type</span>
                  <select
                    className={inputClass}
                    value={draft.metricType}
                    onChange={(e) => setDraft({ ...draft, metricType: e.target.value })}
                  >
                    {METRIC_TYPES.map((t) => (
                      <option key={t.value || 'none'} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                {draft.metricType ? (
                  <>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-medium text-hae-slate">Goal ($)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputClass}
                        value={draft.goalDollars}
                        onChange={(e) =>
                          setDraft({ ...draft, goalDollars: e.target.value })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-medium text-hae-slate">Raised / spent ($)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputClass}
                        value={draft.raisedDollars}
                        onChange={(e) =>
                          setDraft({ ...draft, raisedDollars: e.target.value })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                      <span className="font-medium text-hae-slate">Notes</span>
                      <input
                        className={inputClass}
                        placeholder="Campaign notes"
                        value={draft.metricsNotes}
                        onChange={(e) =>
                          setDraft({ ...draft, metricsNotes: e.target.value })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                      <span className="font-medium text-hae-slate">
                        LMS course ID (optional link)
                      </span>
                      <input
                        className={inputClass}
                        placeholder="Firestore course document id"
                        value={draft.lmsCourseId}
                        onChange={(e) =>
                          setDraft({ ...draft, lmsCourseId: e.target.value })
                        }
                      />
                    </label>
                  </>
                ) : null}
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="font-semibold text-hae-crimson"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setDraft(null)
                  }}
                  className="text-hae-slate"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-hae-ink">{project.name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${healthBadgeClass(project.health)}`}
                >
                  {healthLabel(project.health)}
                </span>
                {metrics ? (
                  <span className="rounded-full bg-hae-crimson/10 px-2 py-0.5 text-[10px] font-semibold text-hae-crimson">
                    {metricTypeLabel(project.metricType)}
                  </span>
                ) : null}
                <span className="text-xs text-hae-slate/70">{open ? '▾' : '▸'}</span>
              </div>
              <p className="mt-1.5 text-xs text-hae-slate">
                <span>{summary.activeCount} active</span>
                {summary.completedCount > 0 ? (
                  <span> · {summary.completedCount} done</span>
                ) : null}
                {summary.nextDue ? (
                  <span> · Next due {formatDate(summary.nextDue)}</span>
                ) : (
                  <span> · No upcoming due dates</span>
                )}
                {project.lead ? <span> · Lead {project.lead}</span> : null}
              </p>
              {metrics ? (
                <p className="mt-1 text-xs font-medium text-hae-ink">
                  {formatMoney(project.raisedCents, metrics.currency)}
                  {project.goalCents
                    ? ` / ${formatMoney(project.goalCents, metrics.currency)}`
                    : ''}
                  {metrics.pct != null ? ` · ${metrics.pct}%` : ''}
                </p>
              ) : null}
              {project.promise ? (
                <p className="mt-1 line-clamp-2 text-sm text-hae-slate/90">{project.promise}</p>
              ) : null}
            </>
          )}
        </button>

        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleAddTask} className="hae-btn">
              + Add Task
            </button>
            <button
              type="button"
              onClick={startEdit}
              className="hae-btn-secondary"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={removeProject}
              className="text-xs text-hae-slate hover:text-hae-red"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="space-y-3 bg-gradient-to-b from-white/40 to-hae-mist/20 p-3 sm:p-4">
          {metrics ? (
            <section className="space-y-2">
              <h4 className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
                Project metrics · {metricTypeLabel(project.metricType)}
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <MetricTile
                  label={project.metricType === 'budget' ? 'Budget' : 'Goal'}
                  value={formatMoney(project.goalCents, metrics.currency)}
                />
                <MetricTile
                  label={project.metricType === 'budget' ? 'Spent' : 'Raised'}
                  value={formatMoney(project.raisedCents, metrics.currency)}
                />
                <MetricTile
                  label="Progress"
                  value={metrics.pct != null ? `${metrics.pct}%` : '—'}
                  hint={
                    project.goalCents
                      ? `${formatMoney(
                          Math.max(
                            0,
                            (Number(project.goalCents) || 0) -
                              (Number(project.raisedCents) || 0)
                          ),
                          metrics.currency
                        )} remaining`
                      : undefined
                  }
                />
                <MetricTile
                  label="Target date"
                  value={formatDate(project.targetDate)}
                  hint={
                    metrics.days == null
                      ? undefined
                      : metrics.days < 0
                        ? `${Math.abs(metrics.days)}d overdue`
                        : metrics.days === 0
                          ? 'Due today'
                          : `${metrics.days}d left`
                  }
                />
              </div>
              {project.metricsNotes ? (
                <p className="text-xs text-hae-slate">{project.metricsNotes}</p>
              ) : null}
              {project.lmsCourseId ? (
                <p className="text-[11px] text-hae-slate">
                  Linked LMS course ID:{' '}
                  <span className="font-medium text-hae-ink">{project.lmsCourseId}</span>
                </p>
              ) : null}
            </section>
          ) : null}

          <div>
            <h4 className="mb-2 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
              Tasks
            </h4>
            <TaskTable
              ref={tableRef}
              tasks={tasks}
              project={project}
              program={program}
              onChanged={onChanged}
              dense={dense}
            />
          </div>
        </div>
      )}
    </div>
  )
}
