import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { Modal, Linkify } from '@hae/ui'
import { db } from '../firebase'
import ProjectCard from '../components/ProjectCard'
import DocumentGroupsSection from '../components/DocumentGroupsSection'
import EventChecklist from '../components/EventChecklist'
import LeadSelect from '../components/LeadSelect'
import { EVENT_FORMAT_OPTIONS, HEALTH_OPTIONS } from '../constants'
import {
  customProgramStatusBadgeClass,
  formatDate,
  formatLongDate,
  healthBadgeClass,
  healthLabel,
  namesLabel,
  normalizeHealth,
  sortByHealth,
  toNameList,
} from '../utils'

const NO_PROJECTS_COLLECTIONS = ['trackerDocuments', 'trackerEvents']

const emptyProject = {
  name: '',
  lead: [],
  promise: '',
  health: 'ongoing',
  targetDate: '',
  notes: '',
}

/**
 * Generic version of ProgramPage — same Projects/Tasks structure, but backed
 * by a different top-level Firestore collection (e.g. academyPrograms,
 * customPrograms) so it can power additional sidebar categories.
 */
export default function CategoryProgramPage({ collectionName, categoryLabel }) {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dense, setDense] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [newProject, setNewProject] = useState(emptyProject)
  const [editEventOpen, setEditEventOpen] = useState(false)
  const [eventSaving, setEventSaving] = useState(false)
  const [eventForm, setEventForm] = useState(null)
  const [editAcademyOpen, setEditAcademyOpen] = useState(false)
  const [academySaving, setAcademySaving] = useState(false)
  const [academyForm, setAcademyForm] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [programSnap, projectSnap, taskSnap] = await Promise.all([
        getDoc(doc(db, collectionName, itemId)),
        getDocs(collection(db, 'projects')),
        getDocs(collection(db, 'tasks')),
      ])

      if (!programSnap.exists()) {
        setProgram(null)
        setProjects([])
        setTasks([])
        return
      }

      const prog = { id: programSnap.id, ...programSnap.data() }
      const allProjects = projectSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const allTasks = taskSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      setProgram(prog)
      setProjects(
        allProjects.filter((p) => p.programId === itemId).sort(sortByHealth)
      )
      setTasks(allTasks.filter((t) => t.programId === itemId))
    } catch (err) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [collectionName, itemId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

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

  const close = () => {
    if (saving) return
    setOpen(false)
    setNewProject(emptyProject)
  }

  const createProject = async (e) => {
    e.preventDefault()
    if (!newProject.name.trim() || saving) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'projects'), {
        name: newProject.name.trim(),
        lead: newProject.lead,
        promise: newProject.promise.trim(),
        health: newProject.health,
        targetDate: newProject.targetDate || '',
        notes: newProject.notes.trim(),
        programId: itemId,
        createdAt: serverTimestamp(),
      })
      setNewProject(emptyProject)
      setOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const startEditEvent = () => {
    setEventForm({
      name: program.name || '',
      eventDate: program.eventDate || '',
      eventTime: program.eventTime || '',
      marketingDate: program.marketingDate || '',
      venue: program.venue || '',
      format: program.format || '',
      lead: toNameList(program.lead),
      health: program.health || 'not-started',
    })
    setEditEventOpen(true)
  }

  const closeEditEvent = () => {
    if (eventSaving) return
    setEditEventOpen(false)
    setEventForm(null)
  }

  const saveEditEvent = async (e) => {
    e.preventDefault()
    if (!eventForm?.name.trim() || eventSaving) return
    setEventSaving(true)
    try {
      await updateDoc(doc(db, collectionName, itemId), {
        name: eventForm.name.trim(),
        eventDate: eventForm.eventDate,
        eventTime: eventForm.eventTime.trim(),
        marketingDate: eventForm.marketingDate,
        venue: eventForm.venue.trim(),
        format: eventForm.format,
        lead: eventForm.lead,
        health: eventForm.health,
      })
      setEditEventOpen(false)
      setEventForm(null)
      load()
    } finally {
      setEventSaving(false)
    }
  }

  const deleteEvent = async () => {
    if (!confirm(`Delete "${program.name}"? Its checklist is not cascade-deleted. This action cannot be undone.`)) return
    await deleteDoc(doc(db, collectionName, itemId))
    navigate('/events-dashboard')
  }

  const startEditAcademy = () => {
    setAcademyForm({
      name: program.name || '',
      lead: toNameList(program.lead),
      haeLead: toNameList(program.haeLead),
      startDate: program.startDate || '',
      durationWeeks: program.durationWeeks ?? '',
      instructor: program.instructor || '',
      guestSpeaker: program.guestSpeaker || '',
    })
    setEditAcademyOpen(true)
  }

  const closeEditAcademy = () => {
    if (academySaving) return
    setEditAcademyOpen(false)
    setAcademyForm(null)
  }

  const saveEditAcademy = async (e) => {
    e.preventDefault()
    if (!academyForm?.name.trim() || academySaving) return
    setAcademySaving(true)
    try {
      await updateDoc(doc(db, collectionName, itemId), {
        name: academyForm.name.trim(),
        lead: academyForm.lead,
        haeLead: academyForm.haeLead,
        startDate: academyForm.startDate,
        durationWeeks: academyForm.durationWeeks ? Number(academyForm.durationWeeks) : null,
        instructor: academyForm.instructor.trim(),
        guestSpeaker: academyForm.guestSpeaker.trim(),
      })
      setEditAcademyOpen(false)
      setAcademyForm(null)
      load()
    } finally {
      setAcademySaving(false)
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>
  if (error) return <p className="text-sm text-hae-red">{error}</p>
  if (!program)
    return <p className="text-sm text-hae-red">{categoryLabel} item not found.</p>

  const activeProjects = projects.filter((p) => normalizeHealth(p.health) !== 'completed')
  const completedProjects = projects.filter((p) => normalizeHealth(p.health) === 'completed')
  const visibleProjects = showCompleted ? projects : activeProjects

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
            {categoryLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-hae-ink sm:text-3xl">
            {program.name}
          </h1>
          {collectionName === 'trackerEvents' || collectionName === 'chapters' ? null : (
            <p className="mt-1 text-sm text-hae-slate">
              Overall lead: {namesLabel(program.lead) || '—'}
              {projects.length ? ` · ${projects.length} projects` : ''}
            </p>
          )}

          {collectionName === 'trackerEvents' ? (
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Date of Event
                </dt>
                <dd className="text-hae-ink">{formatLongDate(program.eventDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Time of Event
                </dt>
                <dd className="text-hae-ink">{program.eventTime || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Date of Marketing
                </dt>
                <dd className="text-hae-ink">
                  {program.marketingDate ? formatDate(program.marketingDate) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Online or In-Person
                </dt>
                <dd className="text-hae-ink">{program.format || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Venue
                </dt>
                <dd className="text-hae-ink">{program.venue || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  HAE Lead
                </dt>
                <dd className="text-hae-ink">{namesLabel(program.lead) || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Status
                </dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${healthBadgeClass(program.health)}`}
                  >
                    {healthLabel(program.health)}
                  </span>
                </dd>
              </div>
            </dl>
          ) : null}

          {collectionName === 'academyPrograms' ? (
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  HAE Lead
                </dt>
                <dd className="text-hae-ink">{namesLabel(program.haeLead) || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Start date
                </dt>
                <dd className="text-hae-ink">{program.startDate || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Duration
                </dt>
                <dd className="text-hae-ink">
                  {program.durationWeeks ? `${program.durationWeeks} weeks` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Instructor
                </dt>
                <dd className="text-hae-ink">{program.instructor || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Guest speaker
                </dt>
                <dd className="text-hae-ink">{program.guestSpeaker || '—'}</dd>
              </div>
            </dl>
          ) : null}

          {collectionName === 'chapters' ? (
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Chapter Leader/s
                </dt>
                <dd className="text-hae-ink break-words">
                  {program.chapterLeader ? <Linkify text={program.chapterLeader} /> : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Co-Leaders
                </dt>
                <dd className="text-hae-ink break-words">
                  {program.coLeaders ? <Linkify text={program.coLeaders} /> : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Projects
                </dt>
                <dd className="text-hae-ink">{projects.length || '—'}</dd>
              </div>
            </dl>
          ) : null}

          {collectionName === 'customPrograms' ? (
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Start date
                </dt>
                <dd className="text-hae-ink">{program.startDate || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-hae-slate">
                  Status
                </dt>
                <dd>
                  {program.status ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${customProgramStatusBadgeClass(program.status)}`}
                    >
                      {program.status}
                    </span>
                  ) : (
                    <span className="text-hae-ink">—</span>
                  )}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {completedProjects.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="hae-btn-secondary"
            >
              {showCompleted
                ? 'Hide completed'
                : `Show ${completedProjects.length} completed`}
            </button>
          ) : null}
          {!NO_PROJECTS_COLLECTIONS.includes(collectionName) ? (
            <>
              <button
                type="button"
                onClick={() => setDense((v) => !v)}
                className="hae-btn-secondary"
                title={dense ? 'Switch to compact list' : 'Show full table'}
              >
                {dense ? 'Compact list' : 'Dense table'}
              </button>
              <button type="button" className="hae-btn" onClick={() => setOpen(true)}>
                + Add Project
              </button>
            </>
          ) : null}
          {collectionName === 'trackerEvents' ? (
            <>
              <button type="button" onClick={startEditEvent} className="hae-btn-secondary">
                Edit
              </button>
              <button
                type="button"
                onClick={deleteEvent}
                className="text-xs text-hae-slate hover:text-hae-red"
              >
                Delete
              </button>
            </>
          ) : null}
          {collectionName === 'academyPrograms' ? (
            <button type="button" onClick={startEditAcademy} className="hae-btn-secondary">
              Edit
            </button>
          ) : null}
        </div>
      </header>

      {collectionName === 'academyPrograms' ? (
        <Modal
          open={editAcademyOpen}
          onClose={closeEditAcademy}
          title="Edit Academy item"
          busy={academySaving}
          footer={
            <>
              <button
                type="button"
                className="hae-btn-secondary"
                onClick={closeEditAcademy}
                disabled={academySaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-academy-form"
                className="hae-btn"
                disabled={academySaving}
              >
                {academySaving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          {academyForm ? (
            <form id="edit-academy-form" onSubmit={saveEditAcademy} className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium text-hae-slate">Name</span>
                <input
                  required
                  value={academyForm.name}
                  onChange={(e) => setAcademyForm({ ...academyForm, name: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Overall lead</span>
                <LeadSelect
                  value={academyForm.lead}
                  onChange={(lead) => setAcademyForm({ ...academyForm, lead })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">HAE Lead</span>
                <LeadSelect
                  value={academyForm.haeLead}
                  onChange={(haeLead) => setAcademyForm({ ...academyForm, haeLead })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Start date</span>
                <input
                  type="date"
                  value={academyForm.startDate}
                  onChange={(e) => setAcademyForm({ ...academyForm, startDate: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Duration (weeks)</span>
                <input
                  type="number"
                  min="1"
                  value={academyForm.durationWeeks}
                  onChange={(e) =>
                    setAcademyForm({ ...academyForm, durationWeeks: e.target.value })
                  }
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Instructor</span>
                <input
                  value={academyForm.instructor}
                  onChange={(e) => setAcademyForm({ ...academyForm, instructor: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Guest speaker</span>
                <input
                  value={academyForm.guestSpeaker}
                  onChange={(e) =>
                    setAcademyForm({ ...academyForm, guestSpeaker: e.target.value })
                  }
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
              </label>
            </form>
          ) : null}
        </Modal>
      ) : null}

      {collectionName === 'trackerEvents' ? (
        <Modal
          open={editEventOpen}
          onClose={closeEditEvent}
          title="Update event"
          busy={eventSaving}
          footer={
            <>
              <button
                type="button"
                className="hae-btn-secondary"
                onClick={closeEditEvent}
                disabled={eventSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-event-form"
                className="hae-btn"
                disabled={eventSaving}
              >
                {eventSaving ? 'Saving…' : 'Update event'}
              </button>
            </>
          }
        >
          {eventForm ? (
            <form id="edit-event-form" onSubmit={saveEditEvent} className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium text-hae-slate">Event Title</span>
                <input
                  required
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Date of Event</span>
                <input
                  type="date"
                  value={eventForm.eventDate}
                  onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Time of Event (with timezone)</span>
                <input
                  value={eventForm.eventTime}
                  onChange={(e) => setEventForm({ ...eventForm, eventTime: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Date of Marketing</span>
                <input
                  type="date"
                  value={eventForm.marketingDate}
                  onChange={(e) => setEventForm({ ...eventForm, marketingDate: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Online or In-Person</span>
                <select
                  value={eventForm.format}
                  onChange={(e) => setEventForm({ ...eventForm, format: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                >
                  <option value="">Select format</option>
                  {EVENT_FORMAT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Venue</span>
                <input
                  value={eventForm.venue}
                  onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">HAE Lead</span>
                <LeadSelect value={eventForm.lead} onChange={(lead) => setEventForm({ ...eventForm, lead })} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Status</span>
                <select
                  value={eventForm.health}
                  onChange={(e) => setEventForm({ ...eventForm, health: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                >
                  {HEALTH_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
            </form>
          ) : null}
        </Modal>
      ) : null}

      {collectionName === 'trackerDocuments' ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-hae-slate">
            Documents
          </h2>
          <DocumentGroupsSection programId={itemId} />
        </section>
      ) : null}

      {collectionName === 'trackerEvents' ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-hae-slate">
            Checklist
          </h2>
          <EventChecklist eventId={itemId} />
        </section>
      ) : null}

      <Modal
        open={open}
        onClose={close}
        title="Create project"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="create-project-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Create project'}
            </button>
          </>
        }
      >
        <form id="create-project-form" onSubmit={createProject} className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Project name"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          />
          <LeadSelect
            placeholder="Lead"
            value={newProject.lead}
            onChange={(lead) => setNewProject({ ...newProject, lead })}
          />
          <input
            placeholder="Promise / outcome"
            value={newProject.promise}
            onChange={(e) => setNewProject({ ...newProject, promise: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Status</span>
            <select
              value={newProject.health}
              onChange={(e) => setNewProject({ ...newProject, health: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
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
            value={newProject.targetDate}
            onChange={(e) => setNewProject({ ...newProject, targetDate: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Notes"
            rows={3}
            value={newProject.notes}
            onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
            className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
          />
        </form>
      </Modal>

      {!NO_PROJECTS_COLLECTIONS.includes(collectionName) ? (
        <div className="space-y-3">
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hae-line bg-white/60 px-4 py-10 text-center text-sm text-hae-slate">
              No projects yet. Add one to get started.
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hae-line bg-white/60 px-4 py-10 text-center text-sm text-hae-slate">
              All projects are complete — show completed above if needed.
            </div>
          ) : (
            visibleProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                program={program}
                tasks={tasksByProject[project.id] || []}
                onChanged={load}
                dense={dense}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
