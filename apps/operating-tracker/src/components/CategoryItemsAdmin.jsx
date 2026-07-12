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
import LeadSelect from './LeadSelect'
import { namesLabel, toNameList } from '../utils'

const emptyCourseFields = {
  haeLead: [],
  startDate: '',
  durationWeeks: '',
  instructor: '',
  guestSpeaker: '',
}

/**
 * Generic add/edit/delete panel for a Program-shaped top-level collection
 * (name + lead + order), mirroring Admin's Programs tab. Powers the Academy
 * and Custom Programs sidebar categories. Pass showCourseFields to also
 * capture Academy course-style fields (HAE Lead, Start Date, Duration,
 * Instructor, Guest Speaker), mirroring apps/lms Courses.jsx.
 */
export default function CategoryItemsAdmin({ collectionName, itemLabel, showCourseFields }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newItem, setNewItem] = useState({
    name: '',
    lead: [],
    ...(showCourseFields ? emptyCourseFields : {}),
  })
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, collectionName))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setItems(list)
    } catch (err) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [collectionName])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const addItem = async (e) => {
    e.preventDefault()
    if (!newItem.name.trim()) return
    setError('')
    try {
      const maxOrder = items.reduce((m, p) => Math.max(m, p.order ?? 0), 0)
      await addDoc(collection(db, collectionName), {
        name: newItem.name.trim(),
        lead: newItem.lead,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
        ...(showCourseFields
          ? {
              haeLead: newItem.haeLead,
              startDate: newItem.startDate,
              durationWeeks: newItem.durationWeeks ? Number(newItem.durationWeeks) : null,
              instructor: newItem.instructor.trim(),
              guestSpeaker: newItem.guestSpeaker.trim(),
            }
          : {}),
      })
      setNewItem({ name: '', lead: [], ...(showCourseFields ? emptyCourseFields : {}) })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to add item')
    }
  }

  const saveItem = async () => {
    if (!draft?.name.trim()) return
    setError('')
    try {
      await updateDoc(doc(db, collectionName, editingId), {
        name: draft.name.trim(),
        lead: draft.lead,
        ...(showCourseFields
          ? {
              haeLead: draft.haeLead,
              startDate: draft.startDate,
              durationWeeks: draft.durationWeeks ? Number(draft.durationWeeks) : null,
              instructor: draft.instructor.trim(),
              guestSpeaker: draft.guestSpeaker.trim(),
            }
          : {}),
      })
      setEditingId(null)
      setDraft(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save item')
    }
  }

  const removeItem = async (id) => {
    if (
      !confirm(
        `Delete this ${itemLabel.toLowerCase()}? Projects and tasks are not cascade-deleted.`
      )
    ) {
      return
    }
    setError('')
    try {
      await deleteDoc(doc(db, collectionName, id))
      await load()
    } catch (err) {
      setError(err.message || 'Failed to delete item')
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-hae-red">{error}</p>}
      <form
        onSubmit={addItem}
        className="grid gap-3 rounded-xl border border-hae-line bg-white p-4 sm:grid-cols-3"
      >
        <input
          required
          placeholder={`${itemLabel} name`}
          value={newItem.name}
          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <LeadSelect
          value={newItem.lead}
          onChange={(lead) => setNewItem({ ...newItem, lead })}
          placeholder="Overall lead"
        />
        {showCourseFields ? (
          <>
            <LeadSelect
              value={newItem.haeLead}
              onChange={(haeLead) => setNewItem({ ...newItem, haeLead })}
              placeholder="HAE Lead"
            />
            <input
              type="date"
              placeholder="Start date"
              value={newItem.startDate}
              onChange={(e) => setNewItem({ ...newItem, startDate: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm text-hae-slate"
            />
            <input
              type="number"
              min="1"
              placeholder="Duration (weeks)"
              value={newItem.durationWeeks}
              onChange={(e) => setNewItem({ ...newItem, durationWeeks: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            />
            <input
              placeholder="Instructor"
              value={newItem.instructor}
              onChange={(e) => setNewItem({ ...newItem, instructor: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <input
              placeholder="Guest speaker"
              value={newItem.guestSpeaker}
              onChange={(e) => setNewItem({ ...newItem, guestSpeaker: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </>
        ) : null}
        <button
          type="submit"
          className="rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold text-white"
        >
          Add {itemLabel.toLowerCase()}
        </button>
      </form>

      <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
        <table className="w-full text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Lead</th>
              <th className="px-3 py-2 font-semibold">Order</th>
              <th className="px-3 py-2 font-semibold w-24" />
            </tr>
          </thead>
          <tbody>
            {items.map((p) =>
              editingId === p.id && draft ? (
                <tr key={p.id} className="bg-amber-50">
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                    {showCourseFields ? (
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        <LeadSelect
                          className="w-full rounded border border-hae-line px-2 py-1 text-xs"
                          placeholder="HAE Lead"
                          value={draft.haeLead}
                          onChange={(haeLead) => setDraft({ ...draft, haeLead })}
                        />
                        <input
                          type="date"
                          className="w-full rounded border border-hae-line px-2 py-1 text-xs text-hae-slate"
                          value={draft.startDate}
                          onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Duration (weeks)"
                          className="w-full rounded border border-hae-line px-2 py-1 text-xs"
                          value={draft.durationWeeks}
                          onChange={(e) => setDraft({ ...draft, durationWeeks: e.target.value })}
                        />
                        <input
                          placeholder="Instructor"
                          className="w-full rounded border border-hae-line px-2 py-1 text-xs"
                          value={draft.instructor}
                          onChange={(e) => setDraft({ ...draft, instructor: e.target.value })}
                        />
                        <input
                          placeholder="Guest speaker"
                          className="w-full rounded border border-hae-line px-2 py-1 text-xs sm:col-span-2"
                          value={draft.guestSpeaker}
                          onChange={(e) => setDraft({ ...draft, guestSpeaker: e.target.value })}
                        />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <LeadSelect
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                      value={draft.lead}
                      onChange={(lead) => setDraft({ ...draft, lead })}
                    />
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{p.order}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    <button
                      type="button"
                      onClick={saveItem}
                      className="font-semibold text-hae-crimson"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm font-medium">
                    {p.name}
                    {showCourseFields ? (
                      <div className="mt-0.5 text-xs font-normal text-hae-slate">
                        {[
                          namesLabel(p.haeLead) && `HAE Lead: ${namesLabel(p.haeLead)}`,
                          p.startDate && `Start: ${p.startDate}`,
                          p.durationWeeks && `${p.durationWeeks} weeks`,
                          p.instructor && `Instructor: ${p.instructor}`,
                          p.guestSpeaker && `Guest: ${p.guestSpeaker}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{namesLabel(p.lead) || '—'}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{p.order}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(p.id)
                          setDraft({
                            name: p.name,
                            lead: toNameList(p.lead),
                            ...(showCourseFields
                              ? {
                                  haeLead: toNameList(p.haeLead),
                                  startDate: p.startDate || '',
                                  durationWeeks: p.durationWeeks ?? '',
                                  instructor: p.instructor || '',
                                  guestSpeaker: p.guestSpeaker || '',
                                }
                              : {}),
                          })
                        }}
                        className="text-xs text-hae-slate hover:text-hae-crimson"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(p.id)}
                        className="text-xs text-hae-slate hover:text-hae-red"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
