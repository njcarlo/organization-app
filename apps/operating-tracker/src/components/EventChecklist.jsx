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

const cellInputClass =
  'w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm outline-none focus:border-hae-crimson focus:bg-white'

/**
 * Directly editable checklist nested under a single Event category item —
 * mirrors DocumentFilesTable's always-editable-row pattern, but for
 * checkbox + text checklist items instead of document links.
 */
export default function EventChecklist({ eventId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newText, setNewText] = useState('')
  const newInputRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, 'trackerEventChecklist'))
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((i) => i.eventId === eventId)
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setItems(list)
    } catch (err) {
      setError(err.message || 'Failed to load checklist')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const updateLocalItem = (id, field, value) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const toggleDone = async (item) => {
    setError('')
    try {
      await updateDoc(doc(db, 'trackerEventChecklist', item.id), { done: !item.done })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to update checklist item')
    }
  }

  const saveText = async (item) => {
    setError('')
    try {
      await updateDoc(doc(db, 'trackerEventChecklist', item.id), { text: item.text.trim() })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save checklist item')
    }
  }

  const removeItem = async (id) => {
    if (!confirm('Delete this checklist item? This action cannot be undone.')) return
    setError('')
    try {
      await deleteDoc(doc(db, 'trackerEventChecklist', id))
      await load()
    } catch (err) {
      setError(err.message || 'Failed to delete checklist item')
    }
  }

  const commitNewItem = async () => {
    if (!newText.trim()) return
    setError('')
    try {
      const maxOrder = items.reduce((m, i) => Math.max(m, i.order ?? 0), 0)
      await addDoc(collection(db, 'trackerEventChecklist'), {
        text: newText.trim(),
        done: false,
        eventId,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setNewText('')
      await load()
      newInputRef.current?.focus()
    } catch (err) {
      setError(err.message || 'Failed to add checklist item')
    }
  }

  const onEnterSaveText = (e, item) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    saveText(item)
  }

  const onEnterCommitNewItem = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    commitNewItem()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading checklist…</p>

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-hae-red">{error}</p>}
      <div className="rounded-xl border border-hae-line bg-white">
        <ul className="divide-y divide-hae-line">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-2 px-2 py-1">
              <input type="checkbox" checked={!!item.done} onChange={() => toggleDone(item)} />
              <input
                className={`${cellInputClass} ${item.done ? 'text-hae-slate line-through' : ''}`}
                value={item.text}
                onChange={(e) => updateLocalItem(item.id, 'text', e.target.value)}
                onBlur={() => saveText(item)}
                onKeyDown={(e) => onEnterSaveText(e, item)}
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="shrink-0 text-xs text-hae-slate opacity-100 hover:text-hae-red sm:opacity-0 sm:group-hover:opacity-100"
              >
                Delete
              </button>
            </li>
          ))}
          <li className="flex items-center gap-2 px-2 py-1">
            <input type="checkbox" disabled className="opacity-30" />
            <input
              ref={newInputRef}
              placeholder="Add a checklist item"
              className={cellInputClass}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={onEnterCommitNewItem}
            />
          </li>
        </ul>
      </div>
    </div>
  )
}
