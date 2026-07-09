import { useCallback, useEffect, useState } from 'react'
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
import { CHECKIN_TYPES } from '../constants'

export default function CheckIns() {
  const [items, setItems] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    learnerName: '',
    courseId: '',
    type: '60-day',
    dueDate: '',
    notes: '',
  })

  const load = useCallback(async () => {
    const [kSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'checkIns')),
      getDocs(collection(db, 'courses')),
    ])
    setCourses(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    const list = kSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    setItems(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    const course = courses.find((c) => c.id === form.courseId)
    if (!form.learnerName.trim()) return
    await addDoc(collection(db, 'checkIns'), {
      learnerName: form.learnerName.trim(),
      courseId: course?.id || '',
      courseName: course?.name || '',
      type: form.type,
      dueDate: form.dueDate || '',
      notes: form.notes.trim(),
      status: 'Scheduled',
      createdAt: serverTimestamp(),
    })
    setForm({
      learnerName: '',
      courseId: '',
      type: '60-day',
      dueDate: '',
      notes: '',
    })
    load()
  }

  const markDone = async (id) => {
    await updateDoc(doc(db, 'checkIns', id), { status: 'Completed' })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete check-in?')) return
    await deleteDoc(doc(db, 'checkIns', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading check-ins…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-hae-ink">Check-ins</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Signature HAE Academy 30 / 60 / 180-day accountability milestones
        </p>
      </header>

      <form
        onSubmit={create}
        className="grid gap-3 border border-hae-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input
          required
          placeholder="Learner name"
          value={form.learnerName}
          onChange={(e) => setForm({ ...form, learnerName: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <select
          value={form.courseId}
          onChange={(e) => setForm({ ...form, courseId: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        >
          <option value="">Course (optional)</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        >
          {CHECKIN_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm sm:col-span-2"
        />
        <button
          type="submit"
          className="bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase sm:col-span-2 lg:col-span-3"
        >
          Schedule check-in
        </button>
      </form>

      <div className="border border-hae-line bg-white">
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Due</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Learner</th>
              <th className="px-3 py-2 font-semibold">Course</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold w-28" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No check-ins scheduled
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.dueDate || '—'}</td>
                  <td className="px-3 py-2 text-sm font-medium">{c.type}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.learnerName}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {c.courseName || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.status}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {c.status !== 'Completed' && (
                      <button
                        type="button"
                        onClick={() => markDone(c.id)}
                        className="mr-2 font-semibold text-hae-crimson"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="text-hae-slate opacity-0 group-hover:opacity-100 hover:text-hae-red"
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
