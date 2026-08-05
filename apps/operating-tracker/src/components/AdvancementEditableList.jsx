import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { TrashIcon } from './ActionIcons'
import { formatMoney } from '../utils'

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

const NUMERIC_TYPES = new Set(['currency', 'number', 'percent'])

const TONE_CLASSES = {
  navy: 'bg-blue-900',
  green: 'bg-green-800',
  purple: 'bg-purple-800',
  crimson: 'bg-hae-crimson',
  orange: 'bg-amber-700',
  ink: 'bg-hae-ink',
}

const TONE_OPTIONS = Object.keys(TONE_CLASSES).map((key) => ({ key, class: TONE_CLASSES[key] }))

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-hae-slate/80 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

// Color swatches shown while a toned header title is being edited — mousedown
// preventDefault keeps the title input focused so picking a color doesn't
// blur/close the editor. Mirrors AdvancementReport's ToneSwatches.
function ToneSwatches({ value, onChange }) {
  return (
    <div className="mt-1 flex items-center gap-1 print:hidden">
      {TONE_OPTIONS.map((t) => (
        <button
          key={t.key}
          type="button"
          title={t.key}
          aria-label={`Set header color to ${t.key}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(t.key)}
          className={`h-4 w-4 rounded-full ${t.class} ${
            value === t.key ? 'ring-2 ring-white' : 'opacity-70 hover:opacity-100'
          }`}
        />
      ))}
    </div>
  )
}

function displayValue(col, raw) {
  if (raw === undefined || raw === null || raw === '') return '—'
  if (col.type === 'currency') return formatMoney(raw)
  if (col.type === 'percent') return `${raw}%`
  if (col.type === 'number') return Number(raw).toLocaleString()
  return String(raw)
}

function emptyFormFor(columns) {
  const form = {}
  columns.forEach((c) => {
    form[c.id] = c.type === 'select' ? c.options?.[0] || '' : ''
  })
  return form
}

/**
 * Generic editable table for the simple Advancement list sections (Financial
 * Summary, Revenue Pipeline, Strategic Partnerships, Mission Critical
 * Programs, Board Engagement, Recent Wins) — click-to-edit cells, "+ Add Row"
 * modal built from `columns`, row delete. Mirrors the click-to-edit /
 * add-modal conventions in AdvancementProgramsTable, generalized over a
 * column config instead of one fixed schema.
 */
export default function AdvancementEditableList({
  title,
  onTitleCommit,
  onToneCommit,
  addLabel = '+ Add Row',
  collectionPath,
  columns: columnsProp,
  totals = false,
  tone = null,
}) {
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState(columnsProp)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingCell, setEditingCell] = useState(null) // { rowId, colId, value }
  const [addForm, setAddForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editingHeaderId, setEditingHeaderId] = useState(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [draggedColId, setDraggedColId] = useState(null)
  const [dragOverColId, setDragOverColId] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, collectionPath))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setRows(list)
    } catch (err) {
      setError(err.message || `Failed to load ${title}`)
    } finally {
      setLoading(false)
    }
  }, [collectionPath, title])

  const loadColumnLayout = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'trackerAdvancementColumns', collectionPath))
      const saved = snap.exists() ? snap.data().columns : null
      if (!Array.isArray(saved) || !saved.length) return
      const byId = new Map(columnsProp.map((c) => [c.id, c]))
      const ordered = saved
        .filter((s) => byId.has(s.id))
        .map((s) => ({ ...byId.get(s.id), label: s.label || byId.get(s.id).label }))
      columnsProp.forEach((c) => {
        if (!ordered.some((o) => o.id === c.id)) ordered.push(c)
      })
      setColumns(ordered)
    } catch {
      // fall back silently to columnsProp
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath])

  useEffect(() => {
    load()
    loadColumnLayout()
  }, [load, loadColumnLayout])

  const persistColumnLayout = async (next) => {
    setColumns(next)
    try {
      await setDoc(doc(db, 'trackerAdvancementColumns', collectionPath), {
        columns: next.map((c) => ({ id: c.id, label: c.label })),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      setError(err.message || 'Failed to save column layout')
    }
  }

  const commitHeaderLabel = async (colId, label) => {
    setEditingHeaderId(null)
    const trimmed = label.trim()
    const current = columns.find((c) => c.id === colId)
    if (!trimmed || trimmed === current?.label) return
    await persistColumnLayout(columns.map((c) => (c.id === colId ? { ...c, label: trimmed } : c)))
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
    await persistColumnLayout(next)
  }

  const startEditCell = (row, col) => setEditingCell({ rowId: row.id, colId: col.id, value: row[col.id] ?? '' })

  const commitEditCell = async () => {
    if (!editingCell) return
    const { rowId, colId, value } = editingCell
    const col = columns.find((c) => c.id === colId)
    setEditingCell(null)
    const parsed = NUMERIC_TYPES.has(col?.type) ? Number(value) || 0 : String(value).trim()
    try {
      await updateDoc(doc(db, collectionPath, rowId), { [colId]: parsed })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to update value')
    }
  }

  const removeRow = async (rowId) => {
    if (!confirm('Delete this row? This action cannot be undone.')) return
    try {
      await deleteDoc(doc(db, collectionPath, rowId))
      await load()
    } catch (err) {
      setError(err.message || 'Failed to delete row')
    }
  }

  const openAdd = () => setAddForm(emptyFormFor(columns))
  const closeAdd = () => {
    if (saving) return
    setAddForm(null)
  }

  const submitAdd = async (e) => {
    e.preventDefault()
    if (saving || !addForm) return
    setSaving(true)
    setError('')
    try {
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0)
      const payload = { order: maxOrder + 1, createdAt: serverTimestamp() }
      columns.forEach((c) => {
        const raw = addForm[c.id] ?? ''
        payload[c.id] = NUMERIC_TYPES.has(c.type) ? Number(raw) || 0 : String(raw).trim()
      })
      await addDoc(collection(db, collectionPath), payload)
      setAddForm(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to add row')
    } finally {
      setSaving(false)
    }
  }

  const columnTotal = (col) => {
    if (!NUMERIC_TYPES.has(col.type)) return ''
    const sum = rows.reduce((s, r) => s + (Number(r[col.id]) || 0), 0)
    return col.type === 'currency' ? formatMoney(sum) : sum.toLocaleString()
  }

  const renderCell = (row, col, align = 'text-center') => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id
    if (isEditing) {
      if (col.type === 'select') {
        return (
          <select
            autoFocus
            className="w-full rounded border border-hae-crimson px-1.5 py-0.5 text-sm outline-none"
            value={editingCell.value}
            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
            onBlur={commitEditCell}
          >
            {col.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )
      }
      return (
        <input
          autoFocus
          type={NUMERIC_TYPES.has(col.type) ? 'number' : 'text'}
          className="w-full rounded border border-hae-crimson px-1.5 py-0.5 text-sm outline-none"
          value={editingCell.value}
          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
          onBlur={commitEditCell}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') setEditingCell(null)
          }}
        />
      )
    }
    return (
      <button
        type="button"
        className={`w-full ${align} hover:text-hae-crimson print:pointer-events-none`}
        onClick={() => startEditCell(row, col)}
      >
        {displayValue(col, row[col.id])}
      </button>
    )
  }

  return (
    <section className="rounded-lg border border-hae-line bg-white print:break-inside-avoid">
      <div
        className={`rounded-t-lg flex items-center justify-between gap-3 ${
          tone
            ? `section-header px-4 py-2.5 ${TONE_CLASSES[tone] || TONE_CLASSES.ink}`
            : 'border-b border-hae-line px-4 py-3'
        }`}
      >
        <div className="min-w-0 flex-1">
          {onTitleCommit ? (
            editingTitle ? (
              <div>
                <input
                  autoFocus
                  defaultValue={title}
                  className={
                    tone
                      ? 'section-title w-full rounded border border-white/60 bg-white/10 px-1.5 py-0.5 font-display text-sm font-semibold tracking-wide text-white uppercase outline-none'
                      : 'w-full rounded border border-hae-crimson px-1.5 py-0.5 font-display text-lg text-hae-ink outline-none'
                  }
                  onBlur={(e) => {
                    setEditingTitle(false)
                    const trimmed = e.target.value.trim()
                    if (trimmed && trimmed !== title) onTitleCommit(trimmed)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur()
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                />
                {tone && onToneCommit && <ToneSwatches value={tone} onChange={onToneCommit} />}
              </div>
            ) : (
              <button
                type="button"
                className={
                  tone
                    ? 'section-title font-display text-sm font-semibold tracking-wide text-white uppercase hover:text-white/80 print:pointer-events-none'
                    : 'font-display text-lg text-hae-ink hover:text-hae-crimson print:pointer-events-none'
                }
                onClick={() => setEditingTitle(true)}
              >
                {title}
              </button>
            )
          ) : (
            <h2
              className={
                tone
                  ? 'section-title font-display text-sm font-semibold tracking-wide text-white uppercase'
                  : 'font-display text-lg text-hae-ink'
              }
            >
              {title}
            </h2>
          )}
        </div>
        <button
          type="button"
          className={
            tone
              ? 'shrink-0 rounded border border-white/40 px-2 py-1 text-[10px] font-semibold whitespace-nowrap text-white uppercase hover:bg-white/10 print:hidden'
              : 'hae-btn shrink-0 print:hidden'
          }
          onClick={openAdd}
        >
          {addLabel}
        </button>
      </div>

      {error && <p className="px-4 pt-3 text-sm text-hae-red">{error}</p>}

      {loading ? (
        <p className="px-4 py-6 text-sm text-hae-slate">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-hae-slate">No rows yet. Use "{addLabel}" to create the first one.</p>
      ) : (
        <>
          <div className="hae-mobile-only hae-mobile-cards p-3 print:hidden">
            {rows.map((r) => (
              <div key={r.id} className="hae-mobile-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="hae-mobile-card__title min-w-0 flex-1">{displayValue(columns[0], r[columns[0].id])}</span>
                  <button type="button" className="text-hae-slate hover:text-hae-red" title="Delete" aria-label="Delete" onClick={() => removeRow(r.id)}>
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="hae-mobile-card__meta">
                  {columns.slice(1).map((c) => (
                    <span key={c.id}>
                      <span className="font-semibold text-hae-ink/70">{c.label}: </span>
                      {renderCell(r, c)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="hae-desktop-only overflow-hidden rounded-b-lg">
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
                        className={`select-none px-4 py-2 ${draggableCol ? 'cursor-grab' : ''} ${
                          idx === 0 ? 'text-left' : 'text-center'
                        } ${dragOverColId === col.id ? 'bg-hae-mist' : ''} ${draggedColId === col.id ? 'opacity-40' : ''}`}
                      >
                        {editingHeaderId === col.id ? (
                          <input
                            autoFocus
                            defaultValue={col.label}
                            className="w-28 rounded border border-hae-crimson bg-white px-1 py-0.5 text-[11px] font-semibold text-hae-ink normal-case outline-none"
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
                      </th>
                    )
                  })}
                  <th className="px-2 py-2 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-hae-line/60 last:border-0 hover:bg-hae-mist/50">
                    {columns.map((col, idx) => (
                      <td key={col.id} className={`px-4 py-2 ${idx === 0 ? 'text-left font-medium' : 'text-center'}`}>
                        {renderCell(r, col, idx === 0 ? 'text-left' : 'text-center')}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center print:hidden">
                      <button type="button" className="text-hae-slate hover:text-hae-red" title="Delete" aria-label="Delete" onClick={() => removeRow(r.id)}>
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="border-t-2 border-hae-line font-semibold text-hae-ink">
                    {columns.map((col, idx) => (
                      <td key={col.id} className={`px-4 py-2 ${idx === 0 ? 'text-left' : 'text-center'}`}>
                        {idx === 0 ? 'TOTAL' : columnTotal(col)}
                      </td>
                    ))}
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          </div>
        </>
      )}

      {addForm && (
        <Modal
          open
          onClose={closeAdd}
          title={addLabel.replace(/^\+\s*/, '')}
          size="md"
          busy={saving}
          footer={
            <>
              <button type="button" className="hae-btn-secondary" onClick={closeAdd} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form={`add-form-${collectionPath}`} className="hae-btn disabled:opacity-60" disabled={saving}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </>
          }
        >
          <form id={`add-form-${collectionPath}`} onSubmit={submitAdd} className="grid gap-3 sm:grid-cols-2">
            {columns.map((c) => (
              <Field key={c.id} label={c.label} className={c.type === 'textarea' ? 'sm:col-span-2' : ''}>
                {c.type === 'select' ? (
                  <select
                    className={fieldClass}
                    value={addForm[c.id]}
                    onChange={(e) => setAddForm({ ...addForm, [c.id]: e.target.value })}
                  >
                    {c.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : c.type === 'textarea' ? (
                  <textarea
                    rows={2}
                    className={fieldClass}
                    value={addForm[c.id]}
                    onChange={(e) => setAddForm({ ...addForm, [c.id]: e.target.value })}
                  />
                ) : (
                  <input
                    autoFocus={c === columns[0]}
                    type={NUMERIC_TYPES.has(c.type) ? 'number' : 'text'}
                    className={fieldClass}
                    value={addForm[c.id]}
                    onChange={(e) => setAddForm({ ...addForm, [c.id]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </form>
        </Modal>
      )}
    </section>
  )
}
