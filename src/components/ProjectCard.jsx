import { useRef, useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { HEALTH_OPTIONS } from '../constants'
import { healthBadgeClass, healthLabel } from '../utils'
import TaskTable from './TaskTable'

const inputClass =
  'rounded border border-hae-line bg-white px-2 py-1 text-sm outline-none focus:border-hae-crimson'

export default function ProjectCard({ project, program, tasks, onChanged }) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const tableRef = useRef(null)

  const startEdit = () => {
    setDraft({
      name: project.name || '',
      lead: project.lead || '',
      promise: project.promise || '',
      health: project.health || 'on-track',
      targetDate: project.targetDate || '',
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
    // Allow expand to render before focusing add row
    requestAnimationFrame(() => tableRef.current?.startAdd())
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hae-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hae-line px-4 py-3">
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
                <h3 className="text-base font-semibold text-hae-ink">{project.name}</h3>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${healthBadgeClass(project.health)}`}
                >
                  {healthLabel(project.health)}
                </span>
                <span className="text-xs text-hae-slate">{open ? '▾' : '▸'}</span>
              </div>
              <p className="mt-1 text-xs text-hae-slate">
                Lead: {project.lead || '—'}
                {project.targetDate ? ` · Target ${project.targetDate}` : ''}
              </p>
              {project.promise ? (
                <p className="mt-1 text-sm text-hae-slate">{project.promise}</p>
              ) : null}
            </>
          )}
        </button>

        {!editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddTask}
              className="rounded-md bg-hae-crimson px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-hae-crimson-dark"
            >
              + Add Task
            </button>
            <button
              type="button"
              onClick={startEdit}
              className="text-xs text-hae-slate hover:text-hae-crimson"
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
        <div className="p-3">
          <TaskTable
            ref={tableRef}
            tasks={tasks}
            project={project}
            program={program}
            onChanged={onChanged}
          />
        </div>
      )}
    </div>
  )
}
