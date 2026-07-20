import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { sendMentionEmail } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useStaffUsers } from '../hooks/useStaffUsers'
import { logHistory } from '../utils/activityLog'

function mentionDeepLink({ parentType, parentId, programId }) {
  if (parentType === 'projects' && programId) {
    return `https://tracker-hae.web.app/programs/${programId}`
  }
  if (parentId) {
    return `https://tracker-hae.web.app/my-tasks?task=${encodeURIComponent(parentId)}`
  }
  return 'https://tracker-hae.web.app/notifications'
}

function formatTimestamp(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g

function linkifySegment(text, keyPrefix) {
  const parts = String(text).split(URL_PATTERN)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={`${keyPrefix}-${i}`}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="text-hae-crimson hover:underline"
      >
        {part}
      </a>
    ) : (
      part
    )
  )
}

function renderTextWithMentions(text, users) {
  const names = users.map((u) => u.name).filter(Boolean)
  if (!names.length) return text
  const pattern = new RegExp(`(@(?:${names.map(escapeRegExp).join('|')}))(?!\\w)`, 'g')
  return text
    .split(pattern)
    .map((part, i) =>
      part.startsWith('@') && names.includes(part.slice(1)) ? (
        <span key={i} className="font-semibold text-hae-crimson">
          {part}
        </span>
      ) : (
        <span key={i}>{linkifySegment(part, i)}</span>
      )
    )
}

/** Comments + @mention thread for a task or project doc (Monday.com-style updates). */
export default function CommentsPanel({ parentType, parentId, parentName, programId }) {
  const { user, userProfile } = useAuth()
  const users = useStaffUsers()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [mentioned, setMentioned] = useState([])
  const [mentionQuery, setMentionQuery] = useState(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const textareaRef = useRef(null)
  const authorName = userProfile?.name || user?.email || 'Someone'

  useEffect(() => {
    if (!parentId) return
    let cancelled = false
    setLoading(true)
    getDocs(query(collection(db, parentType, parentId, 'comments'), orderBy('createdAt', 'asc')))
      .then((snap) => {
        if (cancelled) return
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [parentType, parentId])

  const mentionMatches = useMemo(() => {
    if (mentionQuery == null) return []
    const q = mentionQuery.toLowerCase()
    return users.filter((u) => u.name && u.name.toLowerCase().includes(q)).slice(0, 6)
  }, [mentionQuery, users])

  const handleChange = (e) => {
    const value = e.target.value
    setText(value)
    const upToCaret = value.slice(0, e.target.selectionStart)
    const match = upToCaret.match(/@([^\s@]*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  const pickMention = (u) => {
    const caret = textareaRef.current?.selectionStart ?? text.length
    const upToCaret = text.slice(0, caret)
    const rest = text.slice(caret)
    const insertedUpToCaret = upToCaret.replace(/@([^\s@]*)$/, `@${u.name} `)
    const nextText = insertedUpToCaret + rest
    const nextCaret = insertedUpToCaret.length
    setText(nextText)
    setMentioned((prev) => (prev.some((m) => m.id === u.id) ? prev : [...prev, { id: u.id, name: u.name }]))
    setMentionQuery(null)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const post = async () => {
    const trimmed = text.trim()
    if (!trimmed || posting) return
    setPosting(true)
    setError(null)
    try {
      const mentionedPeople = mentioned.filter((m) => trimmed.includes(`@${m.name}`))
      const mentionedIds = mentionedPeople.map((m) => m.id)
      await addDoc(collection(db, parentType, parentId, 'comments'), {
        text: trimmed,
        authorId: user?.uid || null,
        authorName,
        mentionedUserIds: mentionedIds,
        createdAt: serverTimestamp(),
      })
      const notifyTargets = mentionedPeople.filter((m) => m.id !== user?.uid)
      const link = mentionDeepLink({ parentType, parentId, programId })
      await Promise.all(
        notifyTargets.map((m) => {
          const profile = users.find((u) => u.id === m.id)
          const toEmail = (profile?.email || '').toLowerCase() || null
          return Promise.all([
            addDoc(collection(db, 'notifications'), {
              userId: m.id,
              userEmail: toEmail,
              type: 'mention',
              parentType,
              parentId,
              parentName: parentName || '',
              programId: programId || null,
              commentText: trimmed,
              fromName: authorName,
              read: false,
              emailRequested: true,
              createdAt: serverTimestamp(),
            }),
            sendMentionEmail({
              toEmail,
              toName: m.name,
              fromName: authorName,
              parentName,
              commentText: trimmed,
              link,
            }),
          ])
        })
      )

      setText('')
      setMentioned([])
      setMentionQuery(null)
      const snap = await getDocs(
        query(collection(db, parentType, parentId, 'comments'), orderBy('createdAt', 'asc'))
      )
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      logHistory({
        parentType,
        parentId,
        parentName,
        programId,
        action: 'comment_added',
        commentText: trimmed,
        byId: user?.uid,
        byName: authorName,
      })
    } catch (err) {
      setError(err?.code === 'permission-denied' ? 'Not allowed to post here.' : 'Failed to post comment.')
      console.error('Comment post failed', err)
    } finally {
      setPosting(false)
    }
  }

  const startEditComment = (c) => {
    setEditingCommentId(c.id)
    setEditText(c.text)
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditText('')
  }

  const saveEditComment = async (c) => {
    const trimmed = editText.trim()
    if (!trimmed || editSaving) return
    setEditSaving(true)
    try {
      await updateDoc(doc(db, parentType, parentId, 'comments', c.id), {
        text: trimmed,
        editedAt: serverTimestamp(),
      })
      setComments((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, text: trimmed, editedAt: true } : x))
      )
      setEditingCommentId(null)
      setEditText('')
      logHistory({
        parentType,
        parentId,
        parentName,
        programId,
        action: 'comment_edited',
        commentText: trimmed,
        byId: user?.uid,
        byName: authorName,
      })
    } finally {
      setEditSaving(false)
    }
  }

  const deleteComment = async (c) => {
    if (!confirm('Delete this comment? This action cannot be undone.')) return
    await deleteDoc(doc(db, parentType, parentId, 'comments', c.id))
    setComments((prev) => prev.filter((x) => x.id !== c.id))
    logHistory({
      parentType,
      parentId,
      parentName,
      programId,
      action: 'comment_deleted',
      commentText: c.text,
      byId: user?.uid,
      byName: authorName,
    })
  }

  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
        Comments{comments.length ? ` (${comments.length})` : ''}
      </h4>
      {loading ? (
        <p className="text-xs text-hae-slate">Loading…</p>
      ) : comments.length ? (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {comments.map((c) => {
            const isOwn = Boolean(c.authorId) && c.authorId === user?.uid
            const isEditing = editingCommentId === c.id
            return (
              <li key={c.id} className="rounded-md border border-hae-line/60 bg-hae-mist/20 p-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-hae-ink">
                    {c.authorName || 'Someone'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-hae-slate/70">
                      {formatTimestamp(c.createdAt)}
                    </span>
                    {isOwn && !isEditing ? (
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="text-[10px] font-medium text-hae-slate hover:text-hae-crimson"
                          onClick={() => startEditComment(c)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-medium text-hae-slate hover:text-hae-red"
                          onClick={() => deleteComment(c)}
                        >
                          Delete
                        </button>
                      </span>
                    ) : null}
                  </div>
                </div>
                {isEditing ? (
                  <div className="mt-1">
                    <textarea
                      autoFocus
                      className="w-full rounded-md border border-hae-line bg-white px-2 py-1.5 text-sm outline-none focus:border-hae-crimson"
                      rows={2}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') cancelEditComment()
                      }}
                    />
                    <div className="mt-1 flex justify-end gap-2">
                      <button
                        type="button"
                        className="text-xs text-hae-slate hover:text-hae-ink"
                        onClick={cancelEditComment}
                        disabled={editSaving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-hae-crimson disabled:opacity-60"
                        onClick={() => saveEditComment(c)}
                        disabled={editSaving || !editText.trim()}
                      >
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-hae-ink">
                    {renderTextWithMentions(c.text, users)}
                    {c.editedAt ? (
                      <span className="ml-1 text-[10px] text-hae-slate/60">(edited)</span>
                    ) : null}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-hae-slate">No comments yet.</p>
      )}
      <div className="relative">
        <div className="relative rounded-md border border-hae-line bg-white focus-within:border-hae-crimson">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2 text-sm text-hae-ink"
          >
            {renderTextWithMentions(text, users)}
            {text.endsWith('\n') ? '​' : null}
          </div>
          <textarea
            ref={textareaRef}
            className="relative w-full resize-none bg-transparent px-3 py-2 text-sm text-transparent caret-hae-ink outline-none placeholder:text-hae-slate"
            rows={2}
            placeholder="Leave a comment… use @ to tag someone"
            value={text}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && mentionMatches.length === 0) {
                e.preventDefault()
                post()
              }
            }}
          />
        </div>
        {mentionQuery != null && mentionMatches.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full max-w-xs rounded-md border border-hae-line bg-white shadow-lg">
            {mentionMatches.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-hae-mist"
                  onClick={() => pickMention(u)}
                >
                  {u.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="mt-1 text-xs text-hae-red">{error}</p> : null}
        {mentioned.length > 0 ? (
          <p className="mt-2 text-xs text-hae-slate">Mentioned people will be emailed automatically.</p>
        ) : null}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="hae-btn disabled:opacity-60"
            disabled={posting || !text.trim()}
            onClick={post}
          >
            {posting ? 'Posting…' : 'Comment'}
          </button>
        </div>
      </div>
    </div>
  )
}
