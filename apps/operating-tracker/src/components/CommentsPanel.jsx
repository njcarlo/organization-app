import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useStaffUsers } from '../hooks/useStaffUsers'

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
        <span key={i}>{part}</span>
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
  const textareaRef = useRef(null)

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
    const nextText = upToCaret.replace(/@([^\s@]*)$/, `@${u.name} `) + rest
    setText(nextText)
    setMentioned((prev) => (prev.some((m) => m.id === u.id) ? prev : [...prev, { id: u.id, name: u.name }]))
    setMentionQuery(null)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const post = async () => {
    const trimmed = text.trim()
    if (!trimmed || posting) return
    setPosting(true)
    setError(null)
    try {
      const authorName = userProfile?.name || user?.email || 'Someone'
      const mentionedIds = mentioned
        .filter((m) => trimmed.includes(`@${m.name}`))
        .map((m) => m.id)
      await addDoc(collection(db, parentType, parentId, 'comments'), {
        text: trimmed,
        authorId: user?.uid || null,
        authorName,
        mentionedUserIds: mentionedIds,
        createdAt: serverTimestamp(),
      })
      await Promise.all(
        mentionedIds
          .filter((id) => id !== user?.uid)
          .map((id) =>
            addDoc(collection(db, 'notifications'), {
              userId: id,
              type: 'mention',
              parentType,
              parentId,
              parentName: parentName || '',
              programId: programId || null,
              commentText: trimmed,
              fromName: authorName,
              read: false,
              createdAt: serverTimestamp(),
            })
          )
      )
      setText('')
      setMentioned([])
      setMentionQuery(null)
      const snap = await getDocs(
        query(collection(db, parentType, parentId, 'comments'), orderBy('createdAt', 'asc'))
      )
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setError(err?.code === 'permission-denied' ? 'Not allowed to post here.' : 'Failed to post comment.')
      console.error('Comment post failed', err)
    } finally {
      setPosting(false)
    }
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
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border border-hae-line/60 bg-hae-mist/20 p-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-hae-ink">
                  {c.authorName || 'Someone'}
                </span>
                <span className="text-[10px] text-hae-slate/70">
                  {formatTimestamp(c.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap text-hae-ink">
                {renderTextWithMentions(c.text, users)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-hae-slate">No comments yet.</p>
      )}
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson"
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
