import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { COMMITTEE_ROLES } from '../constants'

export default function Committees() {
  const [items, setItems] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    memberId: '',
    role: 'Member',
    notes: '',
  })

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([
      getDocs(collection(db, 'committees')),
      getDocs(collection(db, 'members')),
    ])
    setMembers(m.docs.map((d) => ({ id: d.id, ...d.data() })))
    const list = c.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setItems(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    const member = members.find((x) => x.id === form.memberId)
    if (!form.name.trim()) return
    await addDoc(collection(db, 'committees'), {
      name: form.name.trim(),
      memberId: member?.id || '',
      memberName: member?.name || '',
      role: form.role,
      notes: form.notes.trim(),
      createdAt: serverTimestamp(),
    })
    setForm({ name: '', memberId: '', role: 'Member', notes: '' })
    setOpen(false)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete committee assignment?')) return
    await deleteDoc(doc(db, 'committees', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading committees…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Committees</h1>
          <p className="mt-1 text-sm text-hae-slate">
            Committee and volunteer assignments
          </p>
        </div>
        <button type="button" className="hae-btn" onClick={() => setOpen(true)}>
          Add assignment
        </button>
      </header>

      
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Add assignment"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="add-committee-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Add assignment'}
            </button>
          </>
        }
      >
        <form id="add-committee-form" onSubmit={create} className="grid gap-3 sm:grid-cols-2">

          <input
            required
            placeholder="Committee name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          />
          <select
            value={form.memberId}
            onChange={(e) => setForm({ ...form, memberId: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          >
            <option value="">Member (optional)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          >
            {COMMITTEE_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          />
        </form>
      </Modal>

      <div className="hae-table-scroll border border-hae-line bg-white">
        <table className="w-full min-w-[520px] lg:min-w-[700px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Committee</th>
              <th className="px-3 py-2 font-semibold">Member</th>
              <th className="px-3 py-2 font-semibold">Role</th>
              <th className="px-3 py-2 font-semibold">Notes</th>
              <th className="px-3 py-2 font-semibold w-20" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No committee assignments yet
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {c.memberName || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.role}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.notes || '—'}</td>
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
