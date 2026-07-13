import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const emptyRow = { name: '', url: '', createdBy: '', lastEdit: '', filePath: '' }

const cellInputClass =
  'w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm outline-none focus:border-hae-crimson focus:bg-white'

function formatNow() {
  return new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Directly editable table of document rows (Name, Link, Who created, Last edit,
 * File Path) nested under a single Documents category item. Every cell is a live
 * input; pressing Enter in any cell saves that row, and pressing Enter in the
 * trailing blank row creates a new one and leaves a fresh blank row ready below it.
 */
export default function DocumentFilesTable({ programId }) {
  const { user, userProfile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newRow, setNewRow] = useState(emptyRow)
  const newNameRef = useRef(null)

  const byName = userProfile?.name || user?.email || 'Someone'

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, 'trackerDocumentFiles'))
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((f) => f.programId === programId)
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setRows(list)
    } catch (err) {
      setError(err.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const updateLocalRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const saveRow = async (row) => {
    setError('')
    try {
      await updateDoc(doc(db, 'trackerDocumentFiles', row.id), {
        name: row.name.trim(),
        url: row.url.trim(),
        createdBy: row.createdBy.trim(),
        lastEdit: row.lastEdit.trim(),
        filePath: row.filePath.trim(),
      })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save document')
    }
  }

  const removeRow = async (id) => {
    if (!confirm('Delete this document row?')) return
    setError('')
    try {
      await deleteDoc(doc(db, 'trackerDocumentFiles', id))
      await load()
    } catch (err) {
      setError(err.message || 'Failed to delete document')
    }
  }

  const commitNewRow = async () => {
    if (!newRow.name.trim()) return
    setError('')
    try {
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0)
      await addDoc(collection(db, 'trackerDocumentFiles'), {
        name: newRow.name.trim(),
        url: newRow.url.trim(),
        createdBy: newRow.createdBy.trim() || byName,
        lastEdit: newRow.lastEdit.trim() || formatNow(),
        filePath: newRow.filePath.trim(),
        programId,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setNewRow(emptyRow)
      await load()
      newNameRef.current?.focus()
    } catch (err) {
      setError(err.message || 'Failed to add document')
    }
  }

  const onEnterSaveRow = (e, row) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    saveRow(row)
  }

  const onEnterCommitNewRow = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    commitNewRow()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading documents…</p>

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-hae-red">{error}</p>}
      <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
        <table className="w-full min-w-[820px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Name of Document</th>
              <th className="px-3 py-2 font-semibold">Link to Document</th>
              <th className="px-3 py-2 font-semibold">Who Created</th>
              <th className="px-3 py-2 font-semibold">Last Edit</th>
              <th className="px-3 py-2 font-semibold">File Path</th>
              <th className="px-3 py-2 font-semibold w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="group border-b border-hae-line/70">
                <td className="px-1 py-1">
                  <input
                    className={cellInputClass}
                    value={row.name}
                    onChange={(e) => updateLocalRow(row.id, 'name', e.target.value)}
                    onKeyDown={(e) => onEnterSaveRow(e, row)}
                  />
                </td>
                <td className="px-1 py-1">
                  <div className="flex items-center gap-1">
                    <input
                      className={cellInputClass}
                      value={row.url}
                      onChange={(e) => updateLocalRow(row.id, 'url', e.target.value)}
                      onKeyDown={(e) => onEnterSaveRow(e, row)}
                    />
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        title="Open link"
                        className="shrink-0 px-1 text-hae-crimson hover:underline"
                      >
                        ↗
                      </a>
                    ) : null}
                  </div>
                </td>
                <td className="px-1 py-1">
                  <input
                    className={cellInputClass}
                    value={row.createdBy}
                    onChange={(e) => updateLocalRow(row.id, 'createdBy', e.target.value)}
                    onKeyDown={(e) => onEnterSaveRow(e, row)}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className={cellInputClass}
                    value={row.lastEdit}
                    onChange={(e) => updateLocalRow(row.id, 'lastEdit', e.target.value)}
                    onKeyDown={(e) => onEnterSaveRow(e, row)}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className={cellInputClass}
                    value={row.filePath}
                    onChange={(e) => updateLocalRow(row.id, 'filePath', e.target.value)}
                    onKeyDown={(e) => onEnterSaveRow(e, row)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="text-xs text-hae-slate opacity-100 hover:text-hae-red sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-b border-hae-line/70">
              <td className="px-1 py-1">
                <input
                  ref={newNameRef}
                  placeholder="Name of document"
                  className={cellInputClass}
                  value={newRow.name}
                  onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                  onKeyDown={onEnterCommitNewRow}
                />
              </td>
              <td className="px-1 py-1">
                <input
                  placeholder="Link to document"
                  className={cellInputClass}
                  value={newRow.url}
                  onChange={(e) => setNewRow({ ...newRow, url: e.target.value })}
                  onKeyDown={onEnterCommitNewRow}
                />
              </td>
              <td className="px-1 py-1">
                <input
                  placeholder={byName}
                  className={cellInputClass}
                  value={newRow.createdBy}
                  onChange={(e) => setNewRow({ ...newRow, createdBy: e.target.value })}
                  onKeyDown={onEnterCommitNewRow}
                />
              </td>
              <td className="px-1 py-1">
                <input
                  placeholder="Today"
                  className={cellInputClass}
                  value={newRow.lastEdit}
                  onChange={(e) => setNewRow({ ...newRow, lastEdit: e.target.value })}
                  onKeyDown={onEnterCommitNewRow}
                />
              </td>
              <td className="px-1 py-1">
                <input
                  placeholder="File path"
                  className={cellInputClass}
                  value={newRow.filePath}
                  onChange={(e) => setNewRow({ ...newRow, filePath: e.target.value })}
                  onKeyDown={onEnterCommitNewRow}
                />
              </td>
              <td className="px-3 py-2" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
