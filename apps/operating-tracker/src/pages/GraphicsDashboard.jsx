import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import LeadSelect from '../components/LeadSelect'
import GraphicDetailCard from '../components/GraphicDetailCard'
import { GRAPHICS_STATUS_OPTIONS } from '../constants'
import { formatDate, graphicsStatusBadgeClass, namesLabel } from '../utils'

const emptyForm = {
  eventOrProgram: '',
  title: '',
  url: '',
  lead: [],
  dateNeeded: '',
  status: GRAPHICS_STATUS_OPTIONS[0],
}

/**
 * Graphics dashboard — Event/Program, Graphic Title, Link, HAE Lead, Date Needed,
 * Status at a glance. Add via modal. Click a row to expand its floating card,
 * which owns Edit/Save/Delete plus where-to-post, caption, tagging, and comments.
 */
export default function GraphicsDashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [modal, setModal] = useState(null) // { form }
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, 'trackerGraphicsRequests'))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setRows(list)
    } catch (err) {
      setError(err.message || 'Failed to load graphics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => setModal({ form: emptyForm })

  const closeModal = () => {
    if (saving) return
    setModal(null)
  }

  const submitModal = async (e) => {
    e.preventDefault()
    if (!modal?.form.title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const { form } = modal
      const data = {
        eventOrProgram: form.eventOrProgram.trim(),
        title: form.title.trim(),
        url: form.url.trim(),
        lead: form.lead,
        dateNeeded: form.dateNeeded,
        status: form.status,
      }
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0)
      await addDoc(collection(db, 'trackerGraphicsRequests'), {
        ...data,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save graphic')
    } finally {
      setSaving(false)
    }
  }

  const toggleExpanded = (id) => {
    setExpandedId((cur) => (cur === id ? null : id))
  }

  const expandedRow = rows.find((r) => r.id === expandedId) || null

  if (loading) return <p className="text-sm text-hae-slate">Loading graphics dashboard…</p>

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hae-line pb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
            Harvard Alumni Entrepreneurs
          </p>
          <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
            Graphics Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-hae-slate">
            Every graphic request at a glance — click a row to expand its posting details and
            comments.
          </p>
        </div>
        <button type="button" className="hae-btn" onClick={openAdd}>
          + Add Graphics
        </button>
      </header>

      {error && <p className="text-sm text-hae-red">{error}</p>}

      <Modal
        open={!!modal}
        onClose={closeModal}
        title="Add graphic"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="graphic-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Create graphic'}
            </button>
          </>
        }
      >
        {modal ? (
          <form id="graphic-form" onSubmit={submitModal} className="grid gap-3 sm:grid-cols-2">
            {error && <p className="text-sm text-hae-red sm:col-span-2">{error}</p>}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Event or Program</span>
              <input
                value={modal.form.eventOrProgram}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, eventOrProgram: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Graphic Title</span>
              <input
                required
                value={modal.form.title}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, title: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-hae-slate">Link</span>
              <input
                value={modal.form.url}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, url: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">HAE Lead</span>
              <LeadSelect value={modal.form.lead} onChange={(lead) => setModal({ ...modal, form: { ...modal.form, lead } })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Date Needed</span>
              <input
                type="date"
                value={modal.form.dateNeeded}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, dateNeeded: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-hae-slate">Status</span>
              <select
                value={modal.form.status}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, status: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                {GRAPHICS_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </form>
        ) : null}
      </Modal>

      <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
        <table className="w-full min-w-[960px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Event or Program</th>
              <th className="px-3 py-2 font-semibold">Graphic Title</th>
              <th className="px-3 py-2 font-semibold">Link</th>
              <th className="px-3 py-2 font-semibold">HAE Lead</th>
              <th className="px-3 py-2 font-semibold">Date Needed</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No graphics yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => toggleExpanded(row.id)}
                  className={`cursor-pointer border-b border-hae-line/70 hover:bg-hae-mist/40 ${
                    expandedId === row.id ? 'bg-hae-mist/40' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-sm text-hae-ink">{row.eventOrProgram || '—'}</td>
                  <td className="px-3 py-2 text-sm font-medium text-hae-ink">{row.title}</td>
                  <td className="px-3 py-2 text-sm">
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-hae-crimson hover:underline"
                      >
                        Open ↗
                      </a>
                    ) : (
                      <span className="text-hae-slate">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{namesLabel(row.lead) || '—'}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {row.dateNeeded ? formatDate(row.dateNeeded) : '—'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${graphicsStatusBadgeClass(row.status)}`}
                    >
                      {row.status || GRAPHICS_STATUS_OPTIONS[0]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {expandedRow ? (
        <GraphicDetailCard
          graphic={expandedRow}
          onClose={() => setExpandedId(null)}
          onChanged={load}
          onDeleted={() => {
            setExpandedId(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
