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
import { MEMBER_STATUSES } from '../constants'

export default function Members() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: '',
    email: '',
    cohort: '',
    chapter: '',
    status: 'active',
    joinDate: '',
  })

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'members'))
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setMembers(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    await addDoc(collection(db, 'members'), {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      cohort: form.cohort.trim(),
      chapter: form.chapter.trim(),
      status: form.status,
      joinDate: form.joinDate || '',
      createdAt: serverTimestamp(),
    })
    setForm({
      name: '',
      email: '',
      cohort: '',
      chapter: '',
      status: 'active',
      joinDate: '',
    })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete member?')) return
    await deleteDoc(doc(db, 'members', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading members…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Members</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Directory of HAE members — cohort, chapter, and status
        </p>
      </header>

      <form
        onSubmit={create}
        className="border border-hae-line bg-white p-4"
      >
        <div className="hae-form-actions">
          <button type="submit" className="hae-btn">
            Add member
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Cohort"
            value={form.cohort}
            onChange={(e) => setForm({ ...form, cohort: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Chapter"
            value={form.chapter}
            onChange={(e) => setForm({ ...form, chapter: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          >
            {MEMBER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.joinDate}
            onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          />
        </div>
      </form>

      <div className="overflow-x-auto border border-hae-line bg-white">
        <table className="w-full min-w-[800px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Cohort</th>
              <th className="px-3 py-2 font-semibold">Chapter</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Joined</th>
              <th className="px-3 py-2 font-semibold w-20" />
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No members yet
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-hae-slate">{m.email || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{m.cohort || '—'}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{m.chapter || '—'}</td>
                  <td className="px-3 py-2 text-sm capitalize text-hae-slate">{m.status}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{m.joinDate || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
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
