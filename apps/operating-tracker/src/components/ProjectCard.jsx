import { useMemo, useRef, useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Linkify } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { HEALTH_OPTIONS } from '../constants'
import {
  formatDate,
  healthBadgeClass,
  healthLabel,
  namesLabel,
  normalizeHealth,
  toNameList,
} from '../utils'
import { diffProjectFields, logHistory } from '../utils/activityLog'
import TaskTable from './TaskTable'
import LeadSelect from './LeadSelect'
import CommentsPanel from './CommentsPanel'
import ActivityLog from './ActivityLog'

const inputClass =
  'rounded border border-hae-line bg-white px-2 py-1 text-sm outline-none focus:border-hae-crimson'

function isComplete(task) {
  return String(task.status || '').toLowerCase() === 'complete'
}

export default function ProjectCard({
  project,
  program,
  programPath,
  tasks,
  onChanged,
  dense = false,
}) {
  const { user, userProfile } = useAuth()
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

  const startEdit = () => {
    setDraft({
      name: project.name || '',
      lead: toNameList(project.lead),
      promise: project.promise || '',
      health: normalizeHealth(project.health || 'ongoing'),
      targetDate: project.targetDate || '',
      notes: project.notes || '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!draft?.name.trim()) return
    const payload = {
      name: draft.name.trim(),
      lead: draft.lead,
      promise: draft.promise.trim(),
      health: draft.health,
      targetDate: draft.targetDate || '',
      notes: draft.notes.trim(),
    }
    await updateDoc(doc(db, 'projects', project.id), payload)
    const changes = diffProjectFields(project, payload)
    if (changes.length) {
      logHistory({
        parentType: 'projects',
        parentId: project.id,
        parentName: payload.name,
        programId: project.programId || program?.id,
        action: 'updated',
        changes,
        byId: user?.uid,
        byName: userProfile?.name || user?.email || 'Someone',
      })
    }
    setEditing(false)
    setDraft(null)
    onChanged?.()
  }

  const removeProject = async () => {
    if (!confirm(`Delete project "${project.name}"? Tasks are not cascade-deleted. This action cannot be undone.`)) return
    await deleteDoc(doc(db, 'projects', project.id))
    logHistory({
      parentType: 'projects',
      parentId: project.id,
      parentName: project.name,
      programId: project.programId || program?.id,
      action: 'deleted',
      snapshot: project,
      byId: user?.uid,
      byName: userProfile?.name || user?.email || 'Someone',
    })
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
                <LeadSelect
                  className={inputClass}
                  placeholder="Lead"
                  value={draft.lead}
                  onChange={(lead) => setDraft({ ...draft, lead })}
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
              <textarea
                className={`${inputClass} w-full`}
                placeholder="Notes"
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
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
                {tasks.length ? (
                  <span
                    className="rounded-full bg-hae-mist px-2 py-0.5 text-[10px] font-semibold text-hae-slate"
                    title={`${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
                  >
                    {tasks.length}
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
                {namesLabel(project.lead) ? (
                  <span> · Lead {namesLabel(project.lead)}</span>
                ) : null}
              </p>
              {project.promise ? (
                <p className="mt-1 line-clamp-2 text-sm text-hae-slate/90">
                  <Linkify text={project.promise} />
                </p>
              ) : null}
              {project.notes ? (
                <p className="mt-1 line-clamp-2 text-xs text-hae-slate/80">
                  Notes: <Linkify text={project.notes} />
                </p>
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
          <div className="border-t border-hae-line/60 pt-3">
            <CommentsPanel
              parentType="projects"
              parentId={project.id}
              parentName={project.name}
              programId={project.programId || program?.id}
              programPath={programPath}
            />
          </div>
          <div className="border-t border-hae-line/60 pt-3">
            <ActivityLog parentType="projects" parentId={project.id} />
          </div>
        </div>
      )}
    </div>
  )
}
