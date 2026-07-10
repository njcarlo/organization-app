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
import {
  CONTACT_TYPES,
  PIPELINE_STAGES,
  REGIONS,
} from '../constants'
import PersonLinks from '../components/PersonLinks'
import {
  AttachmentField,
  AttachmentList,
  attachmentsToFormLines,
  formLinesToAttachments,
} from '../components/Attachments'
import { FEATURES, Modal, useFeatures } from '@hae/ui'

const emptyForm = {
  name: '',
  email: '',
  type: 'prospect',
  region: 'North America',
  tags: '',
  stage: 'prospect',
  notes: '',
  followUpDate: '',
  attachmentLines: '',
}

export default function Contacts() {
  const { isEnabled } = useFeatures()
  const [contacts, setContacts] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [linkEmail, setLinkEmail] = useState('')

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'contacts'))
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setContacts(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setLinkEmail('')
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

  const startEdit = (c) => {
    setEditingId(c.id)
    setLinkEmail((c.email || '').toLowerCase())
    setForm({
      name: c.name || '',
      email: c.email || '',
      type: c.type || 'prospect',
      region: c.region || 'North America',
      tags: Array.isArray(c.tags) ? c.tags.join(', ') : c.tags || '',
      stage: c.stage || 'prospect',
      notes: c.notes || '',
      followUpDate: c.followUpDate || '',
      attachmentLines: attachmentsToFormLines(c.attachments),
    })
    setOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      type: form.type,
      region: form.region,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      stage: form.stage,
      notes: form.notes.trim(),
      followUpDate: form.followUpDate || '',
      attachments: formLinesToAttachments(form.attachmentLines),
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, 'contacts', editingId), payload)
      } else {
        await addDoc(collection(db, 'contacts'), {
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
    if (!confirm('Delete this contact?')) return
    await deleteDoc(doc(db, 'contacts', id))
    if (editingId === id) {
      setOpen(false)
      resetForm()
    }
    load()
  }

  const visible =
    filter === 'all' ? contacts : contacts.filter((c) => c.type === filter)

  if (loading) return <p className="text-sm text-hae-slate">Loading contacts…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Contacts</h1>
          <p className="mt-1 text-sm text-hae-slate">
            Alumni, donors, partners, and prospects — type, region, tags, stage,
            links, and attachments
          </p>
        </div>
        <button type="button" className="hae-btn" onClick={openAdd}>
          Add contact
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All' },
          ...CONTACT_TYPES.map((t) => ({ id: t.value, label: t.label })),
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-semibold ${
              filter === f.id
                ? 'bg-hae-ink text-white'
                : 'border border-hae-line bg-white text-hae-slate'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Modal
        open={open}
        onClose={close}
        title={editingId ? 'Update contact' : 'Add contact'}
        busy={saving}
        size="lg"
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="contact-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update contact' : 'Add contact'}
            </button>
          </>
        }
      >
        <form id="contact-form" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => {
              setForm({ ...form, email: e.target.value })
              if (editingId) setLinkEmail(e.target.value.trim().toLowerCase())
            }}
            className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          >
            {CONTACT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          >
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={form.stage}
            onChange={(e) => setForm({ ...form, stage: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          >
            {PIPELINE_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            title="Follow-up date"
            value={form.followUpDate}
            onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Tags (comma-separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
          />
          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
          />
          <AttachmentField
            className="sm:col-span-2"
            value={form.attachmentLines}
            onChange={(attachmentLines) => setForm({ ...form, attachmentLines })}
          />
          {editingId && isEnabled(FEATURES.CRM_LINKING) ? (
            <div className="sm:col-span-2">
              <PersonLinks email={linkEmail || form.email} />
            </div>
          ) : null}
        </form>
      </Modal>

      <div className="overflow-x-auto border border-hae-line bg-white">
        <table className="w-full min-w-[800px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Contact</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Region</th>
              <th className="px-3 py-2 font-semibold">Stage</th>
              <th className="px-3 py-2 font-semibold">Tags</th>
              <th className="px-3 py-2 font-semibold">Follow-up</th>
              <th className="px-3 py-2 font-semibold w-28" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No contacts yet
                </td>
              </tr>
            ) : (
              visible.map((c) => (
                <tr key={c.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-hae-slate">{c.email || '—'}</div>
                    {c.notes ? (
                      <div className="mt-0.5 text-xs text-hae-slate">{c.notes}</div>
                    ) : null}
                    <AttachmentList attachments={c.attachments} />
                  </td>
                  <td className="px-3 py-2 text-sm capitalize text-hae-slate">
                    {c.type || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.region || '—'}</td>
                  <td className="px-3 py-2 text-sm capitalize text-hae-slate">
                    {c.stage || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {Array.isArray(c.tags) && c.tags.length
                      ? c.tags.join(', ')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {c.followUpDate || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="mr-2 font-semibold text-hae-crimson opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
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
