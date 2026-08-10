import { useEffect, useState } from 'react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import CommentsPanel from './CommentsPanel'
import ActivityLog from './ActivityLog'
import { SOCIAL_GRAPHICS_STATUS_OPTIONS, SOCIAL_POST_STATUS_OPTIONS } from '../constants'
import { formatDate, socialGraphicsStatusBadgeClass, socialPostStatusBadgeClass } from '../utils'
import { diffSocialPostFields, logHistory } from '../utils/activityLog'

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

function emptyDraftFrom(post) {
  return {
    creative: post.creative || '',
    status: post.status || SOCIAL_POST_STATUS_OPTIONS[0].value,
    dateOfPosting: post.dateOfPosting || '',
    graphicsStatus: post.graphicsStatus || SOCIAL_GRAPHICS_STATUS_OPTIONS[0].value,
    fileUrl: post.fileUrl || '',
    hashtags: post.hashtags || '',
    linkedinGroups: post.linkedinGroups || '',
    peopleToTag: post.peopleToTag || '',
  }
}

/** Floating detail card for a social media post — inline edit/save/delete, plus comments and activity log. */
export default function SocialPostDetailCard({ post, onClose, onChanged, onDeleted }) {
  const { user, userProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const authorName = userProfile?.name || user?.email || 'Someone'

  useEffect(() => {
    setEditing(false)
    setDraft(null)
    setError('')
  }, [post.id])

  const startEdit = () => {
    setDraft(emptyDraftFrom(post))
    setEditing(true)
  }

  const cancelEdit = () => {
    if (saving) return
    setEditing(false)
    setDraft(null)
  }

  const saveRecord = async () => {
    if (!draft?.creative.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        creative: draft.creative.trim(),
        status: draft.status,
        dateOfPosting: draft.dateOfPosting,
        graphicsStatus: draft.graphicsStatus,
        fileUrl: draft.fileUrl.trim(),
        hashtags: draft.hashtags.trim(),
        linkedinGroups: draft.linkedinGroups.trim(),
        peopleToTag: draft.peopleToTag.trim(),
      }
      await updateDoc(doc(db, 'socialMediaPosts', post.id), payload)
      const changes = diffSocialPostFields(post, { ...post, ...payload })
      if (changes.length) {
        logHistory({
          parentType: 'socialMediaPosts',
          parentId: post.id,
          parentName: payload.creative,
          action: 'updated',
          changes,
          byId: user?.uid,
          byName: authorName,
        })
      }
      setEditing(false)
      setDraft(null)
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  const removePost = async () => {
    if (!confirm('Delete this post? This action cannot be undone.')) return
    setError('')
    try {
      await deleteDoc(doc(db, 'socialMediaPosts', post.id))
      onDeleted?.()
    } catch (err) {
      setError(err.message || 'Failed to delete post')
    }
  }

  const handleClose = () => {
    if (saving) return
    setEditing(false)
    setDraft(null)
    onClose?.()
  }

  const rows = [
    {
      label: 'Status',
      value: post.status || SOCIAL_POST_STATUS_OPTIONS[0].value,
      badge: socialPostStatusBadgeClass(post.status),
    },
    { label: 'Date of Posting', value: post.dateOfPosting ? formatDate(post.dateOfPosting) : '—' },
    {
      label: 'Graphics Status',
      value: post.graphicsStatus || SOCIAL_GRAPHICS_STATUS_OPTIONS[0].value,
      badge: socialGraphicsStatusBadgeClass(post.graphicsStatus),
    },
    {
      label: 'File',
      value: post.fileUrl ? (
        <a href={post.fileUrl} target="_blank" rel="noreferrer" className="text-hae-crimson hover:underline">
          Open ↗
        </a>
      ) : (
        '—'
      ),
    },
    { label: 'Hashtags', value: post.hashtags || '—' },
    { label: 'LinkedIn Groups', value: post.linkedinGroups || '—' },
    { label: 'People to Tag', value: post.peopleToTag || '—' },
  ]

  return (
    <Modal
      open
      onClose={handleClose}
      title={editing ? `Editing · ${post.creative || 'Untitled post'}` : post.creative || 'Untitled post'}
      size={editing ? 'md' : 'xl'}
      busy={saving}
      footer={
        editing ? (
          <>
            <button type="button" className="hae-btn-secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="hae-btn disabled:opacity-60" onClick={saveRecord} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="hae-btn-secondary" onClick={removePost}>
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
          {error && <p className="text-sm text-hae-red sm:col-span-2">{error}</p>}
          <Field label="Creative" className="sm:col-span-2">
            <input
              autoFocus
              className={fieldClass}
              value={draft.creative}
              onChange={(e) => setDraft({ ...draft, creative: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className={fieldClass}
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              {SOCIAL_POST_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date of Posting">
            <input
              type="date"
              className={fieldClass}
              value={draft.dateOfPosting}
              onChange={(e) => setDraft({ ...draft, dateOfPosting: e.target.value })}
            />
          </Field>
          <Field label="Graphics Status">
            <select
              className={fieldClass}
              value={draft.graphicsStatus}
              onChange={(e) => setDraft({ ...draft, graphicsStatus: e.target.value })}
            >
              {SOCIAL_GRAPHICS_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="File link">
            <input
              className={fieldClass}
              value={draft.fileUrl}
              onChange={(e) => setDraft({ ...draft, fileUrl: e.target.value })}
              placeholder="Google Drive / Dropbox link"
            />
          </Field>
          <Field label="Hashtags">
            <input
              className={fieldClass}
              value={draft.hashtags}
              onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })}
              placeholder="#hae #entrepreneurship"
            />
          </Field>
          <Field label="LinkedIn Groups">
            <input
              className={fieldClass}
              value={draft.linkedinGroups}
              onChange={(e) => setDraft({ ...draft, linkedinGroups: e.target.value })}
            />
          </Field>
          <Field label="People to Tag" className="sm:col-span-2">
            <input
              className={fieldClass}
              value={draft.peopleToTag}
              onChange={(e) => setDraft({ ...draft, peopleToTag: e.target.value })}
              placeholder="@person, @company"
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

          <div className="mt-4 space-y-4 border-t border-hae-line/60 pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <CommentsPanel parentType="socialMediaPosts" parentId={post.id} parentName={post.creative} />
            <div className="border-t border-hae-line/60 pt-4">
              <ActivityLog parentType="socialMediaPosts" parentId={post.id} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
