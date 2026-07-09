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

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: '',
    date: '',
    location: '',
    capacity: '',
    description: '',
  })

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'events'))
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    setEvents(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    await addDoc(collection(db, 'events'), {
      name: form.name.trim(),
      date: form.date || '',
      location: form.location.trim(),
      capacity: form.capacity ? Number(form.capacity) : null,
      description: form.description.trim(),
      createdAt: serverTimestamp(),
    })
    setForm({
      name: '',
      date: '',
      location: '',
      capacity: '',
      description: '',
    })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete event?')) return
    await deleteDoc(doc(db, 'events', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading events…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Events</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Event listings linked to membership engagement
        </p>
      </header>

      <form
        onSubmit={create}
        className="grid gap-3 border border-hae-line bg-white p-4 sm:grid-cols-2"
      >
        <input
          required
          placeholder="Event name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <input
          placeholder="Location / Zoom"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Capacity"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm sm:col-span-2"
        />
        <button
          type="submit"
          className="bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase sm:col-span-2"
        >
          Add event
        </button>
      </form>

      <div className="overflow-x-auto border border-hae-line bg-white">
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Event</th>
              <th className="px-3 py-2 font-semibold">Location</th>
              <th className="px-3 py-2 font-semibold">Capacity</th>
              <th className="px-3 py-2 font-semibold w-20" />
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No events yet
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm text-hae-slate">{e.date || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{e.name}</div>
                    {e.description ? (
                      <div className="text-xs text-hae-slate">{e.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {e.location || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {e.capacity ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
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
