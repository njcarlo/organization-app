import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    title: 'Office Hours',
    courseId: '',
    date: '',
    time: '',
    location: '',
    zoomLink: '',
  })

  const load = useCallback(async () => {
    const [sSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'sessions')),
      getDocs(collection(db, 'courses')),
    ])
    setCourses(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    const list = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    setSessions(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    const course = courses.find((c) => c.id === form.courseId)
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
    setForm({
      title: 'Office Hours',
      courseId: '',
      date: '',
      time: '',
      location: '',
      zoomLink: '',
    })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete session?')) return
    await deleteDoc(doc(db, 'sessions', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading sessions…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Office Hours</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Live working sessions — schedule, location, and Zoom links
        </p>
      </header>

      <form
        onSubmit={create}
        className="grid gap-3 border border-hae-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
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
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <input
          type="time"
          value={form.time}
          onChange={(e) => setForm({ ...form, time: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <input
          placeholder="Zoom link"
          value={form.zoomLink}
          onChange={(e) => setForm({ ...form, zoomLink: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase sm:col-span-2 lg:col-span-3"
        >
          Add session
        </button>
      </form>

      <div className="overflow-x-auto border border-hae-line bg-white">
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Title</th>
              <th className="px-3 py-2 font-semibold">Course</th>
              <th className="px-3 py-2 font-semibold">Join</th>
              <th className="px-3 py-2 font-semibold w-20" />
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No sessions scheduled
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {s.date || '—'}
                    {s.time ? ` ${s.time}` : ''}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium">{s.title}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {s.courseName || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {s.zoomLink ? (
                      <a
                        href={s.zoomLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-hae-crimson hover:underline"
                      >
                        Zoom
                      </a>
                    ) : (
                      s.location || '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
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
