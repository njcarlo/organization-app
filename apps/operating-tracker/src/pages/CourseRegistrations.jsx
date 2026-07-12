import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import ModuleImportPanel from '../components/ModuleImportPanel'

const emptyForm = { course: '', firstName: '', lastName: '', email: '', amountPaid: '' }

function formatMoney(cents) {
  return (cents || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

export default function CourseRegistrations() {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, 'courseRegistrations'))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.course || '').localeCompare(b.course || ''))
      setRegistrations(list)
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
      const entry = map.get(key) || { course: key, count: 0, total: 0 }
      entry.count += 1
      entry.total += Number(r.amountPaid) || 0
      map.set(key, entry)
    }
    return Array.from(map.values()).sort((a, b) => a.course.localeCompare(b.course))
  }, [registrations])

  const grandTotal = useMemo(
    () => registrations.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0),
    [registrations]
  )

  const addRegistration = async (e) => {
    e.preventDefault()
    if (!form.course.trim() || !form.firstName.trim() || !form.lastName.trim()) return
    setError('')
    try {
      await addDoc(collection(db, 'courseRegistrations'), {
        course: form.course.trim(),
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
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim().toLowerCase(),
        amountPaid: Number(draft.amountPaid) || 0,
      })
      setEditingId(null)
      setDraft(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save registration')
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

      {/* Dashboard: totals per course + overall */}
      <div className="rounded-xl border border-hae-line bg-white p-4">
        <h2 className="text-sm font-semibold text-hae-ink">Payments dashboard</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {totalsByCourse.map((t) => (
            <div key={t.course} className="rounded-lg border border-hae-line bg-hae-mist/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-hae-slate">
                {t.course}
              </p>
              <p className="mt-1 text-lg font-semibold text-hae-ink">{formatMoney(t.total)}</p>
              <p className="text-xs text-hae-slate">
                {t.count} registration{t.count === 1 ? '' : 's'}
              </p>
            </div>
          ))}
          {totalsByCourse.length === 0 && (
            <p className="text-sm text-hae-slate">No registrations yet.</p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-hae-crimson/5 px-3 py-2">
          <p className="text-sm font-semibold text-hae-ink">Total across all courses</p>
          <p className="text-lg font-semibold text-hae-crimson">{formatMoney(grandTotal)}</p>
        </div>
      </div>

      <form
        onSubmit={addRegistration}
        className="grid gap-3 rounded-xl border border-hae-line bg-white p-4 sm:grid-cols-5"
      >
        <input
          required
          placeholder="Course"
          value={form.course}
          onChange={(e) => setForm({ ...form, course: e.target.value })}
          className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
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

      <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
        <table className="w-full text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Course</th>
              <th className="px-3 py-2 font-semibold">First Name</th>
              <th className="px-3 py-2 font-semibold">Last Name</th>
              <th className="px-3 py-2 font-semibold">Email Address</th>
              <th className="px-3 py-2 font-semibold">Amount Paid</th>
              <th className="px-3 py-2 font-semibold w-24" />
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) =>
              editingId === r.id && draft ? (
                <tr key={r.id} className="bg-amber-50">
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                      value={draft.course}
                      onChange={(e) => setDraft({ ...draft, course: e.target.value })}
                    />
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
                  <td className="px-3 py-2 text-sm font-medium">{r.course}</td>
                  <td className="px-3 py-2 text-sm">{r.firstName}</td>
                  <td className="px-3 py-2 text-sm">{r.lastName}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{r.email || '—'}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {formatMoney(Number(r.amountPaid) || 0)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(r.id)
                          setDraft({
                            course: r.course || '',
                            firstName: r.firstName || '',
                            lastName: r.lastName || '',
                            email: r.email || '',
                            amountPaid: r.amountPaid ?? '',
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
            {registrations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-hae-slate">
                  No registrations yet. Add one above or import a list.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
