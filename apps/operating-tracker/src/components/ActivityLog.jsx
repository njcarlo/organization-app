import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
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

/** Read-only feed of a single task/project's edit·delete·comment history. */
export default function ActivityLog({ parentType, parentId }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!parentId) return
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, parentType, parentId, 'history'), orderBy('createdAt', 'desc'))
      )
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }, [parentType, parentId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
        Activity{entries.length ? ` (${entries.length})` : ''}
      </h4>
      {loading ? (
        <p className="text-xs text-hae-slate">Loading…</p>
      ) : entries.length ? (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id} className="rounded-md border border-hae-line/60 bg-hae-mist/20 p-2 text-xs">
              <p className="text-hae-ink">
                <span className="font-semibold">{e.byName || 'Someone'}</span>{' '}
                {describeAction(e.action)}
              </p>
              {e.action === 'updated' && e.changes?.length ? (
                <ul className="mt-1 space-y-0.5 text-hae-slate">
                  {e.changes.map((c) => (
                    <li key={c.field}>
                      <span className="font-medium text-hae-ink/80">{c.label}:</span>{' '}
                      {c.before} → {c.after}
                    </li>
                  ))}
                </ul>
              ) : null}
              {e.commentText ? (
                <p className="mt-1 text-hae-slate/90">“{e.commentText}”</p>
              ) : null}
              <p className="mt-1 text-[10px] text-hae-slate/70">{formatTimestamp(e.createdAt)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-hae-slate">No activity yet.</p>
      )}
    </div>
  )
}
