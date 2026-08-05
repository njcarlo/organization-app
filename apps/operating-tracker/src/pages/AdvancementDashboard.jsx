import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
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

const emptyForm = {
  name: '',
  purpose: '',
  revenue: '',
  goal: '',
  forecast: '',
  status: ADVANCEMENT_PROGRAM_STATUS_OPTIONS[0],
  impactHighlights: '',
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

/**
 * HAE Advancement — executive dashboard. Starts with one section, Revenue
 * Generating Programs: an editable table where clicking a program opens a
 * floating popup with Program, Purpose, and Financial Report. Built to grow —
 * later sections (Membership, Partnerships, Board Engagement) slot in beside
 * this one the same way. Printable via the browser print dialog (see
 * print:* utility classes and Layout.jsx).
 */
export default function AdvancementDashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [addModal, setAddModal] = useState(null) // { form }
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => setAddModal({ form: emptyForm })
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
      await addDoc(collection(db, 'trackerAdvancementPrograms'), {
        name: form.name.trim(),
        purpose: form.purpose.trim(),
        revenue: Number(form.revenue) || 0,
        goal: Number(form.goal) || 0,
        forecast: Number(form.forecast) || 0,
        status: form.status,
        impactHighlights: form.impactHighlights.trim(),
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
            <p className="text-xs text-hae-slate">Financial impact — click a program for its full financial report.</p>
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-6 text-sm text-hae-slate">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">
            No programs yet. Use “+ Add Program” to create the first one.
          </p>
        ) : (
          <div className="hae-table-scroll print:overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hae-line/80 text-left text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
                  <th className="px-4 py-2">Program</th>
                  <th className="px-4 py-2">Purpose</th>
                  <th className="px-4 py-2 text-right">Revenue (YTD)</th>
                  <th className="px-4 py-2 text-right">Goal</th>
                  <th className="px-4 py-2 text-right">Forecast</th>
                  <th className="px-4 py-2 text-right">% to Goal</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = pctToGoal(r.revenue, r.goal)
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-hae-line/60 last:border-0 hover:bg-hae-mist/50"
                    >
                      <td className="px-4 py-2 font-medium">
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className="text-hae-crimson hover:underline print:text-hae-ink print:no-underline"
                        >
                          {r.name}
                        </button>
                      </td>
                      <td className="max-w-[16rem] px-4 py-2 text-hae-slate">{r.purpose || '—'}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(r.revenue)}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(r.goal)}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(r.forecast)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${advancementProgramStatusDotClass(r.status)} print:hidden`}
                          />
                          {pct == null ? '—' : `${pct}%`}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${advancementProgramStatusBadgeClass(r.status)}`}
                        >
                          {r.status || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-hae-line font-semibold text-hae-ink">
                  <td className="px-4 py-2" colSpan={2}>
                    TOTAL REVENUE PROGRAMS
                  </td>
                  <td className="px-4 py-2 text-right">{formatMoney(totals.revenue)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(totals.goal)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(totals.forecast)}</td>
                  <td className="px-4 py-2 text-right">{totalPct == null ? '—' : `${totalPct}%`}</td>
                  <td className="px-4 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
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
          </form>
        </Modal>
      )}
    </div>
  )
}
