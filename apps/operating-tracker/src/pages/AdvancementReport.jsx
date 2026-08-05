import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import AdvancementProgramsTable from '../components/AdvancementProgramsTable'
import AdvancementEditableList from '../components/AdvancementEditableList'
import AdvancementCustomSection from '../components/AdvancementCustomSection'
import { DownloadIcon, PrinterIcon } from '../components/ActionIcons'
import {
  ADVANCEMENT_MEMBERSHIP_TYPES,
  ADVANCEMENT_PIPELINE_STAGE_OPTIONS,
  ADVANCEMENT_PROGRAM_STATUS_OPTIONS,
} from '../constants'
import {
  advancementProgramStatusDotClass,
  daysUntil,
  effectivePriority,
  formatDate,
  formatLongDate,
  formatMoney,
  namesLabel,
  normalizeTaskStatus,
  pctToGoal,
} from '../utils'

const REPORT_TITLE = 'HAE Advancement & Program Impact Dashboard'

const STAGE_COLORS = {
  Prospect: 'bg-gray-300',
  Qualifying: 'bg-sky-300',
  Proposal: 'bg-purple-500',
  Negotiation: 'bg-amber-500',
  Committed: 'bg-green-600',
}

// Un-layered <style> rules always win over Tailwind's layered utility
// classes regardless of selector specificity, so this is a reliable way to
// force everything onto one printed page without hand-editing every
// Tailwind class for a print: variant.
const PRINT_STYLES = `
@media print {
  @page { size: landscape; margin: 0.3in; }
  .advancement-report { font-size: 9px; }
  .advancement-report .report-title { font-size: 20px; }
  .advancement-report .report-tagline { font-size: 11px; }
  .advancement-report .section-header { padding: 3px 8px; }
  .advancement-report .section-title { font-size: 9px; }
  .advancement-report .section-body { padding: 6px 8px; }
  .advancement-report .kpi-tile { padding: 6px 8px; }
  .advancement-report .kpi-value { font-size: 15px; }
  .advancement-report table { font-size: 8px; }
  .advancement-report th, .advancement-report td { padding: 1px 4px; }
}
`

function statusFromPct(pct) {
  if (pct == null) return null
  if (pct >= 100) return 'On Track'
  if (pct >= 75) return 'At Risk'
  return 'Behind'
}

function healthStatusFromScore(score) {
  if (score == null) return null
  if (score >= 80) return 'On Track'
  if (score >= 50) return 'At Risk'
  return 'Behind'
}

function SectionCard({ title, subtitle, tone = 'ink', headerAction, children, className = '' }) {
  const toneClass =
    {
      navy: 'bg-blue-900',
      green: 'bg-green-800',
      purple: 'bg-purple-800',
      crimson: 'bg-hae-crimson',
      orange: 'bg-amber-700',
      ink: 'bg-hae-ink',
    }[tone] || 'bg-hae-ink'
  return (
    <section className={`overflow-hidden rounded-lg border border-hae-line bg-white print:break-inside-avoid ${className}`}>
      <div className={`section-header flex items-center justify-between gap-3 px-4 py-2.5 ${toneClass}`}>
        <div>
          <h2 className="section-title font-display text-sm font-semibold tracking-wide text-white uppercase">{title}</h2>
          {subtitle && <p className="text-[11px] text-white/80 print:hidden">{subtitle}</p>}
        </div>
        {headerAction && <div className="shrink-0 print:hidden">{headerAction}</div>}
      </div>
      <div className="section-body p-4">{children}</div>
    </section>
  )
}

// Small bordered add button used in colored SectionCard/list headers —
// mirrors AdvancementEditableList's tone-header add button.
function HeaderAddButton({ onClick, children }) {
  return (
    <button
      type="button"
      className="shrink-0 rounded border border-white/40 px-2 py-1 text-[10px] font-semibold whitespace-nowrap text-white uppercase hover:bg-white/10 print:hidden"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// Click-to-edit primitive shared by every editable value on the Report —
// mirrors AdvancementEditableList's inline cell editing so the whole page
// (not just list sections) uses one consistent edit interaction.
function InlineEdit({ value, display, type = 'text', options, onCommit, className = '', inputClassName = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    if (String(draft) !== String(value ?? '')) onCommit(draft)
  }

  if (editing) {
    if (type === 'select') {
      return (
        <select
          autoFocus
          className={`rounded border border-hae-crimson px-1.5 py-0.5 text-sm outline-none ${inputClassName}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    }
    if (type === 'textarea') {
      return (
        <textarea
          autoFocus
          rows={2}
          className={`w-full rounded border border-hae-crimson px-1.5 py-0.5 text-sm outline-none ${inputClassName}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(value ?? '')
              setEditing(false)
            }
          }}
        />
      )
    }
    return (
      <input
        autoFocus
        type={type}
        className={`rounded border border-hae-crimson px-1.5 py-0.5 text-sm outline-none ${inputClassName}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur()
          if (e.key === 'Escape') {
            setDraft(value ?? '')
            setEditing(false)
          }
        }}
      />
    )
  }
  return (
    <button
      type="button"
      className={`text-left hover:text-hae-crimson print:pointer-events-none ${className}`}
      onClick={() => setEditing(true)}
    >
      {display}
    </button>
  )
}

function KpiTile({ label, value, goalLabel, status, goalValue, onCommitGoal }) {
  return (
    <div className="kpi-tile rounded-lg border border-hae-line bg-white p-4 print:break-inside-avoid">
      <p className="text-[10px] font-semibold tracking-wide text-hae-slate uppercase">{label}</p>
      <p className="kpi-value mt-1 font-display text-2xl text-hae-ink">{value}</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-hae-slate">
        {status && <span className={`inline-block h-2 w-2 rounded-full ${advancementProgramStatusDotClass(status)}`} />}
        {onCommitGoal ? (
          <span className="inline-flex items-center gap-1">
            Goal
            <InlineEdit
              value={goalValue}
              display={goalLabel}
              type="number"
              className="text-hae-slate underline decoration-dotted"
              inputClassName="w-20"
              onCommit={onCommitGoal}
            />
          </span>
        ) : (
          <span>{goalLabel}</span>
        )}
      </div>
    </div>
  )
}

function Sparkline({ values }) {
  if (!values.length) return <p className="text-xs text-hae-slate">No data yet.</p>
  const w = 220
  const h = 40
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const points = values
    .map((v, i) => `${(i / (values.length - 1 || 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full text-green-700">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const emptySummary = {}
const emptyMembership = {}

export default function AdvancementReport() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(emptySummary)
  const [membership, setMembership] = useState(emptyMembership)
  const [financials, setFinancials] = useState([])
  const [pipeline, setPipeline] = useState([])
  const [partnerships, setPartnerships] = useState([])
  const [wins, setWins] = useState([])
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [customSections, setCustomSections] = useState([])
  const [loadError, setLoadError] = useState('')
  const programsRef = useRef(null)

  const load = useCallback(async () => {
    setLoadError('')
    const sortByOrder = (list) => [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    try {
      const [
        summarySnap,
        membershipSnap,
        financialsSnap,
        pipelineSnap,
        partnershipsSnap,
        winsSnap,
        tasksSnap,
        eventsSnap,
        customSectionsSnap,
      ] = await Promise.all([
        getDoc(doc(db, 'trackerAdvancementSummary', 'main')),
        getDoc(doc(db, 'trackerAdvancementMembership', 'main')),
        getDocs(collection(db, 'trackerAdvancementFinancials')),
        getDocs(collection(db, 'trackerAdvancementPipeline')),
        getDocs(collection(db, 'trackerAdvancementPartnerships')),
        getDocs(collection(db, 'trackerAdvancementWins')),
        getDocs(collection(db, 'tasks')),
        getDocs(collection(db, 'trackerEvents')),
        getDocs(collection(db, 'trackerAdvancementCustomSections')),
      ])
      setSummary(summarySnap.exists() ? summarySnap.data() : {})
      setMembership(membershipSnap.exists() ? membershipSnap.data() : {})
      setFinancials(sortByOrder(financialsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      setPipeline(sortByOrder(pipelineSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      setPartnerships(sortByOrder(partnershipsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      setWins(sortByOrder(winsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      setTasks(tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setEvents(eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCustomSections(sortByOrder(customSectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    } catch (err) {
      setLoadError(err.message || 'Failed to load the Advancement report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const previous = document.title
    document.title = REPORT_TITLE
    return () => {
      document.title = previous
    }
  }, [])

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const highPriorityTasks = useMemo(() => {
    const list = tasks.filter(
      (t) =>
        normalizeTaskStatus(t.status) !== 'Complete' &&
        (effectivePriority(t) === 'HIGH' || (t.leadershipAttention && t.leadershipAttention !== 'None'))
    )
    list.sort((a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'))
    return list
  }, [tasks])

  const overdueTasks = useMemo(() => {
    const list = tasks.filter(
      (t) => normalizeTaskStatus(t.status) !== 'Complete' && t.dueDate && daysUntil(t.dueDate) < 0
    )
    list.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    return list
  }, [tasks])

  const comingUpEvents = useMemo(() => {
    const list = events.filter((e) => (e.eventDate || '') >= todayStr)
    list.sort((a, b) => (a.eventDate || '9999-99-99').localeCompare(b.eventDate || '9999-99-99'))
    return list.slice(0, 4)
  }, [events, todayStr])

  const financialTotals = useMemo(
    () =>
      financials.reduce(
        (acc, r) => ({
          current: acc.current + (Number(r.current) || 0),
          goal: acc.goal + (Number(r.goal) || 0),
          forecast: acc.forecast + (Number(r.forecast) || 0),
        }),
        { current: 0, goal: 0, forecast: 0 }
      ),
    [financials]
  )
  const pipelineTotal = useMemo(() => pipeline.reduce((s, r) => s + (Number(r.value) || 0), 0), [pipeline])
  const partnershipsCount = useMemo(
    () => partnerships.reduce((s, r) => s + (Number(r.activeOpportunities) || 0), 0),
    [partnerships]
  )

  const totalMembers = useMemo(
    () => ADVANCEMENT_MEMBERSHIP_TYPES.reduce((sum, t) => sum + (Number(membership[t.id]) || 0), 0),
    [membership]
  )
  const growthHistory = useMemo(
    () =>
      String(membership.growthSeries || '')
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v)),
    [membership.growthSeries]
  )
  const growthSeries = useMemo(() => [...growthHistory, totalMembers], [growthHistory, totalMembers])
  const previousTotalMembers = growthHistory.length ? growthHistory[growthHistory.length - 1] : null
  const growthRate =
    previousTotalMembers != null && previousTotalMembers > 0
      ? Math.round(((totalMembers - previousTotalMembers) / previousTotalMembers) * 1000) / 10
      : null

  const membersPct = pctToGoal(totalMembers, summary.totalMembersGoal)
  const revenuePct = pctToGoal(financialTotals.current, financialTotals.goal)
  const pipelinePct = pctToGoal(pipelineTotal, summary.pipelineGoal)
  const partnershipsPct = pctToGoal(partnershipsCount, summary.partnershipsGoal)

  const healthScore = useMemo(() => {
    const scores = []
    if (membersPct != null) scores.push(Math.min(100, membersPct))
    if (revenuePct != null) scores.push(Math.min(100, revenuePct))
    if (pipelinePct != null) scores.push(Math.min(100, pipelinePct))
    if (partnershipsPct != null) scores.push(Math.min(100, partnershipsPct))
    if (growthRate != null) scores.push(Math.max(0, Math.min(100, 50 + growthRate * 2)))
    if (!scores.length) return null
    return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
  }, [membersPct, revenuePct, pipelinePct, partnershipsPct, growthRate])
  const healthStatus = healthStatusFromScore(healthScore)

  const updateSummaryField = async (key, raw, numeric = false) => {
    const value = numeric ? Number(raw) || 0 : raw
    setSummary((s) => ({ ...s, [key]: value }))
    await setDoc(doc(db, 'trackerAdvancementSummary', 'main'), { [key]: value, updatedAt: serverTimestamp() }, { merge: true })
  }

  const updateMembershipField = async (key, raw, numeric = true) => {
    const value = numeric ? Number(raw) || 0 : raw
    setMembership((m) => ({ ...m, [key]: value }))
    await setDoc(doc(db, 'trackerAdvancementMembership', 'main'), { [key]: value, updatedAt: serverTimestamp() }, { merge: true })
  }

  const updatePipelineField = async (rowId, key, raw, numeric = false) => {
    const value = numeric ? Number(raw) || 0 : String(raw).trim()
    setPipeline((rows) => rows.map((r) => (r.id === rowId ? { ...r, [key]: value } : r)))
    await updateDoc(doc(db, 'trackerAdvancementPipeline', rowId), { [key]: value })
  }

  const addPipelineRow = async () => {
    const maxOrder = pipeline.reduce((m, r) => Math.max(m, r.order ?? 0), 0)
    const payload = { source: 'New Source', value: 0, stage: ADVANCEMENT_PIPELINE_STAGE_OPTIONS[0], order: maxOrder + 1 }
    const ref = await addDoc(collection(db, 'trackerAdvancementPipeline'), { ...payload, createdAt: serverTimestamp() })
    setPipeline((rows) => [...rows, { id: ref.id, ...payload }])
  }

  const removePipelineRow = async (rowId) => {
    if (!confirm('Delete this pipeline source? This action cannot be undone.')) return
    setPipeline((rows) => rows.filter((r) => r.id !== rowId))
    await deleteDoc(doc(db, 'trackerAdvancementPipeline', rowId))
  }

  const updateWinField = async (rowId, key, raw, numeric = false) => {
    const value = numeric ? Number(raw) || 0 : String(raw).trim()
    setWins((rows) => rows.map((r) => (r.id === rowId ? { ...r, [key]: value } : r)))
    await updateDoc(doc(db, 'trackerAdvancementWins', rowId), { [key]: value })
  }

  const addWinRow = async () => {
    const maxOrder = wins.reduce((m, r) => Math.max(m, r.order ?? 0), 0)
    const payload = { title: 'New win', date: todayStr, order: maxOrder + 1 }
    const ref = await addDoc(collection(db, 'trackerAdvancementWins'), { ...payload, createdAt: serverTimestamp() })
    setWins((rows) => [...rows, { id: ref.id, ...payload }])
  }

  const removeWinRow = async (rowId) => {
    if (!confirm('Delete this win? This action cannot be undone.')) return
    setWins((rows) => rows.filter((r) => r.id !== rowId))
    await deleteDoc(doc(db, 'trackerAdvancementWins', rowId))
  }

  const addCustomSection = async () => {
    const maxOrder = customSections.reduce((m, r) => Math.max(m, r.order ?? 0), 0)
    const payload = { title: 'New Section', columns: [{ id: 'col_1', label: 'Column 1', type: 'text' }], order: maxOrder + 1 }
    const ref = await addDoc(collection(db, 'trackerAdvancementCustomSections'), { ...payload, createdAt: serverTimestamp() })
    setCustomSections((rows) => [...rows, { id: ref.id, ...payload }])
  }

  const removeCustomSection = async (sectionId) => {
    if (!confirm('Delete this section? This action cannot be undone.')) return
    setCustomSections((rows) => rows.filter((r) => r.id !== sectionId))
    await deleteDoc(doc(db, 'trackerAdvancementCustomSections', sectionId))
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading report…</p>
  if (loadError) return <p className="text-sm text-hae-red">{loadError}</p>

  return (
    <div className="advancement-report space-y-4 print:space-y-1.5 print:text-black print:[color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
      <style>{PRINT_STYLES}</style>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-hae-line bg-white px-5 py-4 print:break-inside-avoid">
        <div>
          <h1 className="report-title font-display text-2xl text-hae-ink">{REPORT_TITLE}</h1>
          <p className="report-tagline text-sm text-hae-slate">Driving Growth. Building Community. Creating Impact.</p>
        </div>
        <img src="/hae-logo.webp" alt="Harvard Alumni Entrepreneurs" className="h-12 w-auto object-contain" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <span className="inline-flex items-center gap-1 text-sm text-hae-slate">
          As of
          <InlineEdit
            value={summary.asOfDate || ''}
            display={summary.asOfDate ? formatLongDate(summary.asOfDate) : 'Set date'}
            type="date"
            className="text-hae-ink underline decoration-dotted"
            onCommit={(v) => updateSummaryField('asOfDate', v)}
          />
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-md border border-hae-line p-2 text-hae-slate hover:border-hae-crimson hover:text-hae-crimson"
            title="Print"
            aria-label="Print"
            onClick={() => window.print()}
          >
            <PrinterIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-md border border-hae-line p-2 text-hae-slate hover:border-hae-crimson hover:text-hae-crimson"
            title="Export"
            aria-label="Export"
            onClick={() => window.print()}
          >
            <DownloadIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 print:gap-2">
        <KpiTile
          label="Total Members"
          value={totalMembers}
          goalLabel={summary.totalMembersGoal || 'No goal set'}
          goalValue={summary.totalMembersGoal}
          status={statusFromPct(membersPct)}
          onCommitGoal={(v) => updateSummaryField('totalMembersGoal', v, true)}
        />
        <KpiTile
          label="Total Revenue (YTD)"
          value={formatMoney(financialTotals.current)}
          goalLabel={financialTotals.goal ? formatMoney(financialTotals.goal) : 'No goal set'}
          status={statusFromPct(revenuePct)}
        />
        <KpiTile
          label="Revenue Pipeline"
          value={formatMoney(pipelineTotal)}
          goalLabel={summary.pipelineGoal ? formatMoney(summary.pipelineGoal) : 'No goal set'}
          goalValue={summary.pipelineGoal}
          status={statusFromPct(pipelinePct)}
          onCommitGoal={(v) => updateSummaryField('pipelineGoal', v, true)}
        />
        <KpiTile
          label="Strategic Partnerships"
          value={partnershipsCount}
          goalLabel={summary.partnershipsGoal || 'No goal set'}
          goalValue={summary.partnershipsGoal}
          status={statusFromPct(partnershipsPct)}
          onCommitGoal={(v) => updateSummaryField('partnershipsGoal', v, true)}
        />
        <KpiTile
          label="Open Action Items"
          value={highPriorityTasks.length}
          goalLabel={`${overdueTasks.length} Overdue`}
          status={overdueTasks.length > 0 ? 'Behind' : 'On Track'}
        />
        <KpiTile
          label="Overall Health Score"
          value={healthScore != null ? `${healthScore} / 100` : '—'}
          goalLabel={healthStatus || '—'}
          status={healthStatus}
        />
      </div>

      <AdvancementEditableList
        title="Financial Summary (YTD)"
        subtitle="Revenue by source — current, goal, forecast, and status."
        addLabel="+ Add Revenue Source"
        collectionPath="trackerAdvancementFinancials"
        tone="navy"
        totals
        columns={[
          { id: 'source', label: 'Revenue Source', type: 'text' },
          { id: 'current', label: 'Current', type: 'currency' },
          { id: 'goal', label: 'Goal', type: 'currency' },
          { id: 'forecast', label: 'Forecast', type: 'currency' },
          { id: 'status', label: 'Status', type: 'select', options: ADVANCEMENT_PROGRAM_STATUS_OPTIONS },
        ]}
      />

      <SectionCard
        title="Revenue Pipeline (by Source)"
        tone="purple"
        headerAction={<HeaderAddButton onClick={addPipelineRow}>+ Add Pipeline Source</HeaderAddButton>}
      >
        {pipeline.length === 0 ? (
          <p className="text-sm text-hae-slate">No pipeline entered yet.</p>
        ) : (
          <div className="space-y-2">
            {pipeline.map((r) => {
              const pct = pipelineTotal > 0 ? Math.max(4, Math.round(((Number(r.value) || 0) / pipelineTotal) * 100)) : 0
              return (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  <InlineEdit
                    value={r.source}
                    display={r.source || '—'}
                    className="w-24 shrink-0 truncate text-hae-slate"
                    onCommit={(v) => updatePipelineField(r.id, 'source', v)}
                  />
                  <div className="h-3 flex-1 rounded bg-hae-mist">
                    <div className={`h-3 rounded ${STAGE_COLORS[r.stage] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <InlineEdit
                    value={r.stage}
                    display={r.stage || '—'}
                    type="select"
                    options={ADVANCEMENT_PIPELINE_STAGE_OPTIONS}
                    className="w-20 shrink-0 text-right text-hae-slate"
                    onCommit={(v) => updatePipelineField(r.id, 'stage', v)}
                  />
                  <InlineEdit
                    value={r.value}
                    display={formatMoney(r.value)}
                    type="number"
                    className="w-14 shrink-0 text-right font-medium text-hae-ink"
                    onCommit={(v) => updatePipelineField(r.id, 'value', v, true)}
                  />
                  <button
                    type="button"
                    className="shrink-0 text-hae-slate/50 hover:text-hae-red print:hidden"
                    title="Delete row"
                    onClick={() => removePipelineRow(r.id)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
            <div className="mt-2 flex items-center justify-between border-t border-hae-line pt-2 text-sm font-semibold text-hae-ink">
              <span>Total Pipeline</span>
              <span>{formatMoney(pipelineTotal)}</span>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Membership Snapshot" tone="green">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {ADVANCEMENT_MEMBERSHIP_TYPES.map((t) => (
            <div key={t.id}>
              <p className="text-[10px] font-semibold tracking-wide text-hae-slate uppercase">{t.label}</p>
              <InlineEdit
                value={membership[t.id]}
                display={Number(membership[t.id]) || 0}
                type="number"
                className="font-display text-xl text-hae-ink"
                inputClassName="w-20"
                onCommit={(v) => updateMembershipField(t.id, v)}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hae-line pt-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-hae-slate uppercase">Total Members</p>
            <p className="font-display text-xl text-hae-ink">{totalMembers}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-hae-slate uppercase">Growth Rate</p>
            <p className={`font-display text-xl ${growthRate == null ? 'text-hae-ink' : growthRate >= 0 ? 'text-green-700' : 'text-hae-crimson'}`}>
              {growthRate != null ? `${growthRate > 0 ? '+' : ''}${growthRate}%` : '—'}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[10px] font-semibold tracking-wide text-hae-slate uppercase">Total Members — Trend</p>
          <Sparkline values={growthSeries} />
          <p className="mt-2 text-[11px] text-hae-slate print:hidden">
            History (comma-separated, oldest → most recent before today):{' '}
            <InlineEdit
              value={membership.growthSeries || ''}
              display={membership.growthSeries || 'Set history'}
              className="text-hae-ink underline decoration-dotted"
              inputClassName="w-64"
              onCommit={(v) => updateMembershipField('growthSeries', v, false)}
            />
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Revenue Generating Programs"
        subtitle="Financial impact — click a program for its full financial report, a cell to edit it, or a column header to rename/reorder."
        tone="navy"
        headerAction={<HeaderAddButton onClick={() => programsRef.current?.openAdd()}>+ Add Program</HeaderAddButton>}
      >
        <AdvancementProgramsTable ref={programsRef} bare />
      </SectionCard>

      <AdvancementEditableList
        title="Strategic Partnerships & Custom Programs (Pipeline)"
        subtitle="Active opportunities and pipeline value by partnership type."
        addLabel="+ Add Partnership Type"
        collectionPath="trackerAdvancementPartnerships"
        tone="purple"
        totals
        columns={[
          { id: 'type', label: 'Type', type: 'text' },
          { id: 'activeOpportunities', label: 'Active', type: 'number' },
          { id: 'pipelineValue', label: 'Pipeline Value', type: 'currency' },
          { id: 'nextSteps', label: 'Next Steps', type: 'textarea' },
        ]}
      />

      <AdvancementEditableList
        title="Mission Critical / Non-Revenue Programs"
        addLabel="+ Add Program"
        collectionPath="trackerAdvancementMissionPrograms"
        tone="ink"
        columns={[
          { id: 'name', label: 'Program', type: 'text' },
          { id: 'purpose', label: 'Purpose', type: 'textarea' },
          { id: 'reach', label: 'Reach', type: 'number' },
          { id: 'eventsSessions', label: 'Events/Sessions', type: 'number' },
          { id: 'participantsBeneficiaries', label: 'Participants/Beneficiaries', type: 'number' },
          { id: 'impactHighlights', label: 'Impact', type: 'textarea' },
        ]}
      />

      <SectionCard title="Quick View — High Priority Action Items" tone="orange">
        {highPriorityTasks.length === 0 ? (
          <p className="text-sm text-hae-slate">No high-priority action items.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {highPriorityTasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <Link to={`/my-tasks?task=${t.id}`} className="min-w-0 flex-1 truncate text-hae-ink hover:text-hae-crimson print:pointer-events-none">
                  {t.name}
                </Link>
                <span className="shrink-0 text-xs text-hae-slate">{formatDate(t.dueDate)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/my-tasks" className="mt-2 inline-block text-xs text-hae-crimson hover:underline print:hidden">
          View All Action Items →
        </Link>
      </SectionCard>

      <SectionCard title={`Overdue Items (${overdueTasks.length})`} tone="crimson">
        {overdueTasks.length === 0 ? (
          <p className="text-sm text-hae-slate">Nothing overdue.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {overdueTasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <Link to={`/my-tasks?task=${t.id}`} className="min-w-0 flex-1 truncate text-hae-ink hover:text-hae-crimson print:pointer-events-none">
                  {t.name}
                </Link>
                <span className="shrink-0 text-xs text-hae-slate">
                  Due {formatDate(t.dueDate)} · {namesLabel(t.owner) || 'Unassigned'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/my-tasks" className="mt-2 inline-block text-xs text-hae-crimson hover:underline print:hidden">
          View All Overdue Items →
        </Link>
      </SectionCard>

      <AdvancementEditableList
        title="Board Engagement & Contributions (YTD)"
        subtitle="Introductions, meetings, and opportunities created per board member."
        addLabel="+ Add Board Member"
        collectionPath="trackerAdvancementBoard"
        tone="navy"
        columns={[
          { id: 'member', label: 'Board Member', type: 'text' },
          { id: 'sponsorIntro', label: 'Sponsor Intro', type: 'number' },
          { id: 'donorIntro', label: 'Donor Intro', type: 'number' },
          { id: 'partnerIntro', label: 'Partner Intro', type: 'number' },
          { id: 'meetings', label: 'Meetings', type: 'number' },
          { id: 'opportunitiesCreated', label: 'Opportunities', type: 'number' },
          { id: 'status', label: 'Status', type: 'select', options: ADVANCEMENT_PROGRAM_STATUS_OPTIONS },
        ]}
      />

      <SectionCard title="Recent Wins" tone="ink">
        {wins.length === 0 ? (
          <p className="text-sm text-hae-slate">No recent wins entered yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
            {wins.map((w) => (
              <div key={w.id} className="rounded-md border border-hae-line p-2 text-xs">
                <div className="flex items-start justify-between gap-1">
                  <InlineEdit
                    value={w.title}
                    display={w.title || '—'}
                    type="textarea"
                    className="min-w-0 flex-1 text-hae-ink"
                    onCommit={(v) => updateWinField(w.id, 'title', v, false)}
                  />
                  <button
                    type="button"
                    className="shrink-0 text-hae-slate/50 hover:text-hae-red print:hidden"
                    title="Delete win"
                    onClick={() => removeWinRow(w.id)}
                  >
                    ×
                  </button>
                </div>
                <InlineEdit
                  value={w.date}
                  display={w.date || '—'}
                  className="mt-1 text-hae-slate"
                  onCommit={(v) => updateWinField(w.id, 'date', v, false)}
                />
              </div>
            ))}
          </div>
        )}
        <button type="button" className="mt-3 text-xs text-hae-crimson hover:underline print:hidden" onClick={addWinRow}>
          + Add Win
        </button>
      </SectionCard>

      <SectionCard title="Coming Up" tone="ink">
        {comingUpEvents.length === 0 ? (
          <p className="text-sm text-hae-slate">No upcoming events scheduled.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
            {comingUpEvents.map((e) => (
              <Link
                key={e.id}
                to={`/events-dashboard?event=${e.id}`}
                className="rounded-md border border-hae-line p-2 text-xs hover:border-hae-crimson print:pointer-events-none"
              >
                <p className="text-hae-ink">{e.name}</p>
                <p className="mt-1 text-hae-slate">{formatDate(e.eventDate)}</p>
              </Link>
            ))}
          </div>
        )}
        <Link to="/events-dashboard" className="mt-2 inline-block text-xs text-hae-crimson hover:underline print:hidden">
          View All Events →
        </Link>
      </SectionCard>

      {customSections.map((s) => (
        <AdvancementCustomSection key={s.id} section={s} onDeleted={() => removeCustomSection(s.id)} />
      ))}
      <button type="button" className="hae-btn print:hidden" onClick={addCustomSection}>
        + Add Section
      </button>

      <p className="text-[11px] text-hae-slate print:hidden">
        Action Items and Coming Up are pulled live from the Tracker — manage them in{' '}
        <Link to="/my-tasks" className="text-hae-crimson hover:underline">
          My Tasks
        </Link>{' '}
        and{' '}
        <Link to="/events-dashboard" className="text-hae-crimson hover:underline">
          Events Dashboard
        </Link>
        .
      </p>
    </div>
  )
}
