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
import { db } from '@hae/firebase'
import { useAuth } from './AuthContext.jsx'
import { useStaffUsers } from './useStaffUsers.js'

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

function buildMentionMailto({ emails, authorName, parentName, commentText, link }) {
  const subject = encodeURIComponent(`${authorName} mentioned you on ${parentName || 'HAE'}`)
  const body = encodeURIComponent(
    [
      `${authorName} mentioned you.`,
      '',
      `On: ${parentName || 'a record'}`,
      `Comment: "${commentText}"`,
      '',
      link ? `Open: ${link}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  )
  const bcc = emails.map(encodeURIComponent).join(',')
  return `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`
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

async function logCommentHistory({ parentType, parentId, parentName, action, commentText, byId, byName }) {
  try {
    await addDoc(collection(db, parentType, parentId, 'history'), {
      parentType,
      parentId,
      parentName: parentName || null,
      action,
      commentText,
      byId: byId || null,
      byName: byName || 'Someone',
      createdAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Failed to record history entry', err)
  }
}

/**
 * Comments + @mention thread for any record (Monday.com-style updates).
 * Writes to `{parentType}/{parentId}/comments` and `{parentType}/{parentId}/history`,
 * and creates a `notifications` doc per mentioned user (see functions/onMentionNotification.js).
 *
 * `deepLink` (optional): string URL used in the mailto fallback + email notification's link.
 */
export default function CommentsPanel({ parentType, parentId, parentName, deepLink }) {
  const { user, userProfile } = useAuth()
  const users = useStaffUsers()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [mentioned, setMentioned] = useState([])
  const [mentionQuery, setMentionQuery] = useState(null)
  const [emailMentions, setEmailMentions] = useState(true)
  const [lastMailto, setLastMailto] = useState(null)
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
      await Promise.all(
        notifyTargets.map((m) => {
          const profile = users.find((u) => u.id === m.id)
          return addDoc(collection(db, 'notifications'), {
            userId: m.id,
            userEmail: (profile?.email || '').toLowerCase() || null,
            type: 'mention',
            parentType,
            parentId,
            parentName: parentName || '',
            deepLink: deepLink || null,
            commentText: trimmed,
            fromName: authorName,
            read: false,
            emailRequested: emailMentions,
            createdAt: serverTimestamp(),
          })
        })
      )

      setText('')
      setMentioned([])
      setMentionQuery(null)
      if (emailMentions && notifyTargets.length > 0) {
        const emails = notifyTargets
          .map((m) => users.find((u) => u.id === m.id)?.email)
          .map((e) => String(e || '').trim().toLowerCase())
          .filter((e) => e.includes('@'))
        setLastMailto(
          emails.length
            ? buildMentionMailto({ emails, authorName, parentName, commentText: trimmed, link: deepLink })
            : null
        )
      } else {
        setLastMailto(null)
      }
      const snap = await getDocs(
        query(collection(db, parentType, parentId, 'comments'), orderBy('createdAt', 'asc'))
      )
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      logCommentHistory({
        parentType,
        parentId,
        parentName,
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
      logCommentHistory({
        parentType,
        parentId,
        parentName,
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
    logCommentHistory({
      parentType,
      parentId,
      parentName,
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
          <label className="mt-2 flex items-start gap-2 text-xs text-hae-slate">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={emailMentions}
              onChange={(e) => setEmailMentions(e.target.checked)}
            />
            <span>
              Email mentioned people (in-app notification always sends; automatic
              email needs Blaze + Resend — otherwise use the draft link after posting)
            </span>
          </label>
        ) : null}
        {lastMailto ? (
          <p className="mt-2 text-xs text-hae-slate">
            Mention saved.{' '}
            <a href={lastMailto} className="font-semibold text-hae-crimson hover:underline">
              Open email draft
            </a>{' '}
            to notify them from your mail app.
          </p>
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
