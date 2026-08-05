import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import AdvancementProgramDetailCard from '../components/AdvancementProgramDetailCard'
import { ADVANCEMENT_PROGRAM_STATUS_OPTIONS } from '../constants'
import {
  advancementProgramStatusBadgeClass,
  advancementProgramStatusDotClass,
  formatMoney,
  pctToGoal,
} from '../utils'

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

const DEFAULT_COLUMNS = [
  { id: 'name', label: 'Program', type: 'text', builtin: true },
  { id: 'purpose', label: 'Purpose', type: 'text', builtin: true },
  { id: 'revenue', label: 'Revenue (YTD)', type: 'currency', builtin: true },
  { id: 'goal', label: 'Goal', type: 'currency', builtin: true },
  { id: 'forecast', label: 'Forecast', type: 'currency', builtin: true },
  { id: 'pctToGoal', label: '% to Goal', type: 'computed', builtin: true },
  { id: 'status', label: 'Status', type: 'status', builtin: true },
]

const COLUMN_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'status', label: 'Status (text)' },
]

const RIGHT_ALIGN_TYPES = new Set(['currency', 'number', 'percent', 'computed'])
const NUMERIC_TYPES = new Set(['currency', 'number', 'percent'])
const alignClass = (type) => (RIGHT_ALIGN_TYPES.has(type) ? 'text-right' : '')

const emptyForm = {
  name: '',
  purpose: '',
  revenue: '',
  goal: '',
  forecast: '',
  status: ADVANCEMENT_PROGRAM_STATUS_OPTIONS[0],
  impactHighlights: '',
  customFields: {},
}

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

function columnTotalDisplay(col, rows, totals, totalPct) {
  if (col.id === 'revenue') return formatMoney(totals.revenue)
  if (col.id === 'goal') return formatMoney(totals.goal)
  if (col.id === 'forecast') return formatMoney(totals.forecast)
  if (col.id === 'pctToGoal') return totalPct == null ? '—' : `${totalPct}%`
  if (!col.builtin && NUMERIC_TYPES.has(col.type)) {
    const sum = rows.reduce((s, r) => s + (Number(r.customFields?.[col.id]) || 0), 0)
    return col.type === 'currency' ? formatMoney(sum) : sum.toLocaleString()
  }
  return ''
}

/**
 * HAE Advancement — executive dashboard. Starts with one section, Revenue
 * Generating Programs: an editable table where clicking a program opens a
 * floating popup with Program, Purpose, and Financial Report. Column headers
 * are editable in place, staff can add new columns (with a type) and drag
 * headers to reorder them — layout is persisted in
 * `trackerAdvancementColumns/programColumns`. Built to grow — later sections
 * (Membership, Partnerships, Board Engagement) slot in beside this one the
 * same way. Printable via the browser print dialog (see print:* utility
 * classes and Layout.jsx).
 */
export default function AdvancementDashboard() {
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [addModal, setAddModal] = useState(null) // { form }
  const [saving, setSaving] = useState(false)
  const [columnModal, setColumnModal] = useState(null) // { label, type }
  const [savingColumn, setSavingColumn] = useState(false)
  const [editingHeaderId, setEditingHeaderId] = useState(null)
  const [editingCell, setEditingCell] = useState(null) // { rowId, colId, value }
  const [draggedColId, setDraggedColId] = useState(null)
  const [dragOverColId, setDragOverColId] = useState(null)

  const selected = rows.find((r) => r.id === selectedId) || null

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(collection(db, 'trackerAdvancementPrograms'))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setRows(list)
    } catch (err) {
      setError(err.message || 'Failed to load Revenue Generating Programs')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadColumns = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'trackerAdvancementColumns', 'programColumns'))
      const saved = snap.exists() ? snap.data().columns : null
      if (Array.isArray(saved) && saved.length) setColumns(saved)
    } catch {
      // fall back silently to DEFAULT_COLUMNS
    }
  }, [])

  useEffect(() => {
    load()
    loadColumns()
  }, [load, loadColumns])

  const persistColumns = async (next) => {
    setColumns(next)
    try {
      await setDoc(doc(db, 'trackerAdvancementColumns', 'programColumns'), {
        columns: next,
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

  const openAddColumn = () => setColumnModal({ label: '', type: 'text' })
  const closeAddColumn = () => {
    if (savingColumn) return
    setColumnModal(null)
  }
  const submitAddColumn = async (e) => {
    e.preventDefault()
    const label = columnModal?.label.trim()
    if (!label || savingColumn) return
    setSavingColumn(true)
    const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    await persistColumns([...columns, { id, label, type: columnModal.type, builtin: false }])
    setSavingColumn(false)
    setColumnModal(null)
  }

  const removeColumn = async (colId) => {
    if (!confirm('Remove this column? Existing values in it will no longer be shown.')) return
    await persistColumns(columns.filter((c) => c.id !== colId))
  }

  const startEditCell = (row, col) => {
    if (col.builtin) return
    setEditingCell({ rowId: row.id, colId: col.id, value: row.customFields?.[col.id] ?? '' })
  }
  const commitEditCell = async () => {
    if (!editingCell) return
    const { rowId, colId, value } = editingCell
    const col = columns.find((c) => c.id === colId)
    setEditingCell(null)
    const parsed = NUMERIC_TYPES.has(col?.type) ? Number(value) || 0 : String(value).trim()
    try {
      await updateDoc(doc(db, 'trackerAdvancementPrograms', rowId), { [`customFields.${colId}`]: parsed })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to update value')
    }
  }

  const openAdd = () => {
    const customFields = {}
    columns.filter((c) => !c.builtin).forEach((c) => {
      customFields[c.id] = ''
    })
    setAddModal({ form: { ...emptyForm, customFields } })
  }
  const closeAddModal = () => {
    if (saving) return
    setAddModal(null)
  }

  const submitAddModal = async (e) => {
    e.preventDefault()
    if (!addModal?.form.name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const { form } = addModal
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0)
      const customFields = {}
      columns.filter((c) => !c.builtin).forEach((c) => {
        const raw = form.customFields?.[c.id] ?? ''
        customFields[c.id] = NUMERIC_TYPES.has(c.type) ? Number(raw) || 0 : String(raw).trim()
      })
      await addDoc(collection(db, 'trackerAdvancementPrograms'), {
        name: form.name.trim(),
        purpose: form.purpose.trim(),
        revenue: Number(form.revenue) || 0,
        goal: Number(form.goal) || 0,
        forecast: Number(form.forecast) || 0,
        status: form.status,
        impactHighlights: form.impactHighlights.trim(),
        customFields,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setAddModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to add program')
    } finally {
      setSaving(false)
    }
  }

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + (Number(r.revenue) || 0),
      goal: acc.goal + (Number(r.goal) || 0),
      forecast: acc.forecast + (Number(r.forecast) || 0),
    }),
    { revenue: 0, goal: 0, forecast: 0 }
  )
  const totalPct = pctToGoal(totals.revenue, totals.goal)

  const renderCell = (row, col) => {
    if (col.id === 'name') {
      return (
        <button
          type="button"
          onClick={() => setSelectedId(row.id)}
          className="text-hae-crimson hover:underline print:text-hae-ink print:no-underline"
        >
          {row.name}
        </button>
      )
    }
    if (col.id === 'purpose') return row.purpose || '—'
    if (col.id === 'revenue' || col.id === 'goal' || col.id === 'forecast') return formatMoney(row[col.id])
    if (col.id === 'pctToGoal') {
      const pct = pctToGoal(row.revenue, row.goal)
      return (
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${advancementProgramStatusDotClass(row.status)} print:hidden`}
          />
          {pct == null ? '—' : `${pct}%`}
        </span>
      )
    }
    if (col.id === 'status') {
      return (
        <span
          className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${advancementProgramStatusBadgeClass(row.status)}`}
        >
          {row.status || '—'}
        </span>
      )
    }

    // custom column
    const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id
    if (isEditing) {
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
    const rawValue = row.customFields?.[col.id]
    let display = '—'
    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      if (col.type === 'currency') display = formatMoney(rawValue)
      else if (col.type === 'percent') display = `${rawValue}%`
      else if (col.type === 'number') display = Number(rawValue).toLocaleString()
      else display = String(rawValue)
    }
    return (
      <button
        type="button"
        className="w-full text-left hover:text-hae-crimson print:pointer-events-none"
        onClick={() => startEditCell(row, col)}
      >
        {display}
      </button>
    )
  }

  return (
    <div className="print:text-black">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:mb-4">
        <div>
          <h1 className="font-display text-3xl text-hae-ink">HAE Advancement</h1>
          <p className="mt-1 text-sm text-hae-slate">
            Executive view of revenue, pipeline, and program impact for the president and board.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" className="hae-btn-secondary" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="hae-btn" onClick={openAdd}>
            + Add Program
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-hae-red">{error}</p>}

      <section className="rounded-lg border border-hae-line bg-white print:break-inside-avoid">
        <div className="flex items-center justify-between border-b border-hae-line px-4 py-3">
          <div>
            <h2 className="font-display text-lg text-hae-ink">Revenue Generating Programs</h2>
            <p className="text-xs text-hae-slate">
              Financial impact — click a program for its full financial report. Click a column header to rename it,
              drag it to reorder.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-6 text-sm text-hae-slate">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">
            No programs yet. Use “+ Add Program” to create the first one.
          </p>
        ) : (
          <>
            <div className="hae-mobile-only hae-mobile-cards p-3 print:hidden">
              {rows.map((r) => {
                const statusCol = columns.find((c) => c.id === 'status')
                return (
                  <div key={r.id} className="hae-mobile-card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className="hae-mobile-card__title min-w-0 flex-1 text-left text-hae-crimson"
                      >
                        {r.name || 'Untitled program'}
                      </button>
                      {statusCol && renderCell(r, statusCol)}
                    </div>
                    <div className="hae-mobile-card__meta">
                      {columns
                        .filter((c) => c.id !== 'name' && c.id !== 'status')
                        .map((c) => (
                          <span key={c.id}>
                            <span className="font-semibold text-hae-ink/70">{c.label}: </span>
                            {renderCell(r, c)}
                          </span>
                        ))}
                    </div>
                  </div>
                )
              })}
              <div className="hae-mobile-card space-y-1 text-sm font-semibold text-hae-ink">
                <div className="flex justify-between">
                  <span>Total Revenue</span>
                  <span>{formatMoney(totals.revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Goal</span>
                  <span>{formatMoney(totals.goal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Forecast</span>
                  <span>{formatMoney(totals.forecast)}</span>
                </div>
                <div className="flex justify-between">
                  <span>% to Goal</span>
                  <span>{totalPct == null ? '—' : `${totalPct}%`}</span>
                </div>
              </div>
              <p className="px-1 text-[11px] text-hae-slate">
                Renaming, adding, and reordering columns is available on a larger screen.
              </p>
            </div>

            <div className="hae-desktop-only hae-table-scroll print:block print:overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hae-line/80 text-left text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      draggable
                      onDragStart={handleDragStart(col.id)}
                      onDragOver={handleDragOver(col.id)}
                      onDrop={handleDrop(col.id)}
                      onDragEnd={handleDragEnd}
                      className={`group cursor-grab px-4 py-2 select-none ${alignClass(col.type)} ${
                        dragOverColId === col.id ? 'bg-hae-mist' : ''
                      } ${draggedColId === col.id ? 'opacity-40' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span className="text-hae-slate/40 print:hidden">⋮⋮</span>
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
                        {!col.builtin && (
                          <button
                            type="button"
                            className="hidden text-hae-slate/50 hover:text-hae-red group-hover:inline print:hidden"
                            title="Remove column"
                            onClick={() => removeColumn(col.id)}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="px-2 py-2 print:hidden">
                    <button
                      type="button"
                      className="text-hae-slate/60 hover:text-hae-crimson"
                      title="Add column"
                      onClick={openAddColumn}
                    >
                      + Column
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-hae-line/60 last:border-0 hover:bg-hae-mist/50">
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={`px-4 py-2 ${alignClass(col.type)} ${
                          col.id === 'name' ? 'font-medium' : ''
                        } ${col.id === 'purpose' ? 'max-w-[16rem] text-hae-slate' : ''}`}
                      >
                        {renderCell(r, col)}
                      </td>
                    ))}
                    <td className="print:hidden" />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-hae-line font-semibold text-hae-ink">
                  {columns.map((col, idx) => (
                    <td key={col.id} className={`px-4 py-2 ${alignClass(col.type)}`}>
                      {idx === 0 ? 'TOTAL REVENUE PROGRAMS' : columnTotalDisplay(col, rows, totals, totalPct)}
                    </td>
                  ))}
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
            </div>
          </>
        )}
      </section>

      {selected && (
        <AdvancementProgramDetailCard
          program={selected}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onDeleted={() => {
            setSelectedId(null)
            load()
          }}
        />
      )}

      {addModal && (
        <Modal
          open
          onClose={closeAddModal}
          title="Add Revenue Generating Program"
          size="md"
          busy={saving}
          footer={
            <>
              <button type="button" className="hae-btn-secondary" onClick={closeAddModal} disabled={saving}>
                Cancel
              </button>
              <button
                type="submit"
                form="add-advancement-program-form"
                className="hae-btn disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Add Program'}
              </button>
            </>
          }
        >
          <form id="add-advancement-program-form" onSubmit={submitAddModal} className="grid gap-3 sm:grid-cols-2">
            <Field label="Program" className="sm:col-span-2">
              <input
                autoFocus
                required
                className={fieldClass}
                value={addModal.form.name}
                onChange={(e) => setAddModal({ form: { ...addModal.form, name: e.target.value } })}
              />
            </Field>
            <Field label="Purpose" className="sm:col-span-2">
              <textarea
                rows={2}
                className={fieldClass}
                value={addModal.form.purpose}
                onChange={(e) => setAddModal({ form: { ...addModal.form, purpose: e.target.value } })}
              />
            </Field>
            <Field label="Revenue (YTD)">
              <input
                type="number"
                min="0"
                step="1000"
                className={fieldClass}
                value={addModal.form.revenue}
                onChange={(e) => setAddModal({ form: { ...addModal.form, revenue: e.target.value } })}
              />
            </Field>
            <Field label="Goal">
              <input
                type="number"
                min="0"
                step="1000"
                className={fieldClass}
                value={addModal.form.goal}
                onChange={(e) => setAddModal({ form: { ...addModal.form, goal: e.target.value } })}
              />
            </Field>
            <Field label="Forecast">
              <input
                type="number"
                min="0"
                step="1000"
                className={fieldClass}
                value={addModal.form.forecast}
                onChange={(e) => setAddModal({ form: { ...addModal.form, forecast: e.target.value } })}
              />
            </Field>
            <Field label="Status">
              <select
                className={fieldClass}
                value={addModal.form.status}
                onChange={(e) => setAddModal({ form: { ...addModal.form, status: e.target.value } })}
              >
                {ADVANCEMENT_PROGRAM_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Impact Highlights" className="sm:col-span-2">
              <textarea
                rows={2}
                className={fieldClass}
                placeholder="e.g. 121 applications | 12 finalists | Global exposure"
                value={addModal.form.impactHighlights}
                onChange={(e) => setAddModal({ form: { ...addModal.form, impactHighlights: e.target.value } })}
              />
            </Field>
            {columns
              .filter((c) => !c.builtin)
              .map((c) => (
                <Field key={c.id} label={c.label}>
                  <input
                    type={NUMERIC_TYPES.has(c.type) ? 'number' : 'text'}
                    className={fieldClass}
                    value={addModal.form.customFields?.[c.id] ?? ''}
                    onChange={(e) =>
                      setAddModal({
                        form: {
                          ...addModal.form,
                          customFields: { ...addModal.form.customFields, [c.id]: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
              ))}
          </form>
        </Modal>
      )}

      {columnModal && (
        <Modal
          open
          onClose={closeAddColumn}
          title="Add Column"
          size="sm"
          busy={savingColumn}
          footer={
            <>
              <button type="button" className="hae-btn-secondary" onClick={closeAddColumn} disabled={savingColumn}>
                Cancel
              </button>
              <button
                type="submit"
                form="add-advancement-column-form"
                className="hae-btn disabled:opacity-60"
                disabled={savingColumn}
              >
                {savingColumn ? 'Adding…' : 'Add Column'}
              </button>
            </>
          }
        >
          <form id="add-advancement-column-form" onSubmit={submitAddColumn} className="grid gap-3">
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
                {COLUMN_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </form>
        </Modal>
      )}
    </div>
  )
}
