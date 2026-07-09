import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { COURSE_STATUSES, LEARNING_PATHS } from '../constants'

export default function Courses() {
  const [courses, setCourses] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: '',
    path: 'academy',
    facilitator: '',
    description: '',
    durationWeeks: '',
    status: 'Draft',
  })

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'courses'))
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setCourses(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    await addDoc(collection(db, 'courses'), {
      name: form.name.trim(),
      path: form.path,
      facilitator: form.facilitator.trim(),
      description: form.description.trim(),
      durationWeeks: form.durationWeeks ? Number(form.durationWeeks) : null,
      status: form.status,
      createdAt: serverTimestamp(),
    })
    setForm({
      name: '',
      path: 'academy',
      facilitator: '',
      description: '',
      durationWeeks: '',
      status: 'Draft',
    })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this course?')) return
    await deleteDoc(doc(db, 'courses', id))
    load()
  }

  const visible =
    filter === 'all' ? courses : courses.filter((c) => c.path === filter)

  if (loading) return <p className="text-sm text-hae-slate">Loading courses…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Manage courses</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Staff catalog — create and manage Academy / Flagship courses. Students browse the Catalog.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All' },
          { id: 'academy', label: 'Academy' },
          { id: 'flagship', label: 'Flagship' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-semibold ${
              filter === f.id
                ? 'bg-hae-ink text-white'
                : 'border border-hae-line bg-white text-hae-slate'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={create}
        className="grid gap-3 border border-hae-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input
          required
          placeholder="Course name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <select
          value={form.path}
          onChange={(e) => setForm({ ...form, path: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        >
          {LEARNING_PATHS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Facilitator / expert"
          value={form.facilitator}
          onChange={(e) => setForm({ ...form, facilitator: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
        />
        <input
          type="number"
          min="1"
          placeholder="Duration (weeks)"
          value={form.durationWeeks}
          onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        >
          {COURSE_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase lg:col-span-2"
        >
          Add course
        </button>
      </form>

      <div className="overflow-x-auto border border-hae-line bg-white">
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Course</th>
              <th className="px-3 py-2 font-semibold">Path</th>
              <th className="px-3 py-2 font-semibold">Facilitator</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold w-24" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No courses yet
                </td>
              </tr>
            ) : (
              visible.map((c) => (
                <tr key={c.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2">
                    <Link
                      to={`/courses/${c.id}`}
                      className="text-sm font-medium text-hae-crimson hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.description ? (
                      <div className="text-xs text-hae-slate">{c.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-sm capitalize text-hae-slate">
                    {c.path || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {c.facilitator || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.status}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="text-xs text-hae-slate opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-hae-red"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
