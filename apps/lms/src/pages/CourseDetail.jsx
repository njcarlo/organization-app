import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { useAuth } from '@hae/ui'
import { db } from '../firebase'
import { MODULE_TYPES } from '../constants'

export default function CourseDetail() {
  const { courseId } = useParams()
  const { isAdmin } = useAuth()
  const [course, setCourse] = useState(null)
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    title: '',
    type: 'Lesson',
    order: '',
    resourceUrl: '',
  })

  const load = useCallback(async () => {
    const [courseSnap, moduleSnap] = await Promise.all([
      getDoc(doc(db, 'courses', courseId)),
      getDocs(collection(db, 'modules')),
    ])
    if (!courseSnap.exists()) {
      setCourse(null)
      setModules([])
      setLoading(false)
      return
    }
    setCourse({ id: courseSnap.id, ...courseSnap.data() })
    const list = moduleSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.courseId === courseId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    setModules(list)
    setLoading(false)
  }, [courseId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const addModule = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const nextOrder =
      form.order !== ''
        ? Number(form.order)
        : modules.reduce((m, x) => Math.max(m, x.order ?? 0), 0) + 1
    await addDoc(collection(db, 'modules'), {
      courseId,
      courseName: course.name,
      title: form.title.trim(),
      type: form.type,
      order: nextOrder,
      resourceUrl: form.resourceUrl.trim(),
      createdAt: serverTimestamp(),
    })
    setForm({ title: '', type: 'Lesson', order: '', resourceUrl: '' })
    load()
  }

  const removeModule = async (id) => {
    if (!confirm('Delete this module?')) return
    await deleteDoc(doc(db, 'modules', id))
    load()
  }

  const saveCourseField = async (field, value) => {
    await updateDoc(doc(db, 'courses', courseId), { [field]: value })
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading course…</p>
  if (!course) {
    return (
      <p className="text-sm text-hae-red">
        Course not found. <Link to="/courses">Back</Link>
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={isAdmin ? '/courses' : '/catalog'}
          className="text-xs font-semibold text-hae-crimson"
        >
          ← {isAdmin ? 'Courses' : 'Catalog'}
        </Link>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl">{course.name}</h1>
        <p className="mt-1 text-sm text-hae-slate">
          {course.path === 'flagship' ? 'Flagship Deep Dive' : 'Academy Fast Track'}
          {course.facilitator ? ` · ${course.facilitator}` : ''}
          {course.durationWeeks ? ` · ${course.durationWeeks} weeks` : ''}
          {course.status ? ` · ${course.status}` : ''}
        </p>
        {course.description ? (
          <p className="mt-3 text-sm text-hae-slate">{course.description}</p>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          {['Draft', 'Open', 'In Progress', 'Completed', 'Archived'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => saveCourseField('status', s)}
              className={`px-3 py-1.5 text-xs font-semibold ${
                course.status === s
                  ? 'bg-hae-crimson text-white'
                  : 'border border-hae-line bg-white text-hae-slate'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-hae-slate">
          Modules & sessions
        </h2>
        {isAdmin ? (
          <form
            onSubmit={addModule}
            className="grid gap-3 border border-hae-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <input
              required
              placeholder="Module title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="border border-hae-line px-3 py-2 text-sm"
            >
              {MODULE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Order"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: e.target.value })}
              className="border border-hae-line px-3 py-2 text-sm"
            />
            <input
              placeholder="Resource / Zoom / PDF URL"
              value={form.resourceUrl}
              onChange={(e) => setForm({ ...form, resourceUrl: e.target.value })}
              className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <button
              type="submit"
              className="bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase sm:col-span-2 lg:col-span-4"
            >
              Add module
            </button>
          </form>
        ) : null}

        <div className="overflow-x-auto border border-hae-line bg-white">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Resource</th>
                {isAdmin ? <th className="px-3 py-2 font-semibold w-20" /> : null}
              </tr>
            </thead>
            <tbody>
              {modules.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="px-3 py-6 text-center text-sm text-hae-slate"
                  >
                    {isAdmin
                      ? 'No modules yet — add lessons, office hours, quizzes, workbooks'
                      : 'No modules published for this course yet'}
                  </td>
                </tr>
              ) : (
                modules.map((m) => (
                  <tr key={m.id} className="group border-b border-hae-line/70">
                    <td className="px-3 py-2 text-sm text-hae-slate">{m.order}</td>
                    <td className="px-3 py-2 text-sm font-medium">{m.title}</td>
                    <td className="px-3 py-2 text-sm text-hae-slate">{m.type}</td>
                    <td className="px-3 py-2 text-sm text-hae-slate">
                      {m.resourceUrl ? (
                        <a
                          href={m.resourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-hae-crimson hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    {isAdmin ? (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeModule(m.id)}
                          className="text-xs text-hae-slate opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-hae-red"
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
