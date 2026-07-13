import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collectionGroup, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { describeAction } from '../utils/activityLog'

function formatTimestamp(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function entryHref(e) {
  if (e.parentType === 'projects') {
    return e.programId ? `/programs/${e.programId}` : null
  }
  if (e.parentType === 'tasks') {
    return `/my-tasks?task=${e.parentId}`
  }
  return null
}

/** Org-wide feed of task/project edits, deletes, and comment activity — for monitoring movements. */
export default function Activity() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDocs(query(collectionGroup(db, 'history'), orderBy('createdAt', 'desc'), limit(200)))
      .then((snap) => {
        if (cancelled) return
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      })
      .catch((err) => {
        console.error('Failed to load activity log', err)
        if (!cancelled) setError('Failed to load activity log.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <p className="text-sm text-hae-slate">
        Recent edits, deletes, and comments across tasks and projects.
      </p>

      {loading ? (
        <p className="text-sm text-hae-slate">Loading…</p>
      ) : error ? (
        <p className="text-sm text-hae-red">{error}</p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-hae-line bg-white p-6 text-sm text-hae-slate">
          No activity yet.
        </p>
      ) : (
        <ul className="divide-y divide-hae-line/70 rounded-xl border border-hae-line bg-white">
          {entries.map((e) => {
            const href = entryHref(e)
            const body = (
              <div className="px-4 py-3">
                <p className="text-sm text-hae-ink">
                  <span className="font-semibold">{e.byName || 'Someone'}</span>{' '}
                  {describeAction(e.action)}{' '}
                  {e.action !== 'deleted' ? (
                    <>
                      on{' '}
                      <span className="font-medium">
                        {e.parentName || (e.parentType === 'projects' ? 'a project' : 'a task')}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium">
                      {e.parentName || (e.parentType === 'projects' ? 'a project' : 'a task')}
                    </span>
                  )}
                </p>
                {e.action === 'updated' && e.changes?.length ? (
                  <ul className="mt-1 space-y-0.5 text-xs text-hae-slate">
                    {e.changes.map((c) => (
                      <li key={c.field}>
                        <span className="font-medium text-hae-ink/80">{c.label}:</span>{' '}
                        {c.before} → {c.after}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {e.commentText ? (
                  <p className="mt-1 text-xs text-hae-slate/90">“{e.commentText}”</p>
                ) : null}
                <p className="mt-1 text-[11px] text-hae-slate/70">{formatTimestamp(e.createdAt)}</p>
              </div>
            )
            return (
              <li key={`${e.parentType}-${e.parentId}-${e.id}`}>
                {href ? (
                  <Link to={href} className="block hover:bg-hae-mist/50">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
