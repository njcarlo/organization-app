import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { Modal, NavIcon } from '@hae/ui'
import { db } from '../firebase'
import DocumentLinksTable from './DocumentLinksTable'

/**
 * Groups nested under a single Documents & Assets category item. Each group
 * gets its own DocumentLinksTable of link rows.
 */
export default function DocumentGroupsSection({ programId, showNotes = false }) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editingName, setEditingName] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, 'trackerDocumentGroups'))
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((g) => g.programId === programId)
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setGroups(list)
    } catch (err) {
      setError(err.message || 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const close = () => {
    if (saving) return
    setOpen(false)
    setName('')
  }

  const createGroup = async (e) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const maxOrder = groups.reduce((m, g) => Math.max(m, g.order ?? 0), 0)
      await addDoc(collection(db, 'trackerDocumentGroups'), {
        name: name.trim(),
        programId,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setOpen(false)
      setName('')
      await load()
    } catch (err) {
      setError(err.message || 'Failed to create group')
    } finally {
      setSaving(false)
    }
  }

  const startEditGroupName = (group) => {
    setEditingGroupId(group.id)
    setEditingName(group.name)
  }

  const cancelEditGroupName = () => {
    setEditingGroupId(null)
    setEditingName('')
  }

  const commitEditGroupName = async () => {
    const trimmed = editingName.trim()
    const group = groups.find((g) => g.id === editingGroupId)
    if (!trimmed || !group || trimmed === group.name) {
      cancelEditGroupName()
      return
    }
    try {
      await updateDoc(doc(db, 'trackerDocumentGroups', editingGroupId), { name: trimmed })
      setGroups((prev) => prev.map((g) => (g.id === editingGroupId ? { ...g, name: trimmed } : g)))
    } catch (err) {
      setError(err.message || 'Failed to rename group')
    } finally {
      cancelEditGroupName()
    }
  }

  const removeGroup = async (groupId) => {
    if (
      !confirm('Delete this group? Its links are not cascade-deleted. This action cannot be undone.')
    ) {
      return
    }
    setError('')
    try {
      await deleteDoc(doc(db, 'trackerDocumentGroups', groupId))
      await load()
    } catch (err) {
      setError(err.message || 'Failed to delete group')
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading groups…</p>

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-hae-red">{error}</p>}

      <div className="flex justify-end">
        <button type="button" className="hae-btn" onClick={() => setOpen(true)}>
          + Create Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hae-line bg-white/60 px-4 py-10 text-center text-sm text-hae-slate">
          No groups yet. Create one to start adding links.
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center justify-between">
              {editingGroupId === group.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitEditGroupName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitEditGroupName()
                    } else if (e.key === 'Escape') {
                      cancelEditGroupName()
                    }
                  }}
                  className="rounded border border-hae-crimson bg-white px-2 py-1 text-sm font-semibold text-hae-ink outline-none"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-hae-ink">{group.name}</h3>
                  <button
                    type="button"
                    onClick={() => startEditGroupName(group)}
                    title="Edit group name"
                    aria-label="Edit group name"
                    className="rounded p-0.5 text-hae-slate hover:bg-hae-mist/60 hover:text-hae-crimson"
                  >
                    <NavIcon name="edit" className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeGroup(group.id)}
                className="text-xs text-hae-slate hover:text-hae-red"
              >
                Delete group
              </button>
            </div>
            <DocumentLinksTable groupId={group.id} showNotes={showNotes} />
          </div>
        ))
      )}

      <Modal
        open={open}
        onClose={close}
        title="Create group"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="create-group-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Create group'}
            </button>
          </>
        }
      >
        <form id="create-group-form" onSubmit={createGroup}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Group name</span>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
        </form>
      </Modal>
    </div>
  )
}
