import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { formatMoney } from '../utils'

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

const NUMERIC_TYPES = new Set(['currency', 'number', 'percent'])
const COLUMN_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
]

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-hae-slate/80 uppercase">{label}</span>
      {children}
    </label>
  )
}

function displayValue(col, raw) {
  if (raw === undefined || raw === null || raw === '') return '—'
  if (col.type === 'currency') return formatMoney(raw)
  if (col.type === 'percent') return `${raw}%`
  if (col.type === 'number') return Number(raw).toLocaleString()
  return String(raw)
}

/**
 * A user-created report section: title and columns are fully personalized by
 * the user (added via "+ Column"), rows are added/edited like the other
 * Advancement list sections. Columns/title live on the section doc; rows live
 * in its `rows` subcollection.
 */
export default function AdvancementCustomSection({ section, onDeleted }) {
  const [title, setTitle] = useState(section.title || 'New Section')
  const [columns, setColumns] = useState(section.columns || [])
  const [editingTitle, setEditingTitle] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingCell, setEditingCell] = useState(null) // { rowId, colId, value }
  const [addForm, setAddForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [columnModal, setColumnModal] = useState(null) // { label, type }
  const [editingHeaderId, setEditingHeaderId] = useState(null)
  const [draggedColId, setDraggedColId] = useState(null)
  const [dragOverColId, setDragOverColId] = useState(null)

  const rowsPath = `trackerAdvancementCustomSections/${section.id}/rows`

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, rowsPath))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setRows(list)
    } catch (err) {
      setError(err.message || 'Failed to load rows')
    } finally {
      setLoading(false)
    }
  }, [rowsPath])

  useEffect(() => {
    load()
  }, [load])

  const persistColumns = async (next) => {
    setColumns(next)
    await updateDoc(doc(db, 'trackerAdvancementCustomSections', section.id), { columns: next })
  }

  const commitTitle = async (raw) => {
    setEditingTitle(false)
    const trimmed = raw.trim()
    if (!trimmed || trimmed === title) return
    setTitle(trimmed)
    await updateDoc(doc(db, 'trackerAdvancementCustomSections', section.id), { title: trimmed })
  }

  const openAddColumn = () => setColumnModal({ label: '', type: 'text' })
  const submitAddColumn = async (e) => {
    e.preventDefault()
    const label = columnModal?.label.trim()
    if (!label) return
    const id = `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    await persistColumns([...columns, { id, label, type: columnModal.type }])
    setColumnModal(null)
  }

  const removeColumn = async (colId) => {
    if (!confirm('Remove this column? Existing values in it will no longer be shown.')) return
    await persistColumns(columns.filter((c) => c.id !== colId))
  }

  const commitHeaderLabel = async (colId, label) => {
    setEditingHeaderId(null)
    const trimmed = label.trim()
    const current = columns.find((c) => c.id === colId)
    if (!trimmed || trimmed === current?.label) return
    await persistColumns(columns.map((c) => (c.id === colId ? { ...c, label: trimmed } : c)))
  }

  const handleDragStart = (colId) => (e) => {
    setDraggedColId(colId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (colId) => (e) => {
    e.preventDefault()
    if (colId !== draggedColId) setDragOverColId(colId)
  }
  const handleDragEnd = () => {
    setDraggedColId(null)
    setDragOverColId(null)
  }
  const handleDrop = (colId) => async (e) => {
    e.preventDefault()
    const from = draggedColId
    handleDragEnd()
    if (!from || from === colId) return
    const next = [...columns]
    const fromIdx = next.findIndex((c) => c.id === from)
    const toIdx = next.findIndex((c) => c.id === colId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    await persistColumns(next)
  }

  const startEditCell = (row, col) => setEditingCell({ rowId: row.id, colId: col.id, value: row[col.id] ?? '' })
  const commitEditCell = async () => {
    if (!editingCell) return
    const { rowId, colId, value } = editingCell
    const col = columns.find((c) => c.id === colId)
    setEditingCell(null)
    const parsed = NUMERIC_TYPES.has(col?.type) ? Number(value) || 0 : String(value).trim()
    try {
      await updateDoc(doc(db, rowsPath, rowId), { [colId]: parsed })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to update value')
    }
  }

  const removeRow = async (rowId) => {
    if (!confirm('Delete this row? This action cannot be undone.')) return
    await deleteDoc(doc(db, rowsPath, rowId))
    await load()
  }

  const openAdd = () => {
    const form = {}
    columns.forEach((c) => {
      form[c.id] = ''
    })
    setAddForm(form)
  }
  const closeAdd = () => {
    if (saving) return
    setAddForm(null)
  }
  const submitAdd = async (e) => {
    e.preventDefault()
    if (saving || !addForm || !columns.length) return
    setSaving(true)
    try {
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0)
      const payload = { order: maxOrder + 1, createdAt: serverTimestamp() }
      columns.forEach((c) => {
        const raw = addForm[c.id] ?? ''
        payload[c.id] = NUMERIC_TYPES.has(c.type) ? Number(raw) || 0 : String(raw).trim()
      })
      await addDoc(collection(db, rowsPath), payload)
      setAddForm(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to add row')
    } finally {
      setSaving(false)
    }
  }

  const deleteSection = async () => {
    if (!confirm('Delete this section and all its rows? This action cannot be undone.')) return
    await Promise.all(rows.map((r) => deleteDoc(doc(db, rowsPath, r.id))))
    onDeleted?.()
  }

  return (
    <section className="overflow-hidden rounded-lg border border-hae-line bg-white print:break-inside-avoid">
      <div className="flex items-center justify-between gap-3 border-b border-hae-line px-4 py-3">
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={title}
            className="rounded border border-hae-crimson px-1.5 py-0.5 font-display text-lg text-hae-ink outline-none"
            onBlur={(e) => commitTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur()
              if (e.key === 'Escape') setEditingTitle(false)
            }}
          />
        ) : (
          <button
            type="button"
            className="font-display text-lg text-hae-ink hover:text-hae-crimson print:pointer-events-none"
            onClick={() => setEditingTitle(true)}
          >
            {title}
          </button>
        )}
        <div className="flex shrink-0 items-center gap-2 print:hidden">
          <button type="button" className="hae-btn" onClick={openAdd} disabled={!columns.length}>
            + Add Row
          </button>
          <button type="button" className="text-xs text-hae-slate hover:text-hae-red" onClick={deleteSection}>
            Delete Section
          </button>
        </div>
      </div>

      {error && <p className="px-4 pt-3 text-sm text-hae-red">{error}</p>}

      {loading ? (
        <p className="px-4 py-6 text-sm text-hae-slate">Loading…</p>
      ) : !columns.length ? (
        <p className="px-4 py-6 text-sm text-hae-slate">No columns yet. Use "+ Column" below to add the first one.</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-hae-slate">No rows yet. Use "+ Add Row" to create the first one.</p>
      ) : (
        <div className="hae-table-scroll print:block print:overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hae-line/80 text-center text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
                {columns.map((col, idx) => {
                  const draggableCol = idx !== 0
                  return (
                    <th
                      key={col.id}
                      draggable={draggableCol}
                      onDragStart={draggableCol ? handleDragStart(col.id) : undefined}
                      onDragOver={draggableCol ? handleDragOver(col.id) : undefined}
                      onDrop={draggableCol ? handleDrop(col.id) : undefined}
                      onDragEnd={draggableCol ? handleDragEnd : undefined}
                      className={`group select-none px-4 py-2 ${draggableCol ? 'cursor-grab' : ''} ${
                        idx === 0 ? 'text-left' : 'text-center'
                      } ${dragOverColId === col.id ? 'bg-hae-mist' : ''} ${draggedColId === col.id ? 'opacity-40' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {editingHeaderId === col.id ? (
                          <input
                            autoFocus
                            defaultValue={col.label}
                            className="w-24 rounded border border-hae-crimson bg-white px-1 py-0.5 text-[11px] font-semibold text-hae-ink normal-case outline-none"
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => commitHeaderLabel(col.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.target.blur()
                              if (e.key === 'Escape') setEditingHeaderId(null)
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="hover:text-hae-crimson print:pointer-events-none"
                            onClick={() => setEditingHeaderId(col.id)}
                          >
                            {col.label}
                          </button>
                        )}
                        <button
                          type="button"
                          className="hidden text-hae-slate/50 hover:text-hae-red group-hover:inline print:hidden"
                          title="Remove column"
                          onClick={() => removeColumn(col.id)}
                        >
                          ×
                        </button>
                      </span>
                    </th>
                  )
                })}
                <th className="px-2 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-hae-line/60 last:border-0 hover:bg-hae-mist/50">
                  {columns.map((col, idx) => {
                    const isEditing = editingCell?.rowId === r.id && editingCell?.colId === col.id
                    const align = idx === 0 ? 'text-left' : 'text-center'
                    return (
                      <td key={col.id} className={`px-4 py-2 ${align}`}>
                        {isEditing ? (
                          <input
                            autoFocus
                            type={NUMERIC_TYPES.has(col.type) ? 'number' : 'text'}
                            className={`w-full rounded border border-hae-crimson px-1.5 py-0.5 ${align} text-sm outline-none`}
                            value={editingCell.value}
                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            onBlur={commitEditCell}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.target.blur()
                              if (e.key === 'Escape') setEditingCell(null)
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className={`w-full ${align} hover:text-hae-crimson print:pointer-events-none`}
                            onClick={() => startEditCell(r, col)}
                          >
                            {displayValue(col, r[col.id])}
                          </button>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2 py-2 text-center print:hidden">
                    <button type="button" className="text-xs text-hae-slate hover:text-hae-red" onClick={() => removeRow(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-hae-line px-4 py-2 print:hidden">
        <button type="button" className="text-xs text-hae-crimson hover:underline" onClick={openAddColumn}>
          + Column
        </button>
      </div>

      {columnModal && (
        <Modal
          open
          onClose={() => setColumnModal(null)}
          title="Add Column"
          size="sm"
          footer={
            <>
              <button type="button" className="hae-btn-secondary" onClick={() => setColumnModal(null)}>
                Cancel
              </button>
              <button type="submit" form="add-custom-section-column-form" className="hae-btn">
                Add
              </button>
            </>
          }
        >
          <form id="add-custom-section-column-form" onSubmit={submitAddColumn} className="space-y-3">
            <Field label="Column Name">
              <input
                autoFocus
                required
                className={fieldClass}
                value={columnModal.label}
                onChange={(e) => setColumnModal({ ...columnModal, label: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <select
                className={fieldClass}
                value={columnModal.type}
                onChange={(e) => setColumnModal({ ...columnModal, type: e.target.value })}
              >
                {COLUMN_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </form>
        </Modal>
      )}

      {addForm && (
        <Modal
          open
          onClose={closeAdd}
          title="Add Row"
          size="md"
          busy={saving}
          footer={
            <>
              <button type="button" className="hae-btn-secondary" onClick={closeAdd} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form="add-custom-section-row-form" className="hae-btn disabled:opacity-60" disabled={saving}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </>
          }
        >
          <form id="add-custom-section-row-form" onSubmit={submitAdd} className="grid gap-3 sm:grid-cols-2">
            {columns.map((c) => (
              <Field key={c.id} label={c.label}>
                <input
                  autoFocus={c === columns[0]}
                  type={NUMERIC_TYPES.has(c.type) ? 'number' : 'text'}
                  className={fieldClass}
                  value={addForm[c.id]}
                  onChange={(e) => setAddForm({ ...addForm, [c.id]: e.target.value })}
                />
              </Field>
            ))}
          </form>
        </Modal>
      )}
    </section>
  )
}
