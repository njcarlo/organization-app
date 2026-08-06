import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import AdvancementProgramsTable from '../components/AdvancementProgramsTable'
import AdvancementEditableList from '../components/AdvancementEditableList'
import AdvancementPartnershipDetailCard from '../components/AdvancementPartnershipDetailCard'
import AdvancementCustomSection from '../components/AdvancementCustomSection'
import { DownloadIcon, PrinterIcon } from '../components/ActionIcons'
import {
  ADVANCEMENT_MEMBERSHIP_TYPES,
  ADVANCEMENT_PIPELINE_STAGE_OPTIONS,
  ADVANCEMENT_PROGRAM_STATUS_OPTIONS,
  ADVANCEMENT_PARTNERSHIP_TYPE_OPTIONS,
  ADVANCEMENT_PARTNERSHIP_STATUS_OPTIONS,
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
  /* Rounded card corners that sit flush against the printable-area edge
     (e.g. the last KPI tile in a row, or a full-width section's right
     edge) get their border/corner sliced off by the page's clip boundary
     due to print-time subpixel rounding. A small inset keeps every card
     fully inside the page regardless of grid/column math. */
  .advancement-report {
    width: calc(100% - 6px);
    margin-inline: auto;
  }
  /* border-hae-line (#e7e7e7) is a deliberately faint hairline for screen
     use, but printers/PDF renderers compress light grays even further —
     the row and card dividers become effectively invisible on paper.
     Strengthen just the color/weight for print; sizing, padding, and font
     stay exactly as the editing view renders them. */
  .advancement-report table tr,
  .advancement-report table th,
  .advancement-report table td,
  .advancement-report section {
    border-color: #9a9a9a !important;
  }
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

// Section header color options — shared by SectionCard and toned
// AdvancementEditableList headers so both offer the same palette.
const TONE_OPTIONS = [
  { key: 'navy', label: 'Navy', class: 'bg-blue-900' },
  { key: 'green', label: 'Green', class: 'bg-green-800' },
  { key: 'purple', label: 'Purple', class: 'bg-purple-800' },
  { key: 'crimson', label: 'Crimson', class: 'bg-hae-crimson' },
  { key: 'orange', label: 'Orange', class: 'bg-amber-700' },
  { key: 'ink', label: 'Ink', class: 'bg-hae-ink' },
]

function toneClassFor(tone) {
  return TONE_OPTIONS.find((t) => t.key === tone)?.class || 'bg-hae-ink'
}

// Color swatches shown alongside a header title while it's being edited —
// mousedown preventDefault keeps the title input focused (and edit mode open)
// so picking a color doesn't immediately blur/close the editor.
function ToneSwatches({ value, onChange }) {
  return (
    <div className="mt-1 flex items-center gap-1 print:hidden">
      {TONE_OPTIONS.map((t) => (
        <button
          key={t.key}
          type="button"
          title={t.label}
          aria-label={`Set header color to ${t.label}`}
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

// Editable header title used by colored section headers (white text over a
// tone background) — SectionCard and toned AdvancementEditableList headers.
function EditableHeaderTitle({ value, onCommit, tone, onToneCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onCommit(trimmed)
  }

  if (editing) {
    return (
      <div>
        <input
          autoFocus
          className="section-title w-full rounded border border-white/60 bg-white/10 px-1.5 py-0.5 font-display text-sm font-semibold tracking-wide text-white uppercase outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
        />
        {onToneCommit && <ToneSwatches value={tone} onChange={onToneCommit} />}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="section-title font-display text-sm font-semibold tracking-wide text-white uppercase hover:text-white/80 print:pointer-events-none"
      onClick={() => setEditing(true)}
    >
      {value}
    </button>
  )
}

function SectionCard({ title, tone = 'ink', headerAction, children, className = '', bodyClassName = 'p-4', onTitleCommit, onToneCommit }) {
  const toneClass = toneClassFor(tone)
  return (
    <section className={`rounded-lg border border-hae-line bg-white print:break-inside-avoid ${className}`}>
      <div className={`section-header rounded-t-lg flex items-center justify-between gap-3 px-4 py-2.5 ${toneClass}`}>
        <div className="min-w-0 flex-1">
          {onTitleCommit ? (
            <EditableHeaderTitle value={title} onCommit={onTitleCommit} tone={tone} onToneCommit={onToneCommit} />
          ) : (
            <h2 className="section-title font-display text-sm font-semibold tracking-wide text-white uppercase">{title}</h2>
          )}
        </div>
        {headerAction && <div className="shrink-0 print:hidden">{headerAction}</div>}
      </div>
      <div className={`section-body overflow-hidden rounded-b-lg ${bodyClassName}`}>{children}</div>
    </section>
  )
}

// Small drag-handle bar rendered above each reorderable section — grabbing it
// picks up the whole section; dropping on another section's handle/body swaps
// their positions in `sectionOrder`.
function GripIcon() {
  return (
    <svg width="14" height="8" viewBox="0 0 14 8" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="2" r="1.3" />
      <circle cx="7" cy="2" r="1.3" />
      <circle cx="12" cy="2" r="1.3" />
      <circle cx="2" cy="6" r="1.3" />
      <circle cx="7" cy="6" r="1.3" />
      <circle cx="12" cy="6" r="1.3" />
    </svg>
  )
}

function DraggableSection({ sectionKey, draggedKey, overKey, onDragStart, onDragOver, onDrop, onDragEnd, children }) {
  const isOver = overKey === sectionKey && draggedKey !== sectionKey
  const isDragging = draggedKey === sectionKey
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(sectionKey)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(sectionKey)
      }}
      className={`rounded-lg transition ${isOver ? 'outline-2 outline-dashed outline-offset-2 outline-hae-crimson/50' : ''} ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          onDragStart(sectionKey)
        }}
        onDragEnd={onDragEnd}
        className="flex justify-center print:hidden"
      >
        <span className="flex h-4 w-9 cursor-grab items-center justify-center rounded-t-md border border-b-0 border-hae-line/60 bg-hae-mist/60 text-hae-slate/50 hover:text-hae-slate active:cursor-grabbing">
          <GripIcon />
        </span>
      </div>
      {children}
    </div>
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
  const [draggedSectionKey, setDraggedSectionKey] = useState(null)
  const [dragOverSectionKey, setDragOverSectionKey] = useState(null)
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
    () => partnerships.filter((r) => r.status === 'Approved').length,
    [partnerships]
  )

  const totalMembers = useMemo(
    () => ADVANCEMENT_MEMBERSHIP_TYPES.reduce((sum, t) => sum + (Number(membership[t.id]) || 0), 0),
    [membership]
  )
  const previousTotalMembers =
    membership.previousTotalMembers != null ? Number(membership.previousTotalMembers) : null
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

  const sectionTitle = (key, fallback) => summary.sectionTitles?.[key] || fallback

  const commitSectionTitle = async (key, raw) => {
    const trimmed = String(raw).trim()
    if (!trimmed) return
    setSummary((s) => ({ ...s, sectionTitles: { ...(s.sectionTitles || {}), [key]: trimmed } }))
    await setDoc(
      doc(db, 'trackerAdvancementSummary', 'main'),
      { sectionTitles: { [key]: trimmed }, updatedAt: serverTimestamp() },
      { merge: true }
    )
  }

  const sectionTone = (key, fallback) => summary.sectionTones?.[key] || fallback

  const commitSectionTone = async (key, tone) => {
    setSummary((s) => ({ ...s, sectionTones: { ...(s.sectionTones || {}), [key]: tone } }))
    await setDoc(
      doc(db, 'trackerAdvancementSummary', 'main'),
      { sectionTones: { [key]: tone }, updatedAt: serverTimestamp() },
      { merge: true }
    )
  }

  const defaultSectionKeys = useMemo(
    () => [
      'financialSummary',
      'revenuePipeline',
      'membershipSnapshot',
      'revenuePrograms',
      'partnerships',
      'missionPrograms',
      'highPriorityActionItems',
      'overdueItems',
      'boardEngagement',
      'recentWins',
      'comingUp',
      ...customSections.map((s) => `custom:${s.id}`),
    ],
    [customSections]
  )

  const orderedSectionKeys = useMemo(() => {
    const saved = Array.isArray(summary.sectionOrder) ? summary.sectionOrder : []
    const known = new Set(defaultSectionKeys)
    const ordered = saved.filter((k) => known.has(k))
    defaultSectionKeys.forEach((k) => {
      if (!ordered.includes(k)) ordered.push(k)
    })
    return ordered
  }, [summary.sectionOrder, defaultSectionKeys])

  const handleSectionDragStart = (key) => setDraggedSectionKey(key)
  const handleSectionDragOver = (key) => {
    if (key !== draggedSectionKey) setDragOverSectionKey(key)
  }
  const handleSectionDragEnd = () => {
    setDraggedSectionKey(null)
    setDragOverSectionKey(null)
  }
  const handleSectionDrop = async (key) => {
    const from = draggedSectionKey
    handleSectionDragEnd()
    if (!from || from === key) return
    const next = [...orderedSectionKeys]
    const fromIdx = next.indexOf(from)
    const toIdx = next.indexOf(key)
    if (fromIdx === -1 || toIdx === -1) return
    next.splice(toIdx, 0, next.splice(fromIdx, 1)[0])
    setSummary((s) => ({ ...s, sectionOrder: next }))
    await setDoc(doc(db, 'trackerAdvancementSummary', 'main'), { sectionOrder: next, updatedAt: serverTimestamp() }, { merge: true })
  }

  const updateMembershipField = async (key, raw, numeric = true) => {
    const value = numeric ? Number(raw) || 0 : raw
    const today = new Date().toISOString().slice(0, 10)
    const isMemberCount = ADVANCEMENT_MEMBERSHIP_TYPES.some((t) => t.id === key)
    const snapshot =
      isMemberCount && membership.lastEditDate !== today
        ? { previousTotalMembers: totalMembers, previousTotalMembersDate: membership.lastEditDate || null, lastEditDate: today }
        : {}
    setMembership((m) => ({ ...m, [key]: value, ...snapshot }))
    await setDoc(
      doc(db, 'trackerAdvancementMembership', 'main'),
      { [key]: value, ...snapshot, updatedAt: serverTimestamp() },
      { merge: true }
    )
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

      <div className="flex flex-wrap items-center justify-between gap-3 print:justify-start">
        <span className="report-as-of inline-flex items-center gap-1 text-sm text-hae-slate print:text-black">
          As of
          <InlineEdit
            value={summary.asOfDate || ''}
            display={summary.asOfDate ? formatLongDate(summary.asOfDate) : 'Set date'}
            type="date"
            className="text-hae-ink underline decoration-dotted print:text-black print:no-underline"
            onCommit={(v) => updateSummaryField('asOfDate', v)}
          />
        </span>
        <div className="flex items-center gap-1.5 print:hidden">
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

      {(() => {
        const sectionNodes = {}

        sectionNodes.financialSummary = (
          <AdvancementEditableList
            title={sectionTitle('financialSummary', 'Financial Summary (YTD)')}
            onTitleCommit={(v) => commitSectionTitle('financialSummary', v)}
            addLabel="+ Add Revenue Source"
            collectionPath="trackerAdvancementFinancials"
            tone={sectionTone('financialSummary', 'navy')}
            onToneCommit={(t) => commitSectionTone('financialSummary', t)}
            totals
            columns={[
              { id: 'source', label: 'Revenue Source', type: 'text' },
              { id: 'current', label: 'Current', type: 'currency' },
              { id: 'goal', label: 'Goal', type: 'currency' },
              { id: 'forecast', label: 'Forecast', type: 'currency' },
              { id: 'status', label: 'Status', type: 'select', options: ADVANCEMENT_PROGRAM_STATUS_OPTIONS },
            ]}
          />
        )

        sectionNodes.revenuePipeline = (
      <SectionCard
        title={sectionTitle('revenuePipeline', 'Revenue Pipeline (by Source)')}
        onTitleCommit={(v) => commitSectionTitle('revenuePipeline', v)}
        tone={sectionTone('revenuePipeline', 'purple')}
        onToneCommit={(t) => commitSectionTone('revenuePipeline', t)}
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
        )

        sectionNodes.membershipSnapshot = (
      <SectionCard
        title={sectionTitle('membershipSnapshot', 'Membership Snapshot')}
        onTitleCommit={(v) => commitSectionTitle('membershipSnapshot', v)}
        tone={sectionTone('membershipSnapshot', 'green')}
        onToneCommit={(t) => commitSectionTone('membershipSnapshot', t)}
      >
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
            {previousTotalMembers != null && (
              <p className="mt-0.5 text-[10px] text-hae-slate">
                vs {previousTotalMembers}{membership.previousTotalMembersDate ? ` on ${membership.previousTotalMembersDate}` : ' previously'}
              </p>
            )}
          </div>
        </div>
      </SectionCard>
        )

        sectionNodes.revenuePrograms = (
      <SectionCard
        title={sectionTitle('revenuePrograms', 'Revenue Generating Programs')}
        onTitleCommit={(v) => commitSectionTitle('revenuePrograms', v)}
        tone={sectionTone('revenuePrograms', 'navy')}
        onToneCommit={(t) => commitSectionTone('revenuePrograms', t)}
        headerAction={<HeaderAddButton onClick={() => programsRef.current?.openAdd()}>+ Add Program</HeaderAddButton>}
        bodyClassName="p-0"
      >
        <AdvancementProgramsTable ref={programsRef} bare />
      </SectionCard>
        )

        sectionNodes.partnerships = (
      <AdvancementEditableList
        title={sectionTitle('partnerships', 'Strategic Partnerships & Custom Programs (Pipeline)')}
        onTitleCommit={(v) => commitSectionTitle('partnerships', v)}
        addLabel="+ Add Partnership Type"
        collectionPath="trackerAdvancementPartnerships"
        tone={sectionTone('partnerships', 'purple')}
        onToneCommit={(t) => commitSectionTone('partnerships', t)}
        totals
        supportsLinks
        columns={[
          { id: 'partnerName', label: 'Name of Partner', type: 'text' },
          { id: 'type', label: 'Type', type: 'select', options: ADVANCEMENT_PARTNERSHIP_TYPE_OPTIONS },
          { id: 'programName', label: 'Name of Course / Program', type: 'text' },
          { id: 'pipelineValue', label: 'Pipeline Value', type: 'currency' },
          { id: 'status', label: 'Status', type: 'select', options: ADVANCEMENT_PARTNERSHIP_STATUS_OPTIONS },
          { id: 'nextSteps', label: 'Next Steps', type: 'textarea' },
        ]}
        renderDetail={(row, { onClose, onChanged, onDeleted }) => (
          <AdvancementPartnershipDetailCard
            partnership={row}
            onClose={onClose}
            onChanged={onChanged}
            onDeleted={onDeleted}
          />
        )}
      />
        )

        sectionNodes.missionPrograms = (
      <AdvancementEditableList
        title={sectionTitle('missionPrograms', 'Mission Critical / Non-Revenue Programs')}
        onTitleCommit={(v) => commitSectionTitle('missionPrograms', v)}
        addLabel="+ Add Program"
        collectionPath="trackerAdvancementMissionPrograms"
        tone={sectionTone('missionPrograms', 'ink')}
        onToneCommit={(t) => commitSectionTone('missionPrograms', t)}
        columns={[
          { id: 'name', label: 'Program', type: 'text' },
          { id: 'purpose', label: 'Purpose', type: 'textarea' },
          { id: 'reach', label: 'Reach', type: 'number' },
          { id: 'eventsSessions', label: 'Events/Sessions', type: 'number' },
          { id: 'participantsBeneficiaries', label: 'Participants/Beneficiaries', type: 'number' },
          { id: 'impactHighlights', label: 'Impact', type: 'textarea' },
        ]}
      />
        )

        sectionNodes.highPriorityActionItems = (
      <SectionCard
        title={sectionTitle('highPriorityActionItems', 'Quick View — High Priority Action Items')}
        onTitleCommit={(v) => commitSectionTitle('highPriorityActionItems', v)}
        tone={sectionTone('highPriorityActionItems', 'orange')}
        onToneCommit={(t) => commitSectionTone('highPriorityActionItems', t)}
      >
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
        )

        sectionNodes.overdueItems = (
      <SectionCard
        title={sectionTitle('overdueItems', `Overdue Items (${overdueTasks.length})`)}
        onTitleCommit={(v) => commitSectionTitle('overdueItems', v)}
        tone={sectionTone('overdueItems', 'crimson')}
        onToneCommit={(t) => commitSectionTone('overdueItems', t)}
      >
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
        )

        sectionNodes.boardEngagement = (
      <AdvancementEditableList
        title={sectionTitle('boardEngagement', 'Board Engagement & Contributions (YTD)')}
        onTitleCommit={(v) => commitSectionTitle('boardEngagement', v)}
        addLabel="+ Add Board Member"
        collectionPath="trackerAdvancementBoard"
        tone={sectionTone('boardEngagement', 'navy')}
        onToneCommit={(t) => commitSectionTone('boardEngagement', t)}
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
        )

        sectionNodes.recentWins = (
      <SectionCard
        title={sectionTitle('recentWins', 'Recent Wins')}
        onTitleCommit={(v) => commitSectionTitle('recentWins', v)}
        tone={sectionTone('recentWins', 'ink')}
        onToneCommit={(t) => commitSectionTone('recentWins', t)}
      >
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
        )

        sectionNodes.comingUp = (
      <SectionCard
        title={sectionTitle('comingUp', 'Coming Up')}
        onTitleCommit={(v) => commitSectionTitle('comingUp', v)}
        tone={sectionTone('comingUp', 'ink')}
        onToneCommit={(t) => commitSectionTone('comingUp', t)}
      >
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
        )

        customSections.forEach((s) => {
          sectionNodes[`custom:${s.id}`] = (
            <AdvancementCustomSection section={s} onDeleted={() => removeCustomSection(s.id)} />
          )
        })

        return orderedSectionKeys.map((key) => (
          <DraggableSection
            key={key}
            sectionKey={key}
            draggedKey={draggedSectionKey}
            overKey={dragOverSectionKey}
            onDragStart={handleSectionDragStart}
            onDragOver={handleSectionDragOver}
            onDrop={handleSectionDrop}
            onDragEnd={handleSectionDragEnd}
          >
            {sectionNodes[key]}
          </DraggableSection>
        ))
      })()}

      <div className="print:hidden">
        <button type="button" className="hae-btn" onClick={addCustomSection}>
          + Add Section
        </button>
      </div>

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
