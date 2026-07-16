import { useEffect, useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import CommentsPanel from './CommentsPanel'
import { MEMBERSHIP_STATUS_OPTIONS } from '../constants'
import { formatDate, membershipStatusBadgeClass } from '../utils'

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
    <div className="grid grid-cols-[9rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0">
      <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">{label}</dt>
      <dd className="text-sm text-hae-ink break-words">{value}</dd>
    </div>
  )
}

function BadgeRow({ label, value, className }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0">
      <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">{label}</dt>
      <dd>
        <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${className}`}>
          {value}
        </span>
      </dd>
    </div>
  )
}

const leaderName = (leader) =>
  [leader.firstName, leader.lastName].filter(Boolean).join(' ') || 'Chapter leader'

/** Floating popup for a chapter leader row — record fields with edit/save/delete, plus comments. */
export default function ChapterLeaderDetailCard({ leader, chapterNames = [], onClose, onChanged, onDeleted }) {
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setError('')
    setEditing(false)
    setDraft(null)
  }, [leader.id])

  const startEdit = () => {
    setDraft({
      chapter: leader.chapter || '',
      firstName: leader.firstName || '',
      lastName: leader.lastName || '',
      position: leader.position || '',
      email: leader.email || '',
      membershipStatus: leader.membershipStatus || MEMBERSHIP_STATUS_OPTIONS[0],
      membershipExpiration: leader.membershipExpiration || '',
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    if (saving) return
    setEditing(false)
    setDraft(null)
  }

  const saveRecord = async () => {
    if (!draft?.firstName.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await updateDoc(doc(db, 'chapterLeaders', leader.id), {
        chapter: draft.chapter.trim(),
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        position: draft.position.trim(),
        email: draft.email.trim(),
        membershipStatus: draft.membershipStatus,
        membershipExpiration: draft.membershipExpiration,
      })
      setEditing(false)
      setDraft(null)
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to save chapter leader')
    } finally {
      setSaving(false)
    }
  }

  const removeLeader = async () => {
    if (!confirm(`Delete "${leaderName(leader)}"? This action cannot be undone.`)) return
    setError('')
    try {
      await deleteDoc(doc(db, 'chapterLeaders', leader.id))
      onDeleted?.()
    } catch (err) {
      setError(err.message || 'Failed to delete chapter leader')
    }
  }

  const handleClose = () => {
    if (saving) return
    setEditing(false)
    setDraft(null)
    onClose?.()
  }

  const rows = [
    { label: 'Chapter', value: leader.chapter || '—' },
    { label: 'First Name', value: leader.firstName || '—' },
    { label: 'Last Name', value: leader.lastName || '—' },
    { label: 'Chapter Position', value: leader.position || '—' },
    { label: 'Email', value: leader.email || '—' },
    {
      label: 'Membership Status',
      value: leader.membershipStatus || MEMBERSHIP_STATUS_OPTIONS[0],
      badge: membershipStatusBadgeClass(leader.membershipStatus),
    },
    {
      label: 'Membership Expiration',
      value: leader.membershipExpiration ? formatDate(leader.membershipExpiration) : '—',
    },
  ]

  return (
    <Modal
      open
      onClose={handleClose}
      title={editing ? `Editing · ${leaderName(leader)}` : leaderName(leader)}
      size={editing ? 'md' : 'lg'}
      busy={saving}
      footer={
        editing ? (
          <>
            <button type="button" className="hae-btn-secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="hae-btn disabled:opacity-60"
              onClick={saveRecord}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="hae-btn-secondary" onClick={removeLeader}>
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
          <Field label="Chapter">
            <select
              className={fieldClass}
              value={draft.chapter}
              onChange={(e) => setDraft({ ...draft, chapter: e.target.value })}
            >
              <option value="">Select chapter</option>
              {chapterNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chapter Position">
            <input
              className={fieldClass}
              value={draft.position}
              onChange={(e) => setDraft({ ...draft, position: e.target.value })}
            />
          </Field>
          <Field label="First Name">
            <input
              required
              className={fieldClass}
              value={draft.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
            />
          </Field>
          <Field label="Last Name">
            <input
              className={fieldClass}
              value={draft.lastName}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
            />
          </Field>
          <Field label="Email" className="sm:col-span-2">
            <input
              type="email"
              className={fieldClass}
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
          <Field label="Membership Status">
            <select
              className={fieldClass}
              value={draft.membershipStatus}
              onChange={(e) => setDraft({ ...draft, membershipStatus: e.target.value })}
            >
              {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Membership Expiration Date">
            <input
              type="date"
              className={fieldClass}
              value={draft.membershipExpiration}
              onChange={(e) => setDraft({ ...draft, membershipExpiration: e.target.value })}
            />
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
          </div>

          <div className="mt-4 border-t border-hae-line/60 pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <CommentsPanel
              parentType="chapterLeaders"
              parentId={leader.id}
              parentName={leaderName(leader)}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
