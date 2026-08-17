import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import CommentIndicator from '../components/CommentIndicator'
import CommentsDrawer from '../components/CommentsDrawer'
import LeadSelect from '../components/LeadSelect'
import { LinksEditor, parseLinks, sanitizeLinks } from '../components/Links'
import { LEADERSHIP_ATTENTION, TASK_STATUSES } from '../constants'
import { diffTaskFields, logHistory } from '../utils/activityLog'
import {
  effectivePriority,
  formatDate,
  normalizeTaskStatus,
  priorityBadgeClass,
  sortByPriorityThenDue,
  statusBadgeClass,
  toNameList,
} from '../utils'

// Regina's display name in userProfiles may include a last name, so match by
// substring rather than hard-coding the full name.
const isRegina = (name) => typeof name === 'string' && name.toLowerCase().includes('regina')

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * Regina's own cross-course view: every Academy task assigned to her,
 * grouped by course. Available to everyone regardless of section access —
 * it lives in the sidebar's fixed Workspace group, not the Academy section,
 * so section-restricted staff can still reach it.
 */
export default function RhrAcademyTasks() {
  const { user, userProfile } = useAuth()
  const [courses, setCourses] = useState([])
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const load = useCallback(async () => {
    const [courseSnap, taskSnap, projectSnap] = await Promise.all([
      getDocs(collection(db, 'academyPrograms')),
      getDocs(collection(db, 'tasks')),
      getDocs(collection(db, 'projects')),
    ])
    setCourses(courseSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const projectsById = useMemo(() => {
    const map = {}
    for (const p of projects) map[p.id] = p
    return map
  }, [projects])

  const reginaTasks = useMemo(
    () => tasks.filter((t) => toNameList(t.owner).some(isRegina)),
    [tasks]
  )

  const groups = useMemo(() => {
    const byCourse = {}
    for (const task of reginaTasks) {
      const course = courses.find((c) => c.id === task.programId)
      if (!course) continue // only Academy tasks belong here
      if (!byCourse[course.id]) byCourse[course.id] = { course, tasks: [] }
      byCourse[course.id].tasks.push(task)
    }
    return Object.values(byCourse)
      .map((g) => ({ ...g, tasks: [...g.tasks].sort(sortByPriorityThenDue) }))
      .sort((a, b) => (a.course.name || '').localeCompare(b.course.name || ''))
  }, [reginaTasks, courses])

  const totalCount = groups.reduce((sum, g) => sum + g.tasks.length, 0)

  const startEdit = (task) => {
    setEditingId(task.id)
    setDraft({
      name: task.name || '',
      owner: toNameList(task.owner),
      dueDate: task.dueDate || '',
      status: normalizeTaskStatus(task.status || 'Not Started'),
      priority: task.priority || '',
      waitingOn: task.waitingOn || '',
      leadershipAttention: task.leadershipAttention || 'None',
      nextAction: task.nextAction || '',
      notes: task.notes || '',
      links: parseLinks(task.links),
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(null)
    setCommentsOpen(false)
  }

  const saveEdit = async () => {
    if (!draft?.name.trim() || saving) return
    setSaving(true)
    try {
      const before = tasks.find((t) => t.id === editingId)
      const payload = {
        name: draft.name.trim(),
        owner: draft.owner,
        dueDate: draft.dueDate || '',
        status: draft.status,
        priority: draft.priority,
        waitingOn: draft.waitingOn.trim(),
        leadershipAttention: draft.leadershipAttention,
        nextAction: draft.nextAction.trim(),
        notes: draft.notes.trim(),
        links: sanitizeLinks(draft.links),
      }
      await updateDoc(doc(db, 'tasks', editingId), payload)
      const changes = diffTaskFields(before, payload)
      if (changes.length) {
        logHistory({
          parentType: 'tasks',
          parentId: editingId,
          parentName: payload.name,
          action: 'updated',
          changes,
          byId: user?.uid,
          byName: userProfile?.name || user?.email || 'Someone',
        })
      }
      cancelEdit()
      await load()
    } finally {
      setSaving(false)
    }
  }

  const removeTask = async (id) => {
    if (!confirm('Delete this task? This action cannot be undone.')) return
    const before = tasks.find((t) => t.id === id)
    await deleteDoc(doc(db, 'tasks', id))
    logHistory({
      parentType: 'tasks',
      parentId: id,
      parentName: before?.name,
      action: 'deleted',
      snapshot: before || null,
      byId: user?.uid,
      byName: userProfile?.name || user?.email || 'Someone',
    })
    if (editingId === id) cancelEdit()
    await load()
  }

  const onEditKeyDown = (e) => {
    if (e.key === 'Escape') cancelEdit()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading tasks…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
          RHR Academy Things to Do
        </h1>
        <p className="mt-1 text-sm text-hae-slate">
          {totalCount} Academy task{totalCount === 1 ? '' : 's'} assigned to Regina, grouped by course
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hae-line bg-white/60 px-4 py-10 text-center text-sm text-hae-slate">
          No Academy tasks assigned to Regina yet.
        </div>
      ) : (
        groups.map(({ course, tasks: courseTasks }) => (
          <section key={course.id} className="space-y-2">
            <h2 className="text-lg font-semibold text-hae-ink">
              {course.name}
              <span className="ml-2 text-xs font-normal text-hae-slate">
                {courseTasks.length} task{courseTasks.length === 1 ? '' : 's'}
              </span>
            </h2>

            {/* Mobile: card stack — tap opens edit popup */}
            <div className="hae-mobile-only hae-mobile-cards">
              {courseTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="hae-mobile-card"
                  onClick={() => startEdit(task)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="hae-mobile-card__title min-w-0 flex-1 flex items-center gap-1.5">
                      <span className="min-w-0">{task.name}</span>
                      <CommentIndicator count={task.commentCount} />
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityBadgeClass(effectivePriority(task))}`}
                    >
                      {effectivePriority(task)}
                    </span>
                  </div>
                  <div className="hae-mobile-card__meta">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(task.status)}`}
                    >
                      {task.status ? normalizeTaskStatus(task.status) : '—'}
                    </span>
                    <span>
                      {projectsById[task.projectId]?.name || task.projectName || '—'}
                    </span>
                    <span>Due {formatDate(task.dueDate)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop: table with the columns Regina asked for */}
            <div className="hae-desktop-only overflow-hidden rounded-xl border border-hae-line bg-white">
              <div className="hae-table-scroll">
                <table className="w-full min-w-[640px] text-left">
                  <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Priority</th>
                      <th className="px-3 py-2 font-semibold">Projects</th>
                      <th className="px-3 py-2 font-semibold">Tasks</th>
                      <th className="px-3 py-2 font-semibold">Due Date</th>
                      <th className="px-3 py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {courseTasks.map((task) => (
                      <tr key={task.id} className="group border-b border-hae-line/70">
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityBadgeClass(effectivePriority(task))}`}
                          >
                            {effectivePriority(task)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-hae-slate">
                          <span className="line-clamp-2">
                            {projectsById[task.projectId]?.name || task.projectName || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm font-medium">
                          <div className="flex items-center gap-1.5">
                            <span className="line-clamp-2">{task.name}</span>
                            <CommentIndicator count={task.commentCount} />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-hae-slate">
                          {formatDate(task.dueDate)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => startEdit(task)}
                              className="text-xs text-hae-slate hover:text-hae-crimson"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTask(task.id)}
                              className="text-xs text-hae-slate hover:text-hae-red"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))
      )}

      <Modal
        open={Boolean(editingId && draft)}
        onClose={cancelEdit}
        title="Edit task"
        busy={saving}
        size="xl"
        footer={
          <>
            <button
              type="button"
              className="mr-auto text-xs text-hae-slate hover:text-hae-red"
              disabled={saving}
              onClick={() => editingId && removeTask(editingId)}
            >
              Delete
            </button>
            {editingId ? (
              <button
                type="button"
                className="hae-btn-secondary inline-flex items-center gap-1.5"
                onClick={() => setCommentsOpen(true)}
              >
                Comments
                <CommentIndicator
                  count={tasks.find((t) => t.id === editingId)?.commentCount}
                />
              </button>
            ) : null}
            <button
              type="button"
              className="hae-btn-secondary"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="hae-btn disabled:opacity-60"
              disabled={saving}
              onClick={saveEdit}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div>
          {draft ? (
            <div className="grid gap-3 sm:grid-cols-2" onKeyDown={onEditKeyDown}>
              <Field label="Task" className="sm:col-span-2">
                <input
                  autoFocus
                  className={fieldClass}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Owner">
                <LeadSelect
                  className={fieldClass}
                  value={draft.owner}
                  onChange={(owner) => setDraft({ ...draft, owner })}
                />
              </Field>
              <Field label="Priority">
                <select
                  className={fieldClass}
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                >
                  <option value="">Auto</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  className={fieldClass}
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Due">
                <input
                  type="date"
                  className={fieldClass}
                  value={draft.dueDate}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                />
              </Field>
              <Field label="Waiting on">
                <input
                  className={fieldClass}
                  value={draft.waitingOn}
                  onChange={(e) => setDraft({ ...draft, waitingOn: e.target.value })}
                />
              </Field>
              <Field label="Leadership">
                <select
                  className={fieldClass}
                  value={draft.leadershipAttention}
                  onChange={(e) =>
                    setDraft({ ...draft, leadershipAttention: e.target.value })
                  }
                >
                  {LEADERSHIP_ATTENTION.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Next action" className="sm:col-span-2">
                <input
                  className={fieldClass}
                  value={draft.nextAction}
                  onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })}
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <textarea
                  className={fieldClass}
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </Field>
              <LinksEditor
                className="sm:col-span-2"
                links={draft.links}
                onChange={(links) => setDraft({ ...draft, links })}
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <CommentsDrawer
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        parentType="tasks"
        parentId={editingId}
        parentName={draft?.name}
      />
    </div>
  )
}
