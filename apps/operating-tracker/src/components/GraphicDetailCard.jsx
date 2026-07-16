import { useEffect, useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import LeadSelect from './LeadSelect'
import CommentsPanel from './CommentsPanel'
import { GRAPHICS_STATUS_OPTIONS, WHERE_TO_POST_OPTIONS } from '../constants'
import { formatDate, graphicsStatusBadgeClass, namesLabel, toNameList } from '../utils'

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-hae-slate/80 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

function Row({ label, value }) {
  if (value == null) return null
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">{label}</dt>
      <dd className="text-sm text-hae-ink break-words">{value}</dd>
    </div>
  )
}

function BadgeRow({ label, value, className }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">{label}</dt>
      <dd>
        <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${className}`}>
          {value}
        </span>
      </dd>
    </div>
  )
}

/** Floating popup for a graphic — record fields with inline edit/save/delete, plus where to post, caption, tagging, and comments. */
export default function GraphicDetailCard({ graphic, onClose, onChanged, onDeleted }) {
  const [caption, setCaption] = useState(graphic.caption || '')
  const [whoToTag, setWhoToTag] = useState(graphic.whoToTag || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [savingRecord, setSavingRecord] = useState(false)

  useEffect(() => {
    setCaption(graphic.caption || '')
    setWhoToTag(graphic.whoToTag || '')
    setError('')
    setEditing(false)
    setDraft(null)
  }, [graphic.id])

  const wherePosted = Array.isArray(graphic.whereToPost) ? graphic.whereToPost : []

  const toggleWhereToPost = async (option) => {
    const next = wherePosted.includes(option)
      ? wherePosted.filter((o) => o !== option)
      : [...wherePosted, option]
    setError('')
    try {
      await updateDoc(doc(db, 'trackerGraphicsRequests', graphic.id), { whereToPost: next })
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to update where to post')
    }
  }

  const hasChanges = caption !== (graphic.caption || '') || whoToTag !== (graphic.whoToTag || '')

  const saveDetails = async () => {
    if (!hasChanges || saving) return
    setSaving(true)
    setError('')
    try {
      await updateDoc(doc(db, 'trackerGraphicsRequests', graphic.id), {
        caption: caption.trim(),
        whoToTag: whoToTag.trim(),
      })
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to save graphic details')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = () => {
    setDraft({
      eventOrProgram: graphic.eventOrProgram || '',
      title: graphic.title || '',
      url: graphic.url || '',
      lead: toNameList(graphic.lead),
      dateNeeded: graphic.dateNeeded || '',
      status: graphic.status || GRAPHICS_STATUS_OPTIONS[0],
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    if (savingRecord) return
    setEditing(false)
    setDraft(null)
  }

  const saveRecord = async () => {
    if (!draft?.title.trim() || savingRecord) return
    setSavingRecord(true)
    setError('')
    try {
      await updateDoc(doc(db, 'trackerGraphicsRequests', graphic.id), {
        eventOrProgram: draft.eventOrProgram.trim(),
        title: draft.title.trim(),
        url: draft.url.trim(),
        lead: draft.lead,
        dateNeeded: draft.dateNeeded,
        status: draft.status,
      })
      setEditing(false)
      setDraft(null)
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to save graphic')
    } finally {
      setSavingRecord(false)
    }
  }

  const removeGraphic = async () => {
    if (!confirm('Delete this graphic row? This action cannot be undone.')) return
    setError('')
    try {
      await deleteDoc(doc(db, 'trackerGraphicsRequests', graphic.id))
      onDeleted?.()
    } catch (err) {
      setError(err.message || 'Failed to delete graphic')
    }
  }

  const handleClose = () => {
    if (savingRecord) return
    setEditing(false)
    setDraft(null)
    onClose?.()
  }

  const rows = [
    {
      label: 'Status',
      value: graphic.status || GRAPHICS_STATUS_OPTIONS[0],
      badge: graphicsStatusBadgeClass(graphic.status),
    },
    { label: 'Event or Program', value: graphic.eventOrProgram || '—' },
    {
      label: 'Link',
      value: graphic.url ? (
        <a href={graphic.url} target="_blank" rel="noreferrer" className="text-hae-crimson hover:underline">
          Open ↗
        </a>
      ) : (
        '—'
      ),
    },
    { label: 'HAE Lead', value: namesLabel(graphic.lead) || '—' },
    { label: 'Date Needed', value: graphic.dateNeeded ? formatDate(graphic.dateNeeded) : '—' },
  ]

  return (
    <Modal
      open
      onClose={handleClose}
      title={editing ? `Editing · ${graphic.title || 'Untitled graphic'}` : graphic.title || 'Untitled graphic'}
      size={editing ? 'md' : 'xl'}
      busy={savingRecord}
      footer={
        editing ? (
          <>
            <button type="button" className="hae-btn-secondary" onClick={cancelEdit} disabled={savingRecord}>
              Cancel
            </button>
            <button
              type="button"
              className="hae-btn disabled:opacity-60"
              onClick={saveRecord}
              disabled={savingRecord}
            >
              {savingRecord ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="hae-btn-secondary" onClick={removeGraphic}>
              Delete
            </button>
            <button type="button" className="hae-btn-secondary" onClick={startEdit}>
              Edit
            </button>
            <button type="button" className="hae-btn-secondary" onClick={handleClose}>
              Close
            </button>
          </>
        )
      }
    >
      {editing && draft ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Graphic Title" className="sm:col-span-2">
            <input
              autoFocus
              className={fieldClass}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field label="Event or Program">
            <input
              className={fieldClass}
              value={draft.eventOrProgram}
              onChange={(e) => setDraft({ ...draft, eventOrProgram: e.target.value })}
            />
          </Field>
          <Field label="Link">
            <input
              className={fieldClass}
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          </Field>
          <Field label="HAE Lead">
            <LeadSelect
              className={fieldClass}
              value={draft.lead}
              onChange={(lead) => setDraft({ ...draft, lead })}
            />
          </Field>
          <Field label="Date Needed">
            <input
              type="date"
              className={fieldClass}
              value={draft.dateNeeded}
              onChange={(e) => setDraft({ ...draft, dateNeeded: e.target.value })}
            />
          </Field>
          <Field label="Status" className="sm:col-span-2">
            <select
              className={fieldClass}
              value={draft.status}
              onChange={(e) => {
                const status = e.target.value
                const lead =
                  status === 'For Approval by Regina' && !draft.lead.includes('Regina')
                    ? [...draft.lead, 'Regina']
                    : draft.lead
                setDraft({ ...draft, status, lead })
              }}
            >
              {GRAPHICS_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {error && <p className="text-sm text-hae-red">{error}</p>}

            <dl className="-my-1">
              {rows.map((row) =>
                row.badge ? (
                  <BadgeRow key={row.label} label={row.label} value={row.value} className={row.badge} />
                ) : (
                  <Row key={row.label} label={row.label} value={row.value} />
                )
              )}
            </dl>

            <div className="border-t border-hae-line/60 pt-4">
              <h4 className="mb-2 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
                Where to post?
              </h4>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {WHERE_TO_POST_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-hae-ink">
                    <input
                      type="checkbox"
                      checked={wherePosted.includes(option)}
                      onChange={() => toggleWhereToPost(option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold tracking-wider text-hae-slate uppercase">Caption</span>
              <textarea
                rows={3}
                className={fieldClass}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold tracking-wider text-hae-slate uppercase">Who to tag</span>
              <input className={fieldClass} value={whoToTag} onChange={(e) => setWhoToTag(e.target.value)} />
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                className="hae-btn disabled:opacity-60"
                onClick={saveDetails}
                disabled={!hasChanges || saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-hae-line/60 pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <CommentsPanel
              parentType="trackerGraphicsRequests"
              parentId={graphic.id}
              parentName={graphic.title}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
