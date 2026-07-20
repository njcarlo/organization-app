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
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const emptyRow = { name: '', url: '', createdBy: '', filePath: '', notes: '' }

const cellInputClass =
  'w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm outline-none focus:border-hae-crimson focus:bg-white'

/**
 * Link table nested under a single Documents & Assets group. Existing rows are
 * read-only in the table; clicking a row opens a modal to edit it. The trailing
 * blank row is directly editable — pressing Enter commits it and a fresh blank
 * row appears below.
 */
export default function DocumentLinksTable({ groupId, showNotes = false }) {
  const { user, userProfile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newRow, setNewRow] = useState(emptyRow)
  const [editRow, setEditRow] = useState(null)
  const [saving, setSaving] = useState(false)
  const newNameRef = useRef(null)

  const byName = userProfile?.name || user?.email || 'Someone'

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, 'trackerDocumentFiles'))
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((f) => f.groupId === groupId)
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setRows(list)
    } catch (err) {
      setError(err.message || 'Failed to load links')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const openEdit = (row) => setEditRow({ ...row })

  const closeEdit = () => {
    if (saving) return
    setEditRow(null)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editRow?.name.trim() || saving) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'trackerDocumentFiles', editRow.id), {
        name: editRow.name.trim(),
        url: editRow.url.trim(),
        createdBy: editRow.createdBy.trim(),
        filePath: editRow.filePath.trim(),
        notes: (editRow.notes || '').trim(),
      })
      setEditRow(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save link')
    } finally {
      setSaving(false)
    }
  }

  const removeEdit = async () => {
    if (!editRow) return
    if (!confirm('Delete this link? This action cannot be undone.')) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'trackerDocumentFiles', editRow.id))
      setEditRow(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to delete link')
    } finally {
      setSaving(false)
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
        filePath: newRow.filePath.trim(),
        notes: newRow.notes.trim(),
        groupId,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setNewRow(emptyRow)
      await load()
      newNameRef.current?.focus()
    } catch (err) {
      setError(err.message || 'Failed to add link')
    }
  }

  const onEnterCommitNewRow = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    commitNewRow()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading links…</p>

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-hae-red">{error}</p>}
      <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Name of Link</th>
              <th className="px-3 py-2 font-semibold">Link</th>
              <th className="px-3 py-2 font-semibold">Created by</th>
              <th className="px-3 py-2 font-semibold">File Path</th>
              {showNotes && <th className="px-3 py-2 font-semibold">Notes</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => openEdit(row)}
                className="cursor-pointer border-b border-hae-line/70 hover:bg-hae-mist/40"
              >
                <td className="px-3 py-2 text-sm font-medium text-hae-ink">{row.name || '—'}</td>
                <td className="px-3 py-2 text-sm text-hae-slate">
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-hae-crimson hover:underline"
                    >
                      {row.url}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-hae-slate">{row.createdBy || '—'}</td>
                <td className="px-3 py-2 text-sm text-hae-slate">{row.filePath || '—'}</td>
                {showNotes && (
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.notes || '—'}</td>
                )}
              </tr>
            ))}
            <tr className="border-b border-hae-line/70">
              <td className="px-1 py-1">
                <input
                  ref={newNameRef}
                  placeholder="Name of link"
                  className={cellInputClass}
                  value={newRow.name}
                  onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                  onKeyDown={onEnterCommitNewRow}
                />
              </td>
              <td className="px-1 py-1">
                <input
                  placeholder="Link"
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
                  placeholder="File path"
                  className={cellInputClass}
                  value={newRow.filePath}
                  onChange={(e) => setNewRow({ ...newRow, filePath: e.target.value })}
                  onKeyDown={onEnterCommitNewRow}
                />
              </td>
              {showNotes && (
                <td className="px-1 py-1">
                  <input
                    placeholder="Notes"
                    className={cellInputClass}
                    value={newRow.notes}
                    onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
                    onKeyDown={onEnterCommitNewRow}
                  />
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editRow}
        onClose={closeEdit}
        title="Edit link"
        busy={saving}
        footer={
          <>
            <button
              type="button"
              onClick={removeEdit}
              disabled={saving}
              className="mr-auto text-xs text-hae-slate hover:text-hae-red"
            >
              Delete
            </button>
            <button
              type="button"
              className="hae-btn-secondary"
              onClick={closeEdit}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" form="edit-link-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {editRow ? (
          <form id="edit-link-form" onSubmit={saveEdit} className="grid gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Name of Link</span>
              <input
                required
                value={editRow.name}
                onChange={(e) => setEditRow({ ...editRow, name: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Link</span>
              <input
                value={editRow.url}
                onChange={(e) => setEditRow({ ...editRow, url: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Created by</span>
              <input
                value={editRow.createdBy}
                onChange={(e) => setEditRow({ ...editRow, createdBy: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">File Path</span>
              <input
                value={editRow.filePath}
                onChange={(e) => setEditRow({ ...editRow, filePath: e.target.value })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            {showNotes && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">Notes</span>
                <textarea
                  rows={3}
                  value={editRow.notes || ''}
                  onChange={(e) => setEditRow({ ...editRow, notes: e.target.value })}
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
              </label>
            )}
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
