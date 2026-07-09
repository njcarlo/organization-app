import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { EXPERT_STATUSES, EXPERTISE_SUGGESTIONS } from '../constants'
import { useAuth } from '@hae/ui'

const emptyForm = {
  name: '',
  title: '',
  organization: '',
  email: '',
  bio: '',
  expertiseText: '',
  linkedinUrl: '',
  bookingUrl: '',
  photoUrl: '',
  status: 'Active',
}

function parseExpertise(text) {
  return text
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

export default function ManageExperts() {
  const { isAdmin } = useAuth()
  const [experts, setExperts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'experts'))
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setExperts(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startEdit = (expert) => {
    setEditingId(expert.id)
    setForm({
      name: expert.name || '',
      title: expert.title || '',
      organization: expert.organization || '',
      email: expert.email || '',
      bio: expert.bio || '',
      expertiseText: (expert.expertise || []).join(', '),
      linkedinUrl: expert.linkedinUrl || '',
      bookingUrl: expert.bookingUrl || '',
      photoUrl: expert.photoUrl || '',
      status: expert.status || 'Active',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      title: form.title.trim(),
      organization: form.organization.trim(),
      email: form.email.trim().toLowerCase(),
      bio: form.bio.trim(),
      expertise: parseExpertise(form.expertiseText),
      linkedinUrl: form.linkedinUrl.trim(),
      bookingUrl: form.bookingUrl.trim(),
      photoUrl: form.photoUrl.trim(),
      status: form.status,
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, 'experts', editingId), payload)
      } else {
        await addDoc(collection(db, 'experts'), {
          ...payload,
          createdAt: serverTimestamp(),
        })
      }
      cancelEdit()
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this expert profile?')) return
    await deleteDoc(doc(db, 'experts', id))
    if (editingId === id) cancelEdit()
    load()
  }

  const addSuggestion = (tag) => {
    const current = parseExpertise(form.expertiseText)
    if (current.includes(tag)) return
    setForm({
      ...form,
      expertiseText: [...current, tag].join(', '),
    })
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  if (!isAdmin) {
    return (
      <div className="border border-hae-line bg-white p-6 text-sm text-hae-slate">
        Only admins can add or edit expert profiles. Browse the{' '}
        <Link to="/directory" className="text-hae-crimson">
          Directory
        </Link>{' '}
        instead.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-hae-ink">Manage experts</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Add and update SME profiles dynamically. Structure follows the public
          Expert Office Hours directory as a reference — not a copy of live data.
        </p>
      </header>

      <form
        onSubmit={save}
        className="grid gap-3 border border-hae-line bg-white p-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2 text-xs font-semibold tracking-wider text-hae-slate uppercase">
          {editingId ? 'Edit expert' : 'Add expert'}
        </div>
        <input
          required
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          placeholder="Title / role"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          placeholder="Organization"
          value={form.organization}
          onChange={(e) => setForm({ ...form, organization: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          placeholder="LinkedIn URL"
          value={form.linkedinUrl}
          onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          placeholder="Booking URL (Calendly / Google Appointment)"
          value={form.bookingUrl}
          onChange={(e) => setForm({ ...form, bookingUrl: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <input
          placeholder="Photo URL"
          value={form.photoUrl}
          onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
        />
        <textarea
          placeholder="Bio"
          rows={4}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <input
            placeholder="Expertise tags (comma-separated)"
            value={form.expertiseText}
            onChange={(e) => setForm({ ...form, expertiseText: e.target.value })}
            className="w-full border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {EXPERTISE_SUGGESTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addSuggestion(tag)}
                className="border border-hae-line px-2 py-0.5 text-[10px] text-hae-slate hover:border-hae-crimson hover:text-hae-crimson"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="border border-hae-line px-3 py-2 text-sm"
        >
          {EXPERT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase disabled:opacity-60"
          >
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add expert'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="border border-hae-line px-3 py-2 text-sm text-hae-slate"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="border border-hae-line bg-white">
        <table className="w-full min-w-[800px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Expertise</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Booking</th>
              <th className="px-3 py-2 font-semibold w-28" />
            </tr>
          </thead>
          <tbody>
            {experts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No experts yet — add the first profile above
                </td>
              </tr>
            ) : (
              experts.map((e) => (
                <tr key={e.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{e.name}</div>
                    <div className="text-xs text-hae-slate">
                      {e.title || '—'}
                      {e.organization ? ` · ${e.organization}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-hae-slate">
                    {(e.expertise || []).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{e.status}</td>
                  <td className="px-3 py-2 text-sm">
                    {e.bookingUrl ? (
                      <a
                        href={e.bookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-hae-crimson hover:underline"
                      >
                        Link
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <button
                      type="button"
                      onClick={() => startEdit(e)}
                      className="mr-2 font-semibold text-hae-crimson"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      className="text-hae-slate hover:text-hae-red"
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
