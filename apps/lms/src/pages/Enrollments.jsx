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
import { ENROLLMENT_STATUSES } from '../constants'

export default function Enrollments() {
  const [enrollments, setEnrollments] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    learnerName: '',
    learnerEmail: '',
    courseId: '',
    status: 'Enrolled',
    progress: '0',
  })

  const load = useCallback(async () => {
    const [eSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'enrollments')),
      getDocs(collection(db, 'courses')),
    ])
    const courseList = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    courseList.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setCourses(courseList)
    const list = eSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.learnerName || '').localeCompare(b.learnerName || ''))
    setEnrollments(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    const course = courses.find((c) => c.id === form.courseId)
    if (!form.learnerName.trim() || !course) return
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
    setForm({
      learnerName: '',
      learnerEmail: '',
      courseId: '',
      status: 'Enrolled',
      progress: '0',
    })
    load()
  }

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, 'enrollments', id), { status })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete enrollment?')) return
    await deleteDoc(doc(db, 'enrollments', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading enrollments…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-hae-ink">Enrollments</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Link learners to Academy / Flagship courses and track progress
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
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          type="email"
          placeholder="Learner email"
          value={form.learnerEmail}
          onChange={(e) => setForm({ ...form, learnerEmail: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <select
          required
          value={form.courseId}
          onChange={(e) => setForm({ ...form, courseId: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        >
          <option value="">Select course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        >
          {ENROLLMENT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Progress %"
          value={form.progress}
          onChange={(e) => setForm({ ...form, progress: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase"
        >
          Enroll learner
        </button>
      </form>

      <div className="overflow-x-auto border border-hae-line bg-white">
        <table className="w-full min-w-[800px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Learner</th>
              <th className="px-3 py-2 font-semibold">Course</th>
              <th className="px-3 py-2 font-semibold">Path</th>
              <th className="px-3 py-2 font-semibold">Progress</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold w-20" />
            </tr>
          </thead>
          <tbody>
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No enrollments yet
                </td>
              </tr>
            ) : (
              enrollments.map((row) => (
                <tr key={row.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{row.learnerName}</div>
                    <div className="text-xs text-hae-slate">{row.learnerEmail || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.courseName}</td>
                  <td className="px-3 py-2 text-sm capitalize text-hae-slate">
                    {row.path || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.progress ?? 0}%</td>
                  <td className="px-3 py-2">
                    <select
                      value={row.status}
                      onChange={(e) => updateStatus(row.id, e.target.value)}
                      className="border border-hae-line px-2 py-1 text-sm"
                    >
                      {ENROLLMENT_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      className="text-xs text-hae-slate opacity-0 group-hover:opacity-100 hover:text-hae-red"
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
