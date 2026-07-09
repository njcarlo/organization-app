import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import {
  HEALTH_OPTIONS,
  LEADERSHIP_ATTENTION,
  PRIORITIES,
  TASK_STATUSES,
} from '../constants'
import {
  CHECKIN_TYPES,
  COURSE_STATUSES,
  ENROLLMENT_STATUSES,
  LEARNING_PATHS,
  MODULE_TYPES,
} from '../../../lms/src/constants.js'
import { EXPERT_STATUSES, EXPERTISE_SUGGESTIONS } from '../../../eir/src/constants.js'
import {
  CONTACT_TYPES,
  INTERACTION_TYPES,
  PIPELINE_STAGES,
  REGIONS,
} from '../../../crm/src/constants.js'
import {
  COMMITTEE_ROLES,
  MEMBER_STATUSES,
  MEMBERSHIP_TIERS,
  PAYMENT_STATUSES,
} from '../../../ams/src/constants.js'

const ITEM_TYPES = [
  { id: 'project', label: 'Project', app: 'Tracker' },
  { id: 'task', label: 'Task', app: 'Tracker' },
  { id: 'course', label: 'Course', app: 'LMS' },
  { id: 'module', label: 'Module', app: 'LMS' },
  { id: 'enrollment', label: 'Enrollment', app: 'LMS' },
  { id: 'session', label: 'Office hours', app: 'LMS' },
  { id: 'checkIn', label: 'Check-in', app: 'LMS' },
  { id: 'certificate', label: 'Certificate', app: 'LMS' },
  { id: 'expert', label: 'Expert', app: 'EiR' },
  { id: 'contact', label: 'Contact', app: 'CRM' },
  { id: 'interaction', label: 'Interaction', app: 'CRM' },
  { id: 'member', label: 'Member', app: 'AMS' },
  { id: 'membership', label: 'Membership', app: 'AMS' },
  { id: 'event', label: 'Event', app: 'AMS' },
  { id: 'committee', label: 'Committee', app: 'AMS' },
]

const fieldClass =
  'rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson'
const labelClass = 'mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

function parseTags(text) {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

const emptyForms = {
  project: {
    programId: '',
    name: '',
    lead: '',
    promise: '',
    health: 'on-track',
    targetDate: '',
  },
  task: {
    programId: '',
    projectId: '',
    name: '',
    owner: '',
    dueDate: '',
    status: 'Not Started',
    priority: '',
    waitingOn: '',
    leadershipAttention: 'None',
    nextAction: '',
  },
  course: {
    name: '',
    path: 'academy',
    facilitator: '',
    description: '',
    durationWeeks: '',
    status: 'Draft',
  },
  module: {
    courseId: '',
    title: '',
    type: 'Lesson',
    order: '',
    resourceUrl: '',
  },
  enrollment: {
    learnerName: '',
    learnerEmail: '',
    courseId: '',
    status: 'Enrolled',
    progress: '0',
  },
  session: {
    title: 'Office Hours',
    courseId: '',
    date: '',
    time: '',
    location: '',
    zoomLink: '',
  },
  checkIn: {
    learnerName: '',
    learnerEmail: '',
    courseId: '',
    type: '60-day',
    dueDate: '',
    notes: '',
  },
  certificate: { enrollmentId: '' },
  expert: {
    name: '',
    title: '',
    organization: '',
    email: '',
    bio: '',
    expertiseText: '',
    linkedinUrl: '',
    bookingUrl: '',
    photoUrl: '',
    status: 'Active',
  },
  contact: {
    name: '',
    email: '',
    type: 'alumni',
    region: 'North America',
    tags: '',
    stage: 'prospect',
    notes: '',
    followUpDate: '',
  },
  interaction: {
    contactId: '',
    type: 'Email',
    date: '',
    subject: '',
    notes: '',
  },
  member: {
    name: '',
    email: '',
    cohort: '',
    chapter: '',
    status: 'active',
    joinDate: '',
  },
  membership: {
    memberId: '',
    tier: 'standard',
    renewalDate: '',
    paymentStatus: 'Pending',
  },
  event: {
    name: '',
    date: '',
    location: '',
    capacity: '',
    description: '',
  },
  committee: {
    name: '',
    memberId: '',
    role: 'Member',
    notes: '',
  },
}

export default function AdminAddItems() {
  const [itemType, setItemType] = useState('project')
  const [form, setForm] = useState(emptyForms.project)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lookups, setLookups] = useState({
    programs: [],
    projects: [],
    courses: [],
    enrollments: [],
    contacts: [],
    members: [],
  })
  const [lookupsReady, setLookupsReady] = useState(false)

  const loadLookups = useCallback(async () => {
    const [
      programSnap,
      projectSnap,
      courseSnap,
      enrollmentSnap,
      contactSnap,
      memberSnap,
    ] = await Promise.all([
      getDocs(collection(db, 'programs')),
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'courses')),
      getDocs(collection(db, 'enrollments')),
      getDocs(collection(db, 'contacts')),
      getDocs(collection(db, 'members')),
    ])
    const sortName = (a, b) => (a.name || '').localeCompare(b.name || '')
    setLookups({
      programs: programSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
      projects: projectSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(sortName),
      courses: courseSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(sortName),
      enrollments: enrollmentSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.learnerName || '').localeCompare(b.learnerName || '')
        ),
      contacts: contactSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(sortName),
      members: memberSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(sortName),
    })
    setLookupsReady(true)
  }, [])

  useEffect(() => {
    loadLookups()
  }, [loadLookups])

  const selectType = (id) => {
    setItemType(id)
    setForm({ ...emptyForms[id] })
    setMessage('')
    setError('')
  }

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const projectsForProgram = lookups.projects.filter(
    (p) => !form.programId || p.programId === form.programId
  )

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const label = ITEM_TYPES.find((t) => t.id === itemType)?.label || 'Item'

      if (itemType === 'project') {
        if (!form.programId || !form.name.trim()) {
          throw new Error('Program and project name are required.')
        }
        await addDoc(collection(db, 'projects'), {
          name: form.name.trim(),
          lead: form.lead.trim(),
          promise: form.promise.trim(),
          health: form.health,
          targetDate: form.targetDate || '',
          programId: form.programId,
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'task') {
        const project = lookups.projects.find((p) => p.id === form.projectId)
        const program = lookups.programs.find(
          (p) => p.id === (form.programId || project?.programId)
        )
        if (!project || !program || !form.name.trim()) {
          throw new Error('Program, project, and task name are required.')
        }
        await addDoc(collection(db, 'tasks'), {
          name: form.name.trim(),
          owner: form.owner.trim(),
          dueDate: form.dueDate || '',
          status: form.status,
          priority: form.priority,
          waitingOn: form.waitingOn.trim(),
          leadershipAttention: form.leadershipAttention,
          nextAction: form.nextAction.trim(),
          projectId: project.id,
          projectName: project.name,
          programId: program.id,
          programName: program.name,
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'course') {
        if (!form.name.trim()) throw new Error('Course name is required.')
        await addDoc(collection(db, 'courses'), {
          name: form.name.trim(),
          path: form.path,
          facilitator: form.facilitator.trim(),
          description: form.description.trim(),
          durationWeeks: form.durationWeeks ? Number(form.durationWeeks) : null,
          status: form.status,
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'module') {
        const course = lookups.courses.find((c) => c.id === form.courseId)
        if (!course || !form.title.trim()) {
          throw new Error('Course and module title are required.')
        }
        await addDoc(collection(db, 'modules'), {
          courseId: course.id,
          courseName: course.name,
          title: form.title.trim(),
          type: form.type,
          order: form.order !== '' ? Number(form.order) : 1,
          resourceUrl: form.resourceUrl.trim(),
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'enrollment') {
        const course = lookups.courses.find((c) => c.id === form.courseId)
        if (!form.learnerName.trim() || !form.learnerEmail.trim() || !course) {
          throw new Error('Learner name, email, and course are required.')
        }
        await addDoc(collection(db, 'enrollments'), {
          learnerName: form.learnerName.trim(),
          learnerEmail: form.learnerEmail.trim().toLowerCase(),
          courseId: course.id,
          courseName: course.name,
          path: course.path || 'academy',
          status: form.status,
          progress: Number(form.progress) || 0,
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'session') {
        const course = lookups.courses.find((c) => c.id === form.courseId)
        await addDoc(collection(db, 'sessions'), {
          title: form.title.trim() || 'Office Hours',
          courseId: course?.id || '',
          courseName: course?.name || '',
          date: form.date || '',
          time: form.time || '',
          location: form.location.trim(),
          zoomLink: form.zoomLink.trim(),
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'checkIn') {
        const course = lookups.courses.find((c) => c.id === form.courseId)
        if (!form.learnerName.trim()) {
          throw new Error('Learner name is required.')
        }
        await addDoc(collection(db, 'checkIns'), {
          learnerName: form.learnerName.trim(),
          learnerEmail: form.learnerEmail.trim().toLowerCase(),
          courseId: course?.id || '',
          courseName: course?.name || '',
          type: form.type,
          dueDate: form.dueDate || '',
          notes: form.notes.trim(),
          status: 'Scheduled',
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'certificate') {
        const enrollment = lookups.enrollments.find(
          (x) => x.id === form.enrollmentId
        )
        if (!enrollment) throw new Error('Select an enrollment.')
        await addDoc(collection(db, 'certificates'), {
          enrollmentId: enrollment.id,
          learnerName: enrollment.learnerName,
          learnerEmail: enrollment.learnerEmail || '',
          courseId: enrollment.courseId,
          courseName: enrollment.courseName,
          issuedAt: new Date().toISOString().slice(0, 10),
          status: 'Issued',
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'expert') {
        if (!form.name.trim()) throw new Error('Expert name is required.')
        await addDoc(collection(db, 'experts'), {
          name: form.name.trim(),
          title: form.title.trim(),
          organization: form.organization.trim(),
          email: form.email.trim().toLowerCase(),
          bio: form.bio.trim(),
          expertise: parseTags(form.expertiseText),
          linkedinUrl: form.linkedinUrl.trim(),
          bookingUrl: form.bookingUrl.trim(),
          photoUrl: form.photoUrl.trim(),
          status: form.status,
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'contact') {
        if (!form.name.trim()) throw new Error('Contact name is required.')
        await addDoc(collection(db, 'contacts'), {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          type: form.type,
          region: form.region,
          tags: parseTags(form.tags),
          stage: form.stage,
          notes: form.notes.trim(),
          followUpDate: form.followUpDate || '',
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'interaction') {
        const contact = lookups.contacts.find((c) => c.id === form.contactId)
        if (!contact) throw new Error('Select a contact.')
        await addDoc(collection(db, 'interactions'), {
          contactId: contact.id,
          contactName: contact.name,
          type: form.type,
          date: form.date || new Date().toISOString().slice(0, 10),
          subject: form.subject.trim(),
          notes: form.notes.trim(),
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'member') {
        if (!form.name.trim()) throw new Error('Member name is required.')
        await addDoc(collection(db, 'members'), {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          cohort: form.cohort.trim(),
          chapter: form.chapter.trim(),
          status: form.status,
          joinDate: form.joinDate || '',
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'membership') {
        const member = lookups.members.find((m) => m.id === form.memberId)
        if (!member) throw new Error('Select a member.')
        await addDoc(collection(db, 'memberships'), {
          memberId: member.id,
          memberName: member.name,
          memberEmail: (member.email || '').toLowerCase(),
          tier: form.tier,
          renewalDate: form.renewalDate || '',
          paymentStatus: form.paymentStatus,
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'event') {
        if (!form.name.trim()) throw new Error('Event name is required.')
        await addDoc(collection(db, 'events'), {
          name: form.name.trim(),
          date: form.date || '',
          location: form.location.trim(),
          capacity: form.capacity ? Number(form.capacity) : null,
          description: form.description.trim(),
          createdAt: serverTimestamp(),
        })
      } else if (itemType === 'committee') {
        const member = lookups.members.find((m) => m.id === form.memberId)
        if (!form.name.trim()) throw new Error('Committee name is required.')
        await addDoc(collection(db, 'committees'), {
          name: form.name.trim(),
          memberId: member?.id || '',
          memberName: member?.name || '',
          role: form.role,
          notes: form.notes.trim(),
          createdAt: serverTimestamp(),
        })
      }

      setMessage(`${label} created.`)
      setForm({ ...emptyForms[itemType] })
      await loadLookups()
    } catch (err) {
      setError(err.message || 'Failed to create item')
    } finally {
      setBusy(false)
    }
  }

  if (!lookupsReady) {
    return <p className="text-sm text-hae-slate">Loading add-item forms…</p>
  }

  const apps = [...new Set(ITEM_TYPES.map((t) => t.app))]

  return (
    <div className="space-y-6">
      <p className="text-sm text-hae-slate">
        Create records for any HAE app from here. Users and programs stay on
        their own tabs. Use the learner/member login email so student and member
        views can find their records. For CSV/JSON lists, use the{' '}
        <strong>Bulk import</strong> tab (includes format instructions and
        examples).
      </p>

      <div className="space-y-3">
        {apps.map((app) => (
          <div key={app}>
            <p className="mb-2 text-xs font-semibold tracking-wide text-hae-slate uppercase">
              {app}
            </p>
            <div className="flex flex-wrap gap-2">
              {ITEM_TYPES.filter((t) => t.app === app).map((t) => {
                const on = itemType === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectType(t.id)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      on
                        ? 'border-hae-crimson bg-hae-crimson/10 text-hae-crimson'
                        : 'border-hae-line text-hae-slate hover:bg-hae-mist'
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-hae-red">{error}</p>}
      {message && <p className="text-sm text-hae-green">{message}</p>}

      <form
        onSubmit={create}
        className="grid gap-3 rounded-xl border border-hae-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {itemType === 'project' && (
          <>
            <Field label="Program">
              <select
                required
                className={`w-full ${fieldClass}`}
                value={form.programId}
                onChange={(e) => set('programId', e.target.value)}
              >
                <option value="">Select program…</option>
                {lookups.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Lead">
              <input
                className={`w-full ${fieldClass}`}
                value={form.lead}
                onChange={(e) => set('lead', e.target.value)}
              />
            </Field>
            <Field label="Promise">
              <input
                className={`w-full ${fieldClass}`}
                value={form.promise}
                onChange={(e) => set('promise', e.target.value)}
              />
            </Field>
            <Field label="Health">
              <select
                className={`w-full ${fieldClass}`}
                value={form.health}
                onChange={(e) => set('health', e.target.value)}
              >
                {HEALTH_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target date">
              <input
                type="date"
                className={`w-full ${fieldClass}`}
                value={form.targetDate}
                onChange={(e) => set('targetDate', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'task' && (
          <>
            <Field label="Program">
              <select
                required
                className={`w-full ${fieldClass}`}
                value={form.programId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    programId: e.target.value,
                    projectId: '',
                  }))
                }
              >
                <option value="">Select program…</option>
                {lookups.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project">
              <select
                required
                className={`w-full ${fieldClass}`}
                value={form.projectId}
                onChange={(e) => set('projectId', e.target.value)}
              >
                <option value="">Select project…</option>
                {projectsForProgram.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Task name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Owner">
              <input
                className={`w-full ${fieldClass}`}
                value={form.owner}
                onChange={(e) => set('owner', e.target.value)}
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                className={`w-full ${fieldClass}`}
                value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                className={`w-full ${fieldClass}`}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                className={`w-full ${fieldClass}`}
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p || 'none'} value={p}>
                    {p || '—'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Waiting on">
              <input
                className={`w-full ${fieldClass}`}
                value={form.waitingOn}
                onChange={(e) => set('waitingOn', e.target.value)}
              />
            </Field>
            <Field label="Leadership attention">
              <select
                className={`w-full ${fieldClass}`}
                value={form.leadershipAttention}
                onChange={(e) => set('leadershipAttention', e.target.value)}
              >
                {LEADERSHIP_ATTENTION.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Next action">
              <input
                className={`w-full ${fieldClass}`}
                value={form.nextAction}
                onChange={(e) => set('nextAction', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'course' && (
          <>
            <Field label="Course name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Path">
              <select
                className={`w-full ${fieldClass}`}
                value={form.path}
                onChange={(e) => set('path', e.target.value)}
              >
                {LEARNING_PATHS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Facilitator">
              <input
                className={`w-full ${fieldClass}`}
                value={form.facilitator}
                onChange={(e) => set('facilitator', e.target.value)}
              />
            </Field>
            <Field label="Duration (weeks)">
              <input
                type="number"
                min="1"
                className={`w-full ${fieldClass}`}
                value={form.durationWeeks}
                onChange={(e) => set('durationWeeks', e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                className={`w-full ${fieldClass}`}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {COURSE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input
                className={`w-full ${fieldClass}`}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'module' && (
          <>
            <Field label="Course">
              <select
                required
                className={`w-full ${fieldClass}`}
                value={form.courseId}
                onChange={(e) => set('courseId', e.target.value)}
              >
                <option value="">Select course…</option>
                {lookups.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>
            <Field label="Type">
              <select
                className={`w-full ${fieldClass}`}
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                {MODULE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Order">
              <input
                type="number"
                min="1"
                className={`w-full ${fieldClass}`}
                value={form.order}
                onChange={(e) => set('order', e.target.value)}
                placeholder="Auto if blank"
              />
            </Field>
            <Field label="Resource URL">
              <input
                className={`w-full ${fieldClass}`}
                value={form.resourceUrl}
                onChange={(e) => set('resourceUrl', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'enrollment' && (
          <>
            <Field label="Learner name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.learnerName}
                onChange={(e) => set('learnerName', e.target.value)}
              />
            </Field>
            <Field label="Learner email (login)">
              <input
                required
                type="email"
                className={`w-full ${fieldClass}`}
                value={form.learnerEmail}
                onChange={(e) => set('learnerEmail', e.target.value)}
              />
            </Field>
            <Field label="Course">
              <select
                required
                className={`w-full ${fieldClass}`}
                value={form.courseId}
                onChange={(e) => set('courseId', e.target.value)}
              >
                <option value="">Select course…</option>
                {lookups.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={`w-full ${fieldClass}`}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {ENROLLMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Progress %">
              <input
                type="number"
                min="0"
                max="100"
                className={`w-full ${fieldClass}`}
                value={form.progress}
                onChange={(e) => set('progress', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'session' && (
          <>
            <Field label="Title">
              <input
                className={`w-full ${fieldClass}`}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>
            <Field label="Course">
              <select
                className={`w-full ${fieldClass}`}
                value={form.courseId}
                onChange={(e) => set('courseId', e.target.value)}
              >
                <option value="">Optional…</option>
                {lookups.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                className={`w-full ${fieldClass}`}
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </Field>
            <Field label="Time">
              <input
                className={`w-full ${fieldClass}`}
                value={form.time}
                onChange={(e) => set('time', e.target.value)}
                placeholder="e.g. 5:00 PM ET"
              />
            </Field>
            <Field label="Location">
              <input
                className={`w-full ${fieldClass}`}
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
              />
            </Field>
            <Field label="Zoom link">
              <input
                className={`w-full ${fieldClass}`}
                value={form.zoomLink}
                onChange={(e) => set('zoomLink', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'checkIn' && (
          <>
            <Field label="Learner name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.learnerName}
                onChange={(e) => set('learnerName', e.target.value)}
              />
            </Field>
            <Field label="Learner email (login)">
              <input
                type="email"
                className={`w-full ${fieldClass}`}
                value={form.learnerEmail}
                onChange={(e) => set('learnerEmail', e.target.value)}
              />
            </Field>
            <Field label="Course">
              <select
                className={`w-full ${fieldClass}`}
                value={form.courseId}
                onChange={(e) => set('courseId', e.target.value)}
              >
                <option value="">Optional…</option>
                {lookups.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                className={`w-full ${fieldClass}`}
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                {CHECKIN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input
                type="date"
                className={`w-full ${fieldClass}`}
                value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <input
                className={`w-full ${fieldClass}`}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'certificate' && (
          <Field label="Enrollment">
            <select
              required
              className={`w-full ${fieldClass}`}
              value={form.enrollmentId}
              onChange={(e) => set('enrollmentId', e.target.value)}
            >
              <option value="">Select enrollment…</option>
              {lookups.enrollments.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.learnerName} — {en.courseName}
                </option>
              ))}
            </select>
          </Field>
        )}

        {itemType === 'expert' && (
          <>
            <Field label="Name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Title">
              <input
                className={`w-full ${fieldClass}`}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>
            <Field label="Organization">
              <input
                className={`w-full ${fieldClass}`}
                value={form.organization}
                onChange={(e) => set('organization', e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={`w-full ${fieldClass}`}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                className={`w-full ${fieldClass}`}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {EXPERT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expertise (comma-separated)">
              <input
                className={`w-full ${fieldClass}`}
                value={form.expertiseText}
                onChange={(e) => set('expertiseText', e.target.value)}
                placeholder={EXPERTISE_SUGGESTIONS.slice(0, 3).join(', ')}
              />
            </Field>
            <Field label="Bio">
              <input
                className={`w-full ${fieldClass}`}
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
              />
            </Field>
            <Field label="LinkedIn URL">
              <input
                className={`w-full ${fieldClass}`}
                value={form.linkedinUrl}
                onChange={(e) => set('linkedinUrl', e.target.value)}
              />
            </Field>
            <Field label="Booking URL">
              <input
                className={`w-full ${fieldClass}`}
                value={form.bookingUrl}
                onChange={(e) => set('bookingUrl', e.target.value)}
              />
            </Field>
            <Field label="Photo URL">
              <input
                className={`w-full ${fieldClass}`}
                value={form.photoUrl}
                onChange={(e) => set('photoUrl', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'contact' && (
          <>
            <Field label="Name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={`w-full ${fieldClass}`}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Type">
              <select
                className={`w-full ${fieldClass}`}
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                {CONTACT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Region">
              <select
                className={`w-full ${fieldClass}`}
                value={form.region}
                onChange={(e) => set('region', e.target.value)}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stage">
              <select
                className={`w-full ${fieldClass}`}
                value={form.stage}
                onChange={(e) => set('stage', e.target.value)}
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags (comma-separated)">
              <input
                className={`w-full ${fieldClass}`}
                value={form.tags}
                onChange={(e) => set('tags', e.target.value)}
              />
            </Field>
            <Field label="Follow-up date">
              <input
                type="date"
                className={`w-full ${fieldClass}`}
                value={form.followUpDate}
                onChange={(e) => set('followUpDate', e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <input
                className={`w-full ${fieldClass}`}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'interaction' && (
          <>
            <Field label="Contact">
              <select
                required
                className={`w-full ${fieldClass}`}
                value={form.contactId}
                onChange={(e) => set('contactId', e.target.value)}
              >
                <option value="">Select contact…</option>
                {lookups.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                className={`w-full ${fieldClass}`}
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                {INTERACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                className={`w-full ${fieldClass}`}
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </Field>
            <Field label="Subject">
              <input
                className={`w-full ${fieldClass}`}
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <input
                className={`w-full ${fieldClass}`}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'member' && (
          <>
            <Field label="Name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Email (login)">
              <input
                type="email"
                className={`w-full ${fieldClass}`}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Cohort">
              <input
                className={`w-full ${fieldClass}`}
                value={form.cohort}
                onChange={(e) => set('cohort', e.target.value)}
              />
            </Field>
            <Field label="Chapter">
              <input
                className={`w-full ${fieldClass}`}
                value={form.chapter}
                onChange={(e) => set('chapter', e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                className={`w-full ${fieldClass}`}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {MEMBER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Join date">
              <input
                type="date"
                className={`w-full ${fieldClass}`}
                value={form.joinDate}
                onChange={(e) => set('joinDate', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'membership' && (
          <>
            <Field label="Member">
              <select
                required
                className={`w-full ${fieldClass}`}
                value={form.memberId}
                onChange={(e) => set('memberId', e.target.value)}
              >
                <option value="">Select member…</option>
                {lookups.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.email ? ` (${m.email})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tier">
              <select
                className={`w-full ${fieldClass}`}
                value={form.tier}
                onChange={(e) => set('tier', e.target.value)}
              >
                {MEMBERSHIP_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Renewal date">
              <input
                type="date"
                className={`w-full ${fieldClass}`}
                value={form.renewalDate}
                onChange={(e) => set('renewalDate', e.target.value)}
              />
            </Field>
            <Field label="Payment status">
              <select
                className={`w-full ${fieldClass}`}
                value={form.paymentStatus}
                onChange={(e) => set('paymentStatus', e.target.value)}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {itemType === 'event' && (
          <>
            <Field label="Event name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                className={`w-full ${fieldClass}`}
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </Field>
            <Field label="Location">
              <input
                className={`w-full ${fieldClass}`}
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
              />
            </Field>
            <Field label="Capacity">
              <input
                type="number"
                min="1"
                className={`w-full ${fieldClass}`}
                value={form.capacity}
                onChange={(e) => set('capacity', e.target.value)}
              />
            </Field>
            <Field label="Description">
              <input
                className={`w-full ${fieldClass}`}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
          </>
        )}

        {itemType === 'committee' && (
          <>
            <Field label="Committee name">
              <input
                required
                className={`w-full ${fieldClass}`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Member">
              <select
                className={`w-full ${fieldClass}`}
                value={form.memberId}
                onChange={(e) => set('memberId', e.target.value)}
              >
                <option value="">Optional…</option>
                {lookups.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Role">
              <select
                className={`w-full ${fieldClass}`}
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
              >
                {COMMITTEE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <input
                className={`w-full ${fieldClass}`}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </Field>
          </>
        )}

        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy
              ? 'Saving…'
              : `Add ${ITEM_TYPES.find((t) => t.id === itemType)?.label || 'item'}`}
          </button>
        </div>
      </form>
    </div>
  )
}
