import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import ModuleImportPanel from '../components/ModuleImportPanel'

const PROGRAM_TYPES = ['Academy', 'Academy Flagship']
const emptyForm = {
  course: '',
  programType: PROGRAM_TYPES[0],
  firstName: '',
  lastName: '',
  email: '',
  amountPaid: '',
}
const PAGE_SIZE = 10

function formatMoney(cents) {
  return (cents || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function toMillis(value) {
  return value?.toMillis?.() ?? 0
}

function formatDate(value) {
  const millis = toMillis(value)
  if (!millis) return '—'
  return new Date(millis).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function toDateInputValue(value) {
  const millis = toMillis(value)
  if (!millis) return ''
  const d = new Date(millis)
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function normalizeProgramType(value) {
  return PROGRAM_TYPES.includes(value) ? value : PROGRAM_TYPES[0]
}

const COLUMNS = [
  { key: 'course', label: 'Course' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email Address' },
  { key: 'amountPaid', label: 'Amount Paid' },
  { key: 'createdAt', label: 'Date Added' },
]

export default function CourseRegistrations() {
  const [registrations, setRegistrations] = useState([])
  const [participantCounts, setParticipantCounts] = useState({})
  const [participantDrafts, setParticipantDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, 'courseRegistrations'))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.course || '').localeCompare(b.course || ''))
      setRegistrations(list)

      const countsSnap = await getDocs(collection(db, 'courseParticipantCounts'))
      const counts = {}
      countsSnap.docs.forEach((d) => {
        const data = d.data()
        if (data.course) counts[data.course] = Number(data.participants) || 0
      })
      setParticipantCounts(counts)
    } catch (err) {
      setError(err.message || 'Failed to load registrations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const totalsByCourse = useMemo(() => {
    const map = new Map()
    for (const r of registrations) {
      const key = r.course || 'Untitled course'
      const entry = map.get(key) || {
        course: key,
        programType: normalizeProgramType(r.programType),
        count: 0,
        total: 0,
      }
      entry.count += 1
      entry.total += Number(r.amountPaid) || 0
      map.set(key, entry)
    }
    return Array.from(map.values()).sort((a, b) => a.course.localeCompare(b.course))
  }, [registrations])

  const totalsByProgramType = useMemo(() => {
    const map = new Map(PROGRAM_TYPES.map((p) => [p, { programType: p, count: 0, total: 0 }]))
    for (const r of registrations) {
      const entry = map.get(normalizeProgramType(r.programType))
      entry.count += 1
      entry.total += Number(r.amountPaid) || 0
    }
    return Array.from(map.values())
  }, [registrations])

  const grandTotal = useMemo(
    () => registrations.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0),
    [registrations]
  )

  const filteredRegistrations = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return registrations
    return registrations.filter((r) =>
      [r.course, r.programType, r.firstName, r.lastName, r.email]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term))
    )
  }, [registrations, search])

  const sortedRegistrations = useMemo(() => {
    const list = [...filteredRegistrations]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortKey === 'createdAt') return dir * (toMillis(a.createdAt) - toMillis(b.createdAt))
      if (sortKey === 'amountPaid')
        return dir * ((Number(a.amountPaid) || 0) - (Number(b.amountPaid) || 0))
      return dir * String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''))
    })
    return list
  }, [filteredRegistrations, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(sortedRegistrations.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagedRegistrations = useMemo(
    () => sortedRegistrations.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedRegistrations, currentPage]
  )

  const handleSort = (key) => {
    setPage(1)
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'createdAt' ? 'desc' : 'asc')
    }
  }

  const addRegistration = async (e) => {
    e.preventDefault()
    if (!form.course.trim() || !form.firstName.trim() || !form.lastName.trim()) return
    setError('')
    try {
      await addDoc(collection(db, 'courseRegistrations'), {
        course: form.course.trim(),
        programType: normalizeProgramType(form.programType),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        amountPaid: Number(form.amountPaid) || 0,
        createdAt: serverTimestamp(),
      })
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to add registration')
    }
  }

  const saveRegistration = async () => {
    if (!draft?.course.trim() || !draft?.firstName.trim() || !draft?.lastName.trim()) return
    setError('')
    try {
      await updateDoc(doc(db, 'courseRegistrations', editingId), {
        course: draft.course.trim(),
        programType: normalizeProgramType(draft.programType),
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim().toLowerCase(),
        amountPaid: Number(draft.amountPaid) || 0,
        ...(draft.createdAt
          ? { createdAt: Timestamp.fromDate(new Date(`${draft.createdAt}T00:00:00`)) }
          : {}),
      })
      setEditingId(null)
      setDraft(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save registration')
    }
  }

  const saveParticipantCount = async (course, value) => {
    const cleaned = Math.max(0, Number(value) || 0)
    setError('')
    try {
      await setDoc(doc(db, 'courseParticipantCounts', encodeURIComponent(course)), {
        course,
        participants: cleaned,
      })
      setParticipantCounts((prev) => ({ ...prev, [course]: cleaned }))
    } catch (err) {
      setError(err.message || 'Failed to save participant count')
    } finally {
      setParticipantDrafts((prev) => {
        const next = { ...prev }
        delete next[course]
        return next
      })
    }
  }

  const removeRegistration = async (id) => {
    if (!confirm('Delete this registration?')) return
    setError('')
    try {
      await deleteDoc(doc(db, 'courseRegistrations', id))
      await load()
    } catch (err) {
      setError(err.message || 'Failed to delete registration')
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hae-ink">Course Registrations</h1>
          <p className="text-sm text-hae-slate">
            Manually enter enrollees and payments for Academy courses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowImport((v) => !v)}
          className="hae-btn-secondary rounded-md border border-hae-line px-3 py-2 text-xs font-semibold uppercase text-hae-ink"
        >
          {showImport ? 'Hide import' : 'Import registrations'}
        </button>
      </div>

      {error && <p className="text-sm text-hae-red">{error}</p>}

      {showImport && (
        <ModuleImportPanel
          moduleIds={['courseRegistrations']}
          defaultModuleId="courseRegistrations"
          onImported={load}
          compact
        />
      )}

      {/* Dashboard: totals by program type + overall, then courses tabulated */}
      <div className="rounded-xl border border-hae-line bg-white p-4">
        <h2 className="text-sm font-semibold text-hae-ink">Payments dashboard</h2>
        <div className="mt-3 space-y-2">
          {totalsByProgramType.map((t) => (
            <div
              key={t.programType}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-hae-mist/40 px-3 py-2"
            >
              <p className="text-sm font-semibold text-hae-ink">
                Total {t.programType} ({t.count} registration{t.count === 1 ? '' : 's'})
              </p>
              <p className="text-sm font-semibold text-hae-ink">{formatMoney(t.total)}</p>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-hae-crimson/5 px-3 py-2">
            <p className="text-sm font-semibold text-hae-ink">Total across all courses</p>
            <p
              className={`text-lg font-semibold ${
                grandTotal > 0 ? 'text-emerald-600' : 'text-hae-red'
              }`}
            >
              {formatMoney(grandTotal)}
            </p>
          </div>
        </div>
        <div className="hae-table-scroll mt-4 rounded-lg border border-hae-line">
          <table className="w-full text-left">
            <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Course</th>
                <th className="px-3 py-2 font-semibold">Program</th>
                <th className="px-3 py-2 font-semibold">No. of Participants</th>
                <th className="px-3 py-2 font-semibold">Paid Individual</th>
                <th className="px-3 py-2 font-semibold">Total Paid</th>
              </tr>
            </thead>
            <tbody>
              {totalsByCourse.map((t) => (
                <tr key={t.course} className="border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm font-medium text-hae-ink">{t.course}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{t.programType}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    <input
                      type="number"
                      min="0"
                      value={
                        t.course in participantDrafts
                          ? participantDrafts[t.course]
                          : (participantCounts[t.course] ?? '')
                      }
                      onChange={(e) =>
                        setParticipantDrafts((prev) => ({ ...prev, [t.course]: e.target.value }))
                      }
                      onBlur={(e) => saveParticipantCount(t.course, e.target.value)}
                      className="w-20 rounded border border-hae-line px-2 py-1 text-sm outline-none focus:border-hae-crimson"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{t.count}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-hae-ink">
                    {formatMoney(t.total)}
                  </td>
                </tr>
              ))}
              {totalsByCourse.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-hae-slate">
                    No registrations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form
        onSubmit={addRegistration}
        className="grid gap-3 rounded-xl border border-hae-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <input
          required
          placeholder="Course"
          value={form.course}
          onChange={(e) => setForm({ ...form, course: e.target.value })}
          className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <select
          value={form.programType}
          onChange={(e) => setForm({ ...form, programType: e.target.value })}
          className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        >
          {PROGRAM_TYPES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="First name"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          required
          placeholder="Last name"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount paid"
            value={form.amountPaid}
            onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
            className="w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          />
          <button
            type="submit"
            className="rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold whitespace-nowrap text-white"
          >
            Add
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Search registrations…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="w-full max-w-xs rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <p className="whitespace-nowrap text-xs text-hae-slate">
          {sortedRegistrations.length} registration{sortedRegistrations.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Mobile: card stack with inline edit */}
      <div className="hae-mobile-only hae-mobile-cards">
        {pagedRegistrations.length === 0 ? (
          <div className="hae-mobile-card text-center text-sm text-hae-slate">
            {registrations.length === 0
              ? 'No registrations yet. Add one above or import a list.'
              : 'No registrations match your search.'}
          </div>
        ) : (
          pagedRegistrations.map((r) =>
            editingId === r.id && draft ? (
              <div key={r.id} className="hae-mobile-card space-y-2 border-amber-200 bg-amber-50">
                <input
                  className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                  placeholder="Course"
                  value={draft.course}
                  onChange={(e) => setDraft({ ...draft, course: e.target.value })}
                />
                <select
                  className="w-full rounded border border-hae-line px-2 py-1 text-xs"
                  value={normalizeProgramType(draft.programType)}
                  onChange={(e) => setDraft({ ...draft, programType: e.target.value })}
                >
                  {PROGRAM_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                    placeholder="First name"
                    value={draft.firstName}
                    onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                  />
                  <input
                    className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                    placeholder="Last name"
                    value={draft.lastName}
                    onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                  />
                </div>
                <input
                  type="email"
                  className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                  placeholder="Email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                    placeholder="Amount paid"
                    value={draft.amountPaid}
                    onChange={(e) => setDraft({ ...draft, amountPaid: e.target.value })}
                  />
                  <input
                    type="date"
                    className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                    value={draft.createdAt}
                    onChange={(e) => setDraft({ ...draft, createdAt: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setDraft(null)
                    }}
                    className="text-hae-slate hover:text-hae-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveRegistration}
                    className="font-semibold text-hae-crimson"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div key={r.id} className="hae-mobile-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="hae-mobile-card__title min-w-0 flex-1">
                    {r.firstName} {r.lastName}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.id)
                        setDraft({
                          course: r.course || '',
                          programType: normalizeProgramType(r.programType),
                          firstName: r.firstName || '',
                          lastName: r.lastName || '',
                          email: r.email || '',
                          amountPaid: r.amountPaid ?? '',
                          createdAt: toDateInputValue(r.createdAt),
                        })
                      }}
                      className="text-hae-slate hover:text-hae-crimson"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRegistration(r.id)}
                      className="text-hae-slate hover:text-hae-red"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="hae-mobile-card__meta">
                  <span>{r.course}</span>
                  <span>{normalizeProgramType(r.programType)}</span>
                  <span>{r.email || '—'}</span>
                  <span>{formatMoney(Number(r.amountPaid) || 0)}</span>
                  <span>Added {formatDate(r.createdAt)}</span>
                </div>
              </div>
            )
          )
        )}
      </div>

      <div className="hae-desktop-only hae-table-scroll rounded-xl border border-hae-line bg-white">
        <table className="w-full text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-2 font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1 whitespace-nowrap uppercase text-hae-slate hover:text-hae-ink"
                  >
                    {col.label}
                    {sortKey === col.key && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 font-semibold w-24" />
            </tr>
          </thead>
          <tbody>
            {pagedRegistrations.map((r) =>
              editingId === r.id && draft ? (
                <tr key={r.id} className="bg-amber-50">
                  <td className="px-3 py-2 space-y-1">
                    <input
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                      value={draft.course}
                      onChange={(e) => setDraft({ ...draft, course: e.target.value })}
                    />
                    <select
                      className="w-full rounded border border-hae-line px-2 py-1 text-xs"
                      value={normalizeProgramType(draft.programType)}
                      onChange={(e) => setDraft({ ...draft, programType: e.target.value })}
                    >
                      {PROGRAM_TYPES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                      value={draft.firstName}
                      onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                      value={draft.lastName}
                      onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="email"
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                      value={draft.amountPaid}
                      onChange={(e) => setDraft({ ...draft, amountPaid: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                      value={draft.createdAt}
                      onChange={(e) => setDraft({ ...draft, createdAt: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <button
                      type="button"
                      onClick={saveRegistration}
                      className="font-semibold text-hae-crimson"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm">
                    <p className="font-medium text-hae-ink">{r.course}</p>
                    <p className="text-xs text-hae-slate">{normalizeProgramType(r.programType)}</p>
                  </td>
                  <td className="px-3 py-2 text-sm">{r.firstName}</td>
                  <td className="px-3 py-2 text-sm">{r.lastName}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{r.email || '—'}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {formatMoney(Number(r.amountPaid) || 0)}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(r.id)
                          setDraft({
                            course: r.course || '',
                            programType: normalizeProgramType(r.programType),
                            firstName: r.firstName || '',
                            lastName: r.lastName || '',
                            email: r.email || '',
                            amountPaid: r.amountPaid ?? '',
                            createdAt: toDateInputValue(r.createdAt),
                          })
                        }}
                        className="text-xs text-hae-slate hover:text-hae-crimson"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRegistration(r.id)}
                        className="text-xs text-hae-slate hover:text-hae-red"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {sortedRegistrations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-hae-slate">
                  {registrations.length === 0
                    ? 'No registrations yet. Add one above or import a list.'
                    : 'No registrations match your search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-hae-slate">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="hae-btn-secondary rounded-md border border-hae-line px-3 py-1.5 text-xs font-semibold uppercase text-hae-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <p>
            Page {currentPage} of {pageCount}
          </p>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="hae-btn-secondary rounded-md border border-hae-line px-3 py-1.5 text-xs font-semibold uppercase text-hae-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
