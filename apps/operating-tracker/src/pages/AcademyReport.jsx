import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { Modal, formatDate } from '@hae/ui'
import { db } from '../firebase'
import CourseRegistrations from './CourseRegistrations'

// Courses tracked only for reporting (e.g. past cohorts). They live in their
// own collection so they don't become Academy items in the side nav, the RHR
// course grid, or the Academy Calendar.
const REPORT_COLLECTION = 'academyReportCourses'

const PAGE_TABS = [
  { key: 'report', label: 'Course Report' },
  { key: 'registrations', label: 'Registrations & Payments' },
]

const STATUS_TABS = ['All', 'Upcoming', 'In progress', 'Completed']

const STATUS_BADGE = {
  Upcoming: 'bg-blue-50 text-blue-700',
  'In progress': 'bg-amber-50 text-amber-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  'No date': 'bg-hae-mist text-hae-slate',
}

// Same breakdown as the Enrollment Summary on Course Enrollments.
const ENROLLMENT_TYPES = [
  { key: 'free', label: 'Free' },
  { key: 'promotional', label: 'Promotional' },
  { key: 'paid', label: 'Paid' },
  { key: 'subscription', label: 'Subscription' },
]

/** `{ free, promotional, paid, subscription, enrollments }` from a doc's counts. */
function enrollmentBreakdown(data) {
  const counts = {}
  for (const { key } of ENROLLMENT_TYPES) counts[key] = Math.max(0, Number(data?.[key]) || 0)
  counts.enrollments = ENROLLMENT_TYPES.reduce((sum, { key }) => sum + counts[key], 0)
  return counts
}

const COLUMNS = [
  { key: 'name', label: 'Course' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'status', label: 'Status' },
  ...ENROLLMENT_TYPES.map((t) => ({ ...t, group: 'enrollment' })),
  { key: 'enrollments', label: 'Total', group: 'enrollment' },
  { key: 'revenue', label: 'Revenue' },
]

const ENROLLMENT_COLUMN_COUNT = COLUMNS.filter((c) => c.group === 'enrollment').length

const NUMERIC_KEYS = new Set([...ENROLLMENT_TYPES.map((t) => t.key), 'enrollments', 'revenue'])

const emptyForm = {
  name: '',
  startDate: '',
  durationWeeks: '',
  free: '',
  promotional: '',
  paid: '',
  subscription: '',
  revenue: '',
}

const cellInputClass =
  'rounded border border-hae-line bg-white px-2 py-1 text-sm outline-none focus:border-hae-crimson disabled:opacity-60'

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

function formatMoney(amount) {
  return (amount || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function todayIso() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** Last day of a course that starts on `startDate` and runs `weeks` weeks. */
function endDateOf(startDate, weeks) {
  const n = Number(weeks) || 0
  if (!startDate || n <= 0) return ''
  const d = new Date(`${startDate}T00:00:00`)
  d.setDate(d.getDate() + n * 7 - 1)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function statusOf(startDate, endDate, today) {
  if (!startDate) return 'No date'
  if (startDate > today) return 'Upcoming'
  if ((endDate || startDate) < today) return 'Completed'
  return 'In progress'
}

export default function AcademyReport({ sectionReadOnly = false }) {
  const [programs, setPrograms] = useState([])
  const [reportCourses, setReportCourses] = useState([])
  const [enrollmentCounts, setEnrollmentCounts] = useState({})
  const [revenueByCourse, setRevenueByCourse] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageTab, setPageTab] = useState('report')
  const [drafts, setDrafts] = useState({})
  const [statusTab, setStatusTab] = useState('All')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('startDate')
  const [sortDir, setSortDir] = useState('desc')
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [programSnap, reportSnap, countSnap, registrationSnap] = await Promise.all([
        getDocs(collection(db, 'academyPrograms')),
        getDocs(collection(db, REPORT_COLLECTION)),
        getDocs(collection(db, 'courseEnrollmentCounts')),
        getDocs(collection(db, 'courseRegistrations')),
      ])
      setPrograms(programSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.name))
      setReportCourses(reportSnap.docs.map((d) => ({ id: d.id, ...d.data() })))

      const counts = {}
      countSnap.docs.forEach((d) => {
        const data = d.data()
        if (!data.course) return
        counts[data.course] = enrollmentBreakdown(data)
      })
      setEnrollmentCounts(counts)

      const revenue = {}
      registrationSnap.docs.forEach((d) => {
        const data = d.data()
        if (!data.course) return
        revenue[data.course] = (revenue[data.course] || 0) + (Number(data.amountPaid) || 0)
      })
      setRevenueByCourse(revenue)
    } catch (err) {
      setError(err.message || 'Failed to load Academy report')
    } finally {
      setLoading(false)
    }
  }, [])

  // Reload when coming back from Registrations & Payments so revenue reflects
  // any payments added or edited there.
  useEffect(() => {
    if (pageTab === 'report') load()
  }, [load, pageTab])

  const rows = useMemo(() => {
    const today = todayIso()
    const toRow = (course, extra) => {
      const endDate = endDateOf(course.startDate, course.durationWeeks)
      return {
        id: course.id,
        name: course.name,
        startDate: course.startDate || '',
        durationWeeks: course.durationWeeks ?? '',
        endDate,
        status: statusOf(course.startDate, endDate, today),
        ...extra,
      }
    }
    // Enrollment counts and payments are keyed by course name. Names that no
    // longer match a course (renamed or removed from the side nav) still show,
    // so their enrollments and revenue aren't dropped from the totals.
    const knownNames = new Set([...programs, ...reportCourses].map((c) => c.name))
    const unlistedNames = [
      ...new Set([...Object.keys(enrollmentCounts), ...Object.keys(revenueByCourse)]),
    ].filter((name) => !knownNames.has(name))
    return [
      ...programs.map((p) =>
        toRow(p, {
          source: 'program',
          ...enrollmentBreakdown(enrollmentCounts[p.name]),
          revenue: revenueByCourse[p.name] || 0,
        })
      ),
      ...reportCourses.map((c) =>
        toRow(c, {
          source: 'report',
          ...enrollmentBreakdown(c),
          revenue: Number(c.revenue) || 0,
        })
      ),
      ...unlistedNames
        .map((name) =>
          toRow(
            { id: name, name },
            {
              source: 'unlisted',
              ...enrollmentBreakdown(enrollmentCounts[name]),
              revenue: revenueByCourse[name] || 0,
            }
          )
        )
        .filter((r) => r.enrollments > 0 || r.revenue !== 0),
    ]
  }, [programs, reportCourses, enrollmentCounts, revenueByCourse])

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = rows.filter(
      (r) =>
        (statusTab === 'All' || r.status === statusTab) &&
        (!term || r.name.toLowerCase().includes(term))
    )
    const dir = sortDir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      if (NUMERIC_KEYS.has(sortKey)) {
        return dir * ((a[sortKey] || 0) - (b[sortKey] || 0))
      }
      // Blank dates sort last regardless of direction.
      if (!a[sortKey] !== !b[sortKey]) return a[sortKey] ? -1 : 1
      return dir * String(a[sortKey]).localeCompare(String(b[sortKey]))
    })
  }, [rows, statusTab, search, sortKey, sortDir])

  const totals = useMemo(
    () =>
      visibleRows.reduce((sum, r) => {
        for (const key of NUMERIC_KEYS) sum[key] = (sum[key] || 0) + r[key]
        return sum
      }, {}),
    [visibleRows]
  )

  const countByStatus = useMemo(() => {
    const counts = { All: rows.length }
    for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1
    return counts
  }, [rows])

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'status' ? 'asc' : 'desc')
    }
  }

  const renderSortButton = (col) => (
    <button
      type="button"
      onClick={() => handleSort(col.key)}
      className="flex w-full items-center justify-center gap-1 whitespace-nowrap uppercase text-hae-slate hover:text-hae-ink"
    >
      {col.label}
      {sortKey === col.key && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  )

  const draftKey = (row, field) => `${row.source}:${row.id}:${field}`

  const canEdit = (row, field) => {
    if (sectionReadOnly) return false
    if (field === 'startDate') return row.source !== 'unlisted'
    if (field === 'revenue') return row.source === 'report'
    return true
  }

  // Inline edits write back to where each value lives: report-only courses to
  // their own doc; side-nav courses to academyPrograms (start date) and
  // courseEnrollmentCounts (counts); revenue for those comes from payments.
  const saveCell = async (row, field, raw) => {
    const key = draftKey(row, field)
    const clearDraft = () =>
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    const value =
      field === 'startDate'
        ? raw
        : field === 'revenue'
          ? Number(raw) || 0
          : Math.max(0, Number(raw) || 0)
    if (!canEdit(row, field) || value === row[field]) {
      clearDraft()
      return
    }
    setError('')
    try {
      if (row.source === 'report') {
        await updateDoc(doc(db, REPORT_COLLECTION, row.id), {
          [field]: value,
          updatedAt: serverTimestamp(),
        })
      } else if (field === 'startDate') {
        await updateDoc(doc(db, 'academyPrograms', row.id), { startDate: value })
      } else {
        const counts = Object.fromEntries(ENROLLMENT_TYPES.map(({ key: k }) => [k, row[k]]))
        await setDoc(doc(db, 'courseEnrollmentCounts', encodeURIComponent(row.name)), {
          course: row.name,
          ...counts,
          [field]: value,
        })
      }
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save change')
    } finally {
      clearDraft()
    }
  }

  const renderCell = (row, field, display) => {
    if (!canEdit(row, field)) return display
    const key = draftKey(row, field)
    const isDate = field === 'startDate'
    return (
      <input
        type={isDate ? 'date' : 'number'}
        min={isDate ? undefined : '0'}
        step={field === 'revenue' ? '0.01' : undefined}
        value={key in drafts ? drafts[key] : row[field]}
        onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
        onBlur={(e) => saveCell(row, field, e.target.value)}
        aria-label={`${row.name} ${field}`}
        className={`${cellInputClass} ${isDate ? '' : field === 'revenue' ? 'w-28' : 'w-20'} print:border-0 print:p-0`}
      />
    )
  }

  const openAdd = () => {
    setEditingId(null)
    setFormError('')
    setForm(emptyForm)
  }

  const openEdit = (row) => {
    setEditingId(row.id)
    setFormError('')
    setForm({
      name: row.name,
      startDate: row.startDate,
      durationWeeks: row.durationWeeks === null ? '' : String(row.durationWeeks),
      ...Object.fromEntries(ENROLLMENT_TYPES.map(({ key }) => [key, String(row[key])])),
      revenue: String(row.revenue),
    })
  }

  const closeForm = () => {
    if (saving) return
    setForm(null)
    setEditingId(null)
  }

  const saveCourse = async (e) => {
    e.preventDefault()
    if (sectionReadOnly || !form?.name.trim()) return
    setSaving(true)
    setFormError('')
    const data = {
      name: form.name.trim(),
      startDate: form.startDate,
      durationWeeks: form.durationWeeks ? Number(form.durationWeeks) : null,
      ...Object.fromEntries(
        ENROLLMENT_TYPES.map(({ key }) => [key, Math.max(0, Number(form[key]) || 0)])
      ),
      revenue: Number(form.revenue) || 0,
      updatedAt: serverTimestamp(),
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, REPORT_COLLECTION, editingId), data)
      } else {
        await addDoc(collection(db, REPORT_COLLECTION), { ...data, createdAt: serverTimestamp() })
      }
      setForm(null)
      setEditingId(null)
      await load()
    } catch (err) {
      setFormError(err.message || 'Failed to save course')
    } finally {
      setSaving(false)
    }
  }

  const removeCourse = async () => {
    if (sectionReadOnly || !editingId) return
    if (!confirm('Remove this course from the report? This action cannot be undone.')) return
    setSaving(true)
    setFormError('')
    try {
      await deleteDoc(doc(db, REPORT_COLLECTION, editingId))
      setForm(null)
      setEditingId(null)
      await load()
    } catch (err) {
      setFormError(err.message || 'Failed to remove course')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hae-ink">Academy Report</h1>
          <p className="text-sm text-hae-slate">
            Every Academy course — past, current and upcoming — with enrollments and revenue.
          </p>
        </div>
        {pageTab === 'report' && (
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="hae-btn-secondary rounded-md border border-hae-line px-3 py-2 text-xs font-semibold uppercase text-hae-ink"
          >
            Print
          </button>
          {!sectionReadOnly && (
            <button type="button" onClick={openAdd} className="hae-btn">
              Add Course
            </button>
          )}
        </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-hae-line print:hidden">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setPageTab(tab.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold uppercase ${
              pageTab === tab.key
                ? 'border-hae-crimson text-hae-crimson'
                : 'border-transparent text-hae-slate hover:text-hae-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {pageTab === 'registrations' && <CourseRegistrations sectionReadOnly={sectionReadOnly} />}

      {pageTab === 'report' && (
      <>
      {error && <p className="text-sm text-hae-red">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Courses', value: visibleRows.length },
          { label: 'Enrollments', value: (totals.enrollments || 0).toLocaleString('en-US') },
          { label: 'Revenue', value: formatMoney(totals.revenue) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-hae-line bg-white p-4">
            <p className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-2xl text-hae-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-hae-line bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2 border-b border-hae-line print:hidden">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold uppercase ${
                  statusTab === tab
                    ? 'border-hae-crimson text-hae-crimson'
                    : 'border-transparent text-hae-slate hover:text-hae-ink'
                }`}
              >
                {tab} ({countByStatus[tab] || 0})
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson print:hidden"
          />
        </div>

        <div className="hae-table-scroll mt-4 rounded-lg border border-hae-line">
          <table className="w-full text-left">
            <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
              <tr>
                {COLUMNS.map((col, i) => {
                  if (col.group === 'enrollment') {
                    // One "Enrollment" cell spans the breakdown columns in the row below.
                    return COLUMNS[i - 1]?.group === 'enrollment' ? null : (
                      <th
                        key="enrollment"
                        colSpan={ENROLLMENT_COLUMN_COUNT}
                        className="border-b border-l border-r border-hae-line px-3 py-2 text-center font-semibold"
                      >
                        Enrollment
                      </th>
                    )
                  }
                  return (
                    <th key={col.key} rowSpan={2} className="px-3 py-2 text-center align-bottom font-semibold">
                      {renderSortButton(col)}
                    </th>
                  )
                })}
                <th rowSpan={2} className="px-3 py-2 print:hidden" />
              </tr>
              <tr>
                {COLUMNS.filter((col) => col.group === 'enrollment').map((col, i, list) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 text-center font-semibold ${i === 0 ? 'border-l border-hae-line' : ''} ${
                      i === list.length - 1 ? 'border-r border-hae-line' : ''
                    }`}
                  >
                    {renderSortButton(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={`${r.source}-${r.id}`} className="border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm font-medium text-hae-ink">
                    {r.source === 'program' ? (
                      <Link to={`/academy/${r.id}`} className="hover:text-hae-crimson hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                    {r.source === 'unlisted' && (
                      <span className="mt-0.5 block text-[11px] font-normal text-hae-slate">
                        Not in course list
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-hae-slate">
                    {renderCell(r, 'startDate', formatDate(r.startDate, 'TBD'))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-hae-slate">
                    {formatDate(r.endDate)}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  {ENROLLMENT_TYPES.map(({ key }) => (
                    <td key={key} className="px-3 py-2 text-sm text-hae-slate">
                      {renderCell(r, key, r[key])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-sm font-semibold text-hae-ink">{r.enrollments}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-hae-ink">
                    {renderCell(r, 'revenue', formatMoney(r.revenue))}
                  </td>
                  <td className="px-3 py-2 text-right print:hidden">
                    {r.source === 'report' && !sectionReadOnly && (
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-xs font-semibold uppercase text-hae-slate hover:text-hae-crimson"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-center text-sm text-hae-slate">
                    {rows.length === 0 ? 'No Academy courses yet.' : 'No courses match these filters.'}
                  </td>
                </tr>
              )}
            </tbody>
            {visibleRows.length > 0 && (
              <tfoot>
                <tr className="bg-hae-mist/40">
                  <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-hae-ink">
                    Total ({visibleRows.length} course{visibleRows.length === 1 ? '' : 's'})
                  </td>
                  {[...ENROLLMENT_TYPES.map((t) => t.key), 'enrollments'].map((key) => (
                    <td key={key} className="px-3 py-2 text-sm font-semibold text-hae-ink">
                      {totals[key]}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-hae-ink">
                    {formatMoney(totals.revenue)}
                  </td>
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-3 text-xs text-hae-slate print:hidden">
          Click a start date or enrollment count to edit it. Revenue for courses in the side nav is
          the total of their payments on{' '}
          <button
            type="button"
            onClick={() => setPageTab('registrations')}
            className="text-hae-crimson hover:underline"
          >
            Registrations &amp; Payments
          </button>
          . Courses marked “Not in course list” have enrollments or payments under a name that no
          longer matches a course.
        </p>
      </div>
      </>
      )}

      <Modal
        open={Boolean(form)}
        onClose={closeForm}
        busy={saving}
        title={editingId ? 'Edit course' : 'Add Course'}
        footer={
          <>
            {editingId && (
              <button
                type="button"
                className="mr-auto text-xs font-semibold uppercase text-hae-red disabled:opacity-60"
                onClick={removeCourse}
                disabled={saving}
              >
                Remove
              </button>
            )}
            <button type="button" className="hae-btn-secondary" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              form="academy-report-course-form"
              className="hae-btn disabled:opacity-60"
              disabled={saving || !form?.name.trim()}
            >
              {saving ? 'Saving…' : editingId ? 'Save' : 'Add course'}
            </button>
          </>
        }
      >
        {form ? (
          <form
            id="academy-report-course-form"
            onSubmit={saveCourse}
            className="grid gap-3 sm:grid-cols-2"
          >
            {formError ? <p className="text-sm text-hae-red sm:col-span-2">{formError}</p> : null}
            <Field label="Course name" className="sm:col-span-2">
              <input
                autoFocus
                required
                className={fieldClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Start date">
              <input
                type="date"
                className={fieldClass}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="Duration (weeks)">
              <input
                type="number"
                min="1"
                className={fieldClass}
                value={form.durationWeeks}
                onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })}
              />
            </Field>
            {ENROLLMENT_TYPES.map(({ key, label }) => (
              <Field key={key} label={`${label} enrollments`}>
                <input
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Revenue (USD)" className="sm:col-span-2">
              <input
                type="number"
                min="0"
                step="0.01"
                className={fieldClass}
                value={form.revenue}
                onChange={(e) => setForm({ ...form, revenue: e.target.value })}
              />
            </Field>
            <p className="text-xs text-hae-slate sm:col-span-2">
              Shows in this report only — it isn't added to the side nav, the RHR course grid or the
              Academy Calendar.
            </p>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
