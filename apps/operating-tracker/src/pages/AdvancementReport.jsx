import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import AdvancementProgramsTable from '../components/AdvancementProgramsTable'
import { ADVANCEMENT_MEMBERSHIP_TYPES } from '../constants'
import {
  advancementProgramStatusDotClass,
  daysUntil,
  effectivePriority,
  formatDate,
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

function SectionCard({ title, subtitle, tone = 'ink', children, className = '' }) {
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
      <div className={`section-header px-4 py-2.5 ${toneClass}`}>
        <h2 className="section-title font-display text-sm font-semibold tracking-wide text-white uppercase">{title}</h2>
        {subtitle && <p className="text-[11px] text-white/80 print:hidden">{subtitle}</p>}
      </div>
      <div className="section-body p-4">{children}</div>
    </section>
  )
}

function KpiTile({ label, value, goalLabel, status }) {
  return (
    <div className="kpi-tile rounded-lg border border-hae-line bg-white p-4 print:break-inside-avoid">
      <p className="text-[10px] font-semibold tracking-wide text-hae-slate uppercase">{label}</p>
      <p className="kpi-value mt-1 font-display text-2xl text-hae-ink">{value}</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-hae-slate">
        {status && <span className={`inline-block h-2 w-2 rounded-full ${advancementProgramStatusDotClass(status)}`} />}
        <span>{goalLabel}</span>
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

function EmptyRow({ children }) {
  return <p className="text-sm text-hae-slate">{children}</p>
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
  const [missionPrograms, setMissionPrograms] = useState([])
  const [board, setBoard] = useState([])
  const [wins, setWins] = useState([])
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])

  const load = useCallback(async () => {
    const sortByOrder = (list) => [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    const [
      summarySnap,
      membershipSnap,
      financialsSnap,
      pipelineSnap,
      partnershipsSnap,
      missionSnap,
      boardSnap,
      winsSnap,
      tasksSnap,
      eventsSnap,
    ] = await Promise.all([
      getDoc(doc(db, 'trackerAdvancementSummary', 'main')),
      getDoc(doc(db, 'trackerAdvancementMembership', 'main')),
      getDocs(collection(db, 'trackerAdvancementFinancials')),
      getDocs(collection(db, 'trackerAdvancementPipeline')),
      getDocs(collection(db, 'trackerAdvancementPartnerships')),
      getDocs(collection(db, 'trackerAdvancementMissionPrograms')),
      getDocs(collection(db, 'trackerAdvancementBoard')),
      getDocs(collection(db, 'trackerAdvancementWins')),
      getDocs(collection(db, 'tasks')),
      getDocs(collection(db, 'trackerEvents')),
    ])
    setSummary(summarySnap.exists() ? summarySnap.data() : {})
    setMembership(membershipSnap.exists() ? membershipSnap.data() : {})
    setFinancials(sortByOrder(financialsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    setPipeline(sortByOrder(pipelineSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    setPartnerships(sortByOrder(partnershipsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    setMissionPrograms(sortByOrder(missionSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    setBoard(sortByOrder(boardSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    setWins(sortByOrder(winsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    setTasks(tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setEvents(eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setLoading(false)
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
  const partnershipsPipeline = useMemo(
    () => partnerships.reduce((s, r) => s + (Number(r.pipelineValue) || 0), 0),
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

  if (loading) return <p className="text-sm text-hae-slate">Loading report…</p>

  return (
    <div className="advancement-report space-y-4 print:space-y-1.5 print:text-black print:[color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
      <style>{PRINT_STYLES}</style>

      <div className="flex items-center justify-between gap-3 print:hidden">
        <span className="text-sm text-hae-slate">As of {summary.asOfDate ? formatDate(summary.asOfDate) : '—'}</span>
        <button type="button" className="hae-btn" onClick={() => window.print()}>
          Print / Export
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-hae-line bg-white px-5 py-4 print:break-inside-avoid">
        <img src="/hae-logo.webp" alt="Harvard Alumni Entrepreneurs" className="h-12 w-auto object-contain" />
        <div>
          <h1 className="report-title font-display text-2xl text-hae-ink">{REPORT_TITLE}</h1>
          <p className="report-tagline text-sm text-hae-slate">Driving Growth. Building Community. Creating Impact.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 print:gap-2">
        <KpiTile
          label="Total Members"
          value={totalMembers}
          goalLabel={summary.totalMembersGoal ? `Goal ${summary.totalMembersGoal}` : 'No goal set'}
          status={statusFromPct(membersPct)}
        />
        <KpiTile
          label="Total Revenue (YTD)"
          value={formatMoney(financialTotals.current)}
          goalLabel={financialTotals.goal ? `Goal ${formatMoney(financialTotals.goal)}` : 'No goal set'}
          status={statusFromPct(revenuePct)}
        />
        <KpiTile
          label="Revenue Pipeline"
          value={formatMoney(pipelineTotal)}
          goalLabel={summary.pipelineGoal ? `Goal ${formatMoney(summary.pipelineGoal)}` : 'No goal set'}
          status={statusFromPct(pipelinePct)}
        />
        <KpiTile
          label="Strategic Partnerships"
          value={partnershipsCount}
          goalLabel={summary.partnershipsGoal ? `Goal ${summary.partnershipsGoal}` : 'No goal set'}
          status={statusFromPct(partnershipsPct)}
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

      <SectionCard title="Financial Summary (YTD)" tone="navy">
        {financials.length === 0 ? (
          <EmptyRow>No financial summary entered yet.</EmptyRow>
        ) : (
          <div className="hae-table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hae-line/80 text-left text-[10px] font-semibold tracking-wide text-hae-slate uppercase">
                  <th className="py-1.5 pr-2">Source</th>
                  <th className="py-1.5 pr-2 text-right">Current</th>
                  <th className="py-1.5 pr-2 text-right">Goal</th>
                  <th className="py-1.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {financials.map((r) => (
                  <tr key={r.id} className="border-b border-hae-line/60 last:border-0">
                    <td className="py-1.5 pr-2">{r.source}</td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(r.current)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(r.goal)}</td>
                    <td className="py-1.5 text-center">
                      <span className={`inline-block h-2 w-2 rounded-full ${advancementProgramStatusDotClass(r.status)}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-hae-line font-semibold text-hae-ink">
                  <td className="py-1.5 pr-2">TOTAL</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(financialTotals.current)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(financialTotals.goal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Revenue Pipeline (by Source)" tone="purple">
        {pipeline.length === 0 ? (
          <EmptyRow>No pipeline entered yet.</EmptyRow>
        ) : (
          <div className="space-y-2">
            {pipeline.map((r) => {
              const pct = pipelineTotal > 0 ? Math.max(4, Math.round(((Number(r.value) || 0) / pipelineTotal) * 100)) : 0
              return (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 truncate text-hae-slate">{r.source}</span>
                  <div className="h-3 flex-1 rounded bg-hae-mist">
                    <div className={`h-3 rounded ${STAGE_COLORS[r.stage] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-14 shrink-0 text-right font-medium text-hae-ink">{formatMoney(r.value)}</span>
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
              <p className="font-display text-xl text-hae-ink">{Number(membership[t.id]) || 0}</p>
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
        </div>
      </SectionCard>

      <SectionCard title="Revenue Generating Programs" subtitle="Financial impact — click a program for its full financial report." tone="navy">
        <AdvancementProgramsTable readOnly bare />
      </SectionCard>

      <SectionCard title="Strategic Partnerships &amp; Custom Programs (Pipeline)" tone="purple">
        {partnerships.length === 0 ? (
          <EmptyRow>No partnerships entered yet.</EmptyRow>
        ) : (
          <div className="hae-table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hae-line/80 text-left text-[10px] font-semibold tracking-wide text-hae-slate uppercase">
                  <th className="py-1.5 pr-2">Type</th>
                  <th className="py-1.5 pr-2 text-right">Active</th>
                  <th className="py-1.5 pr-2 text-right">Pipeline Value</th>
                  <th className="py-1.5">Next Steps</th>
                </tr>
              </thead>
              <tbody>
                {partnerships.map((r) => (
                  <tr key={r.id} className="border-b border-hae-line/60 last:border-0">
                    <td className="py-1.5 pr-2">{r.type}</td>
                    <td className="py-1.5 pr-2 text-right">{r.activeOpportunities}</td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(r.pipelineValue)}</td>
                    <td className="py-1.5 text-hae-slate">{r.nextSteps || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-hae-line font-semibold text-hae-ink">
                  <td className="py-1.5 pr-2">TOTAL</td>
                  <td className="py-1.5 pr-2 text-right">{partnershipsCount}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(partnershipsPipeline)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Mission Critical / Non-Revenue Programs" tone="ink">
        {missionPrograms.length === 0 ? (
          <EmptyRow>No mission-critical programs entered yet.</EmptyRow>
        ) : (
          <div className="hae-table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hae-line/80 text-left text-[10px] font-semibold tracking-wide text-hae-slate uppercase">
                  <th className="py-1.5 pr-2">Program</th>
                  <th className="py-1.5 pr-2 text-right">Reach</th>
                  <th className="py-1.5">Impact</th>
                </tr>
              </thead>
              <tbody>
                {missionPrograms.map((r) => (
                  <tr key={r.id} className="border-b border-hae-line/60 last:border-0">
                    <td className="py-1.5 pr-2 font-medium">{r.name}</td>
                    <td className="py-1.5 pr-2 text-right">{r.reach || '—'}</td>
                    <td className="py-1.5 text-hae-slate">{r.impactHighlights || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Quick View — High Priority Action Items" tone="orange">
        {highPriorityTasks.length === 0 ? (
          <EmptyRow>No high-priority action items.</EmptyRow>
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
          <EmptyRow>Nothing overdue.</EmptyRow>
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

      <SectionCard title="Board Engagement &amp; Contributions (YTD)" tone="navy">
        {board.length === 0 ? (
          <EmptyRow>No board engagement entered yet.</EmptyRow>
        ) : (
          <div className="hae-table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hae-line/80 text-left text-[10px] font-semibold tracking-wide text-hae-slate uppercase">
                  <th className="py-1.5 pr-2">Board Member</th>
                  <th className="py-1.5 pr-2 text-right">Meetings</th>
                  <th className="py-1.5 pr-2 text-right">Opportunities</th>
                  <th className="py-1.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r) => (
                  <tr key={r.id} className="border-b border-hae-line/60 last:border-0">
                    <td className="py-1.5 pr-2">{r.member}</td>
                    <td className="py-1.5 pr-2 text-right">{r.meetings || 0}</td>
                    <td className="py-1.5 pr-2 text-right">{r.opportunitiesCreated || 0}</td>
                    <td className="py-1.5 text-center">
                      <span className={`inline-block h-2 w-2 rounded-full ${advancementProgramStatusDotClass(r.status)}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent Wins" tone="ink">
        {wins.length === 0 ? (
          <EmptyRow>No recent wins entered yet.</EmptyRow>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
            {wins.map((w) => (
              <div key={w.id} className="rounded-md border border-hae-line p-2 text-xs">
                <p className="text-hae-ink">{w.title}</p>
                <p className="mt-1 text-hae-slate">{w.date}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Coming Up" tone="ink">
        {comingUpEvents.length === 0 ? (
          <EmptyRow>No upcoming events scheduled.</EmptyRow>
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
    </div>
  )
}
