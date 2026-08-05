import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { formatMoney } from '../utils'

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

const NUMERIC_TYPES = new Set(['currency', 'number', 'percent'])
const RIGHT_ALIGN_TYPES = new Set(['currency', 'number', 'percent'])

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
  subtitle,
  addLabel = '+ Add Row',
  collectionPath,
  columns,
  totals = false,
}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingCell, setEditingCell] = useState(null) // { rowId, colId, value }
  const [addForm, setAddForm] = useState(null)
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    load()
  }, [load])

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

  const renderCell = (row, col) => {
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
        className="w-full text-left hover:text-hae-crimson print:pointer-events-none"
        onClick={() => startEditCell(row, col)}
      >
        {displayValue(col, row[col.id])}
      </button>
    )
  }

  return (
    <section className="rounded-lg border border-hae-line bg-white print:break-inside-avoid">
      <div className="flex items-center justify-between gap-3 border-b border-hae-line px-4 py-3">
        <div>
          <h2 className="font-display text-lg text-hae-ink">{title}</h2>
          {subtitle && <p className="text-xs text-hae-slate">{subtitle}</p>}
        </div>
        <button type="button" className="hae-btn shrink-0 print:hidden" onClick={openAdd}>
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
                  <button type="button" className="text-xs text-hae-slate hover:text-hae-red" onClick={() => removeRow(r.id)}>
                    Delete
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

          <div className="hae-desktop-only hae-table-scroll print:block print:overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hae-line/80 text-left text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
                  {columns.map((col) => (
                    <th key={col.id} className={`px-4 py-2 ${RIGHT_ALIGN_TYPES.has(col.type) ? 'text-right' : ''}`}>
                      {col.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-hae-line/60 last:border-0 hover:bg-hae-mist/50">
                    {columns.map((col, idx) => (
                      <td
                        key={col.id}
                        className={`px-4 py-2 ${RIGHT_ALIGN_TYPES.has(col.type) ? 'text-right' : ''} ${idx === 0 ? 'font-medium' : ''}`}
                      >
                        {renderCell(r, col)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right print:hidden">
                      <button type="button" className="text-xs text-hae-slate hover:text-hae-red" onClick={() => removeRow(r.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="border-t-2 border-hae-line font-semibold text-hae-ink">
                    {columns.map((col, idx) => (
                      <td key={col.id} className={`px-4 py-2 ${RIGHT_ALIGN_TYPES.has(col.type) ? 'text-right' : ''}`}>
                        {idx === 0 ? 'TOTAL' : columnTotal(col)}
                      </td>
                    ))}
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              )}
            </table>
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
