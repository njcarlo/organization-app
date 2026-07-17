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
import { CommentsPanel, Linkify, Modal } from '@hae/ui'
import { db } from '../firebase'
import { INTERACTION_TYPES } from '../constants'
import {
  AttachmentField,
  AttachmentList,
  attachmentsToFormLines,
  formLinesToAttachments,
} from '../components/Attachments'

export default function Interactions() {
  const [interactions, setInteractions] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
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

  const resetForm = () => {
    setForm({
      contactId: '',
      type: 'Email',
      date: '',
      subject: '',
      notes: '',
      attachmentLines: '',
    })
    setEditingId(null)
  }

  const close = () => {
    if (saving) return
    setOpen(false)
    resetForm()
  }

  const openAdd = () => {
    resetForm()
    setOpen(true)
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setForm({
      contactId: row.contactId || '',
      type: row.type || 'Email',
      date: row.date || '',
      subject: row.subject || '',
      notes: row.notes || '',
      attachmentLines: attachmentsToFormLines(row.attachments),
    })
    setOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (saving) return
    const contact = contacts.find((c) => c.id === form.contactId)
    if (!contact) return
    setSaving(true)
    const payload = {
      contactId: contact.id,
      contactName: contact.name,
      type: form.type,
      date: form.date || new Date().toISOString().slice(0, 10),
      subject: form.subject.trim(),
      notes: form.notes.trim(),
      attachments: formLinesToAttachments(form.attachmentLines),
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, 'interactions', editingId), payload)
      } else {
        await addDoc(collection(db, 'interactions'), {
          ...payload,
          createdAt: serverTimestamp(),
        })
      }
      setOpen(false)
      resetForm()
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this interaction? This action cannot be undone.')) return
    await deleteDoc(doc(db, 'interactions', id))
    if (editingId === id) {
      setOpen(false)
      resetForm()
    }
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

      
      
      <div className="hae-form-actions">
        <button type="button" className="hae-btn" onClick={openAdd}>
          Log interaction
        </button>
      </div>
<Modal
        open={open}
        onClose={close}
        title={editingId ? 'Update interaction' : 'Log interaction'}
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="interaction-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update interaction' : 'Log interaction'}
            </button>
          </>
        }
      >
        <form id="interaction-form" onSubmit={save} className="grid gap-3 sm:grid-cols-2">

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
        </form>
        {editingId ? (
          <div className="mt-4 border-t border-hae-line pt-3">
            <CommentsPanel
              parentType="interactions"
              parentId={editingId}
              parentName={
                form.subject ||
                contacts.find((c) => c.id === form.contactId)?.name ||
                'Interaction'
              }
              deepLink="https://crm-hae.web.app"
            />
          </div>
        ) : null}
      </Modal>


      <div className="hae-table-scroll border border-hae-line bg-white">
        <table className="w-full min-w-[520px] lg:min-w-[700px] text-left">
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
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    <Linkify text={row.notes || '—'} />
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="mr-2 font-semibold text-hae-crimson opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      className="text-hae-slate opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-hae-red"
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
