import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { Modal, NavIcon } from '@hae/ui'
import { db } from '../firebase'
import { CATEGORY_META } from './Sidebar'

// Categories searched, plus the leaf-level work items (projects/tasks, which
// don't have their own route and link back to their parent program instead).
const SEARCH_COLLECTIONS = [...Object.keys(CATEGORY_META), 'projects', 'tasks']

const pathFor = (collectionName, item) => {
  if (collectionName === 'task' || collectionName === 'project') {
    return item.programId ? `/programs/${item.programId}` : null
  }
  if (collectionName === 'customSectionItems') {
    return item.sectionId ? `/custom-sections/${item.sectionId}/${item.id}` : null
  }
  const meta = CATEGORY_META[collectionName]
  return meta?.pathPrefix ? `${meta.pathPrefix}/${item.id}` : null
}

const labelFor = (collectionName) => {
  if (collectionName === 'task') return 'Task'
  if (collectionName === 'project') return 'Project'
  return CATEGORY_META[collectionName]?.label || 'Item'
}

const matches = (item, needle) => {
  const haystack = [item.name, item.notes, item.promise]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [records, setRecords] = useState([])
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        SEARCH_COLLECTIONS.map(async (collectionName) => {
          const snap = await getDocs(collection(db, collectionName))
          const kind =
            collectionName === 'projects'
              ? 'project'
              : collectionName === 'tasks'
                ? 'task'
                : collectionName
          return snap.docs.map((d) => ({ kind, id: d.id, ...d.data() }))
        })
      )
      setRecords(results.flat())
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !loaded && !loading) load()
  }, [open, loaded, loading, load])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
    setQ('')
    return undefined
  }, [open])

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    return records
      .filter((item) => matches(item, needle))
      .map((item) => ({ item, path: pathFor(item.kind, item) }))
      .filter((r) => r.path)
      .slice(0, 40)
  }, [records, q])

  const goTo = (path) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <>
      <button
        type="button"
        className="hae-platform-header__bell"
        aria-label="Search"
        title="Search"
        onClick={() => setOpen(true)}
      >
        <NavIcon name="search" className="[&>svg]:h-5 [&>svg]:w-5" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Search" size="lg">
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search programs, tasks, documents, events…"
          className="w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />

        <div className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto">
          {loading ? (
            <p className="px-1 py-6 text-center text-sm text-hae-slate">Loading…</p>
          ) : !q.trim() ? (
            <p className="px-1 py-6 text-center text-sm text-hae-slate">
              Start typing to search across the Tracker.
            </p>
          ) : results.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-hae-slate">No results.</p>
          ) : (
            results.map(({ item, path }) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() => goTo(path)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-hae-mist"
              >
                <span className="min-w-0 truncate text-sm font-medium text-hae-ink">
                  {item.name || 'Untitled'}
                </span>
                <span className="shrink-0 rounded-full bg-hae-mist px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-hae-slate">
                  {labelFor(item.kind)}
                </span>
              </button>
            ))
          )}
        </div>
      </Modal>
    </>
  )
}
