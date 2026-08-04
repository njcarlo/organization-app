import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { ADVANCEMENT_KPI_DEFAULTS, HEALTH_OPTIONS, KPI_UNIT_OPTIONS } from '../constants'
import { healthBadgeClass, healthLabel } from '../utils'
import { EditIcon } from '../components/ActionIcons'

const DEFAULT_TITLE = 'Standing Advancement Dashboard'
const TITLE_DOC = 'advancementDashboardConfig/main'

const emptyForm = {
  name: '',
  unit: 'currency',
  currentValue: '',
  goalValue: '',
  status: 'ongoing',
  notes: '',
}

function formatKpiValue(value, unit) {
  const num = Number(value)
  if (value === '' || value === null || value === undefined || Number.isNaN(num)) return '—'
  if (unit === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(num)
  }
  if (unit === 'percent') return `${new Intl.NumberFormat('en-US').format(num)}%`
  return new Intl.NumberFormat('en-US').format(num)
}

function progressPercent(current, goal) {
  const c = Number(current)
  const g = Number(goal)
  if (!g || Number.isNaN(c) || Number.isNaN(g)) return 0
  return Math.max(0, Math.min(100, Math.round((c / g) * 100)))
}

/**
 * Standing Advancement Dashboard — one tile per committee KPI (current value
 * vs. annual goal, status, notes). Click a tile to edit; add/seed via modal.
 */
export default function AdvancementDashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // { id, form }
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [titleModalOpen, setTitleModalOpen] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [snap, titleSnap] = await Promise.all([
        getDocs(collection(db, 'advancementKpis')),
        getDoc(doc(db, TITLE_DOC)),
      ])
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setRows(list)
      setTitle(titleSnap.exists() ? titleSnap.data().title || DEFAULT_TITLE : DEFAULT_TITLE)
    } catch (err) {
      setError(err.message || 'Failed to load the advancement dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openTitleEdit = () => {
    setTitleDraft(title)
    setTitleModalOpen(true)
  }

  const closeTitleEdit = () => {
    if (titleSaving) return
    setTitleModalOpen(false)
  }

  const saveTitle = async (e) => {
    e.preventDefault()
    const next = titleDraft.trim()
    if (!next || titleSaving) return
    setTitleSaving(true)
    setError('')
    try {
      await setDoc(doc(db, TITLE_DOC), { title: next }, { merge: true })
      setTitle(next)
      setTitleModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to save the page title')
    } finally {
      setTitleSaving(false)
    }
  }

  const seedDefaults = async () => {
    if (seeding) return
    setSeeding(true)
    setError('')
    try {
      const batch = writeBatch(db)
      ADVANCEMENT_KPI_DEFAULTS.forEach((name, index) => {
        const ref = doc(collection(db, 'advancementKpis'))
        batch.set(ref, {
          name,
          unit: 'currency',
          currentValue: '',
          goalValue: '',
          status: 'ongoing',
          notes: '',
          order: index,
          createdAt: serverTimestamp(),
        })
      })
      await batch.commit()
      await load()
    } catch (err) {
      setError(err.message || 'Failed to seed default KPIs')
    } finally {
      setSeeding(false)
    }
  }

  const openAdd = () => setModal({ id: null, form: emptyForm })

  const openEdit = (row) =>
    setModal({
      id: row.id,
      form: {
        name: row.name || '',
        unit: row.unit || 'currency',
        currentValue: row.currentValue ?? '',
        goalValue: row.goalValue ?? '',
        status: row.status || 'ongoing',
        notes: row.notes || '',
      },
    })

  const closeModal = () => {
    if (saving) return
    setModal(null)
  }

  const submitModal = async (e) => {
    e.preventDefault()
    if (!modal?.form.name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const { form } = modal
      const data = {
        name: form.name.trim(),
        unit: form.unit,
        currentValue: form.currentValue === '' ? '' : Number(form.currentValue),
        goalValue: form.goalValue === '' ? '' : Number(form.goalValue),
        status: form.status,
        notes: form.notes.trim(),
      }
      if (modal.id) {
        await updateDoc(doc(db, 'advancementKpis', modal.id), data)
      } else {
        const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), -1)
        await addDoc(collection(db, 'advancementKpis'), {
          ...data,
          order: maxOrder + 1,
          createdAt: serverTimestamp(),
        })
      }
      setModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save KPI')
    } finally {
      setSaving(false)
    }
  }

  const deleteKpi = async () => {
    if (!modal?.id || saving) return
    if (!confirm(`Delete "${modal.form.name}"? This action cannot be undone.`)) return
    setSaving(true)
    setError('')
    try {
      await deleteDoc(doc(db, 'advancementKpis', modal.id))
      setModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to delete KPI')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading advancement dashboard…</p>

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hae-line pb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
            Harvard Alumni Entrepreneurs
          </p>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
              {title}
            </h1>
            <button
              type="button"
              onClick={openTitleEdit}
              className="rounded-md p-1.5 text-hae-slate hover:bg-hae-mist hover:text-hae-crimson"
              aria-label="Edit page title"
              title="Edit title"
            >
              <EditIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-hae-slate">
            The Advancement Committee's core performance indicators — current progress against
            each annual goal.
          </p>
        </div>
        <button type="button" className="hae-btn" onClick={openAdd}>
          + Add KPI
        </button>
      </header>

      {error && <p className="text-sm text-hae-red">{error}</p>}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hae-line bg-white p-8 text-center">
          <p className="text-sm text-hae-slate">No KPIs yet.</p>
          <button
            type="button"
            className="hae-btn-secondary mt-4"
            onClick={seedDefaults}
            disabled={seeding}
          >
            {seeding ? 'Seeding…' : 'Seed the 9 standing KPIs'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const pct = progressPercent(row.currentValue, row.goalValue)
            return (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-xl border border-hae-line bg-white p-5 transition hover:border-hae-crimson/50 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-base text-hae-ink">{row.name}</h2>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${healthBadgeClass(row.status)}`}
                    >
                      {healthLabel(row.status)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="rounded-md p-1 text-hae-slate hover:bg-hae-mist hover:text-hae-crimson"
                      aria-label={`Edit ${row.name}`}
                      title="Edit"
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl text-hae-ink">
                    {formatKpiValue(row.currentValue, row.unit)}
                  </span>
                  <span className="text-xs text-hae-slate">
                    of {formatKpiValue(row.goalValue, row.unit)} goal
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-hae-mist">
                  <div
                    className="h-full rounded-full bg-hae-crimson"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-hae-slate">{pct}% of goal</p>
                {row.notes ? (
                  <p className="line-clamp-2 text-xs text-hae-slate">{row.notes}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={closeModal}
        title={modal?.id ? 'Edit KPI' : 'Add KPI'}
        busy={saving}
        footer={
          <>
            {modal?.id ? (
              <button
                type="button"
                className="hae-btn-secondary border-hae-crimson text-hae-crimson"
                onClick={deleteKpi}
                disabled={saving}
              >
                Delete
              </button>
            ) : null}
            <button type="button" className="hae-btn-secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="advancement-kpi-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {modal ? (
          <form id="advancement-kpi-form" onSubmit={submitModal} className="grid gap-3 sm:grid-cols-2">
            {error && <p className="text-sm text-hae-red sm:col-span-2">{error}</p>}
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-hae-slate">KPI Name</span>
              <input
                required
                value={modal.form.name}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Unit</span>
              <select
                value={modal.form.unit}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, unit: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                {KPI_UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Status</span>
              <select
                value={modal.form.status}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, status: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                {HEALTH_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Current Value</span>
              <input
                type="number"
                value={modal.form.currentValue}
                onChange={(e) =>
                  setModal({ ...modal, form: { ...modal.form, currentValue: e.target.value } })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Annual Goal</span>
              <input
                type="number"
                value={modal.form.goalValue}
                onChange={(e) =>
                  setModal({ ...modal, form: { ...modal.form, goalValue: e.target.value } })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-hae-slate">Notes</span>
              <textarea
                rows={3}
                value={modal.form.notes}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={titleModalOpen}
        onClose={closeTitleEdit}
        title="Edit page title"
        busy={titleSaving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={closeTitleEdit} disabled={titleSaving}>
              Cancel
            </button>
            <button type="submit" form="advancement-title-form" className="hae-btn" disabled={titleSaving}>
              {titleSaving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form id="advancement-title-form" onSubmit={saveTitle}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Title</span>
            <input
              required
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </label>
        </form>
      </Modal>
    </div>
  )
}
