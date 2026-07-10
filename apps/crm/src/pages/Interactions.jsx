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
import { INTERACTION_TYPES } from '../constants'
import {
  AttachmentField,
  AttachmentList,
  formLinesToAttachments,
} from '../components/Attachments'

export default function Interactions() {
  const [interactions, setInteractions] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    contactId: '',
    type: 'Email',
    date: '',
    subject: '',
    notes: '',
    attachmentLines: '',
  })

  const load = useCallback(async () => {
    const [iSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'interactions')),
      getDocs(collection(db, 'contacts')),
    ])
    const contactList = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    contactList.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setContacts(contactList)
    const list = iSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    setInteractions(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    const contact = contacts.find((c) => c.id === form.contactId)
    if (!contact) return
    await addDoc(collection(db, 'interactions'), {
      contactId: contact.id,
      contactName: contact.name,
      type: form.type,
      date: form.date || new Date().toISOString().slice(0, 10),
      subject: form.subject.trim(),
      notes: form.notes.trim(),
      attachments: formLinesToAttachments(form.attachmentLines),
      createdAt: serverTimestamp(),
    })
    setForm({
      contactId: '',
      type: 'Email',
      date: '',
      subject: '',
      notes: '',
      attachmentLines: '',
    })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this interaction?')) return
    await deleteDoc(doc(db, 'interactions', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading interactions…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Interactions</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Log emails, calls, meetings, and notes linked to contacts
        </p>
      </header>

      <form
        onSubmit={create}
        className="grid gap-3 border border-hae-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <select
          required
          value={form.contactId}
          onChange={(e) => setForm({ ...form, contactId: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        >
          <option value="">Select contact</option>
          {contacts.map((c) => (
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
          {INTERACTION_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        />
        <input
          placeholder="Subject"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
        />
        <input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <AttachmentField
          className="sm:col-span-2 lg:col-span-3"
          value={form.attachmentLines}
          onChange={(attachmentLines) => setForm({ ...form, attachmentLines })}
        />
        <button
          type="submit"
          className="bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase sm:col-span-2 lg:col-span-3"
        >
          Log interaction
        </button>
      </form>

      <div className="overflow-x-auto border border-hae-line bg-white">
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Contact</th>
              <th className="px-3 py-2 font-semibold">Subject</th>
              <th className="px-3 py-2 font-semibold">Notes</th>
              <th className="px-3 py-2 font-semibold w-20" />
            </tr>
          </thead>
          <tbody>
            {interactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No interactions logged
                </td>
              </tr>
            ) : (
              interactions.map((row) => (
                <tr key={row.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.date || '—'}</td>
                  <td className="px-3 py-2 text-sm font-medium">{row.type}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {row.contactName || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {row.subject || '—'}
                    <AttachmentList attachments={row.attachments} />
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.notes || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
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
