import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import AdvancementProgramsTable from '../components/AdvancementProgramsTable'
import AdvancementEditableList from '../components/AdvancementEditableList'
import {
  ADVANCEMENT_MEMBERSHIP_TYPES,
  ADVANCEMENT_PIPELINE_STAGE_OPTIONS,
  ADVANCEMENT_PROGRAM_STATUS_OPTIONS,
} from '../constants'

const fieldClass =
  'w-full rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson'

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

const emptySummary = {
  asOfDate: '',
  totalMembersGoal: '',
  pipelineGoal: '',
  partnershipsGoal: '',
}

const emptyMembership = {
  ...Object.fromEntries(ADVANCEMENT_MEMBERSHIP_TYPES.map((t) => [t.id, ''])),
  growthSeries: '',
}

function DocForm({ title, subtitle, docPath, empty, fields, numericKeys }) {
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, ...docPath))
      if (snap.exists()) setForm({ ...empty, ...snap.data() })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const payload = {}
      Object.keys(empty).forEach((k) => {
        const raw = form[k] ?? ''
        payload[k] = numericKeys.has(k) ? Number(raw) || 0 : raw
      })
      payload.updatedAt = serverTimestamp()
      await setDoc(doc(db, ...docPath), payload)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="px-4 py-6 text-sm text-hae-slate">Loading…</p>

  return (
    <section className="rounded-lg border border-hae-line bg-white print:hidden">
      <div className="border-b border-hae-line px-4 py-3">
        <h2 className="font-display text-lg text-hae-ink">{title}</h2>
        {subtitle && <p className="text-xs text-hae-slate">{subtitle}</p>}
      </div>
      <form onSubmit={submit} className="grid gap-3 p-4 sm:grid-cols-3">
        {fields.map((f) => (
          <Field key={f.id} label={f.label} className={f.wide ? 'sm:col-span-3' : ''}>
            {f.type === 'select' ? (
              <select className={fieldClass} value={form[f.id]} onChange={(e) => setForm({ ...form, [f.id]: e.target.value })}>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type || 'text'}
                className={fieldClass}
                value={form[f.id]}
                onChange={(e) => setForm({ ...form, [f.id]: e.target.value })}
              />
            )}
          </Field>
        ))}
        <div className="flex items-center gap-3 sm:col-span-3">
          <button type="submit" className="hae-btn disabled:opacity-60" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-xs text-hae-slate">Saved.</span>}
        </div>
      </form>
    </section>
  )
}

/**
 * Advancement — Enter Data. All manually-maintained sections of the board
 * report: header KPIs, Financial Summary, Revenue Pipeline, Membership
 * Snapshot, Revenue Generating Programs, Strategic Partnerships, Mission
 * Critical Programs, Board Engagement, Recent Wins. Action Items and
 * Upcoming Events are read live from the Tracker (tasks / trackerEvents) and
 * are not entered here.
 */
export default function AdvancementDataEntry() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-hae-crimson/30 bg-hae-crimson/5 px-4 py-3 text-sm text-hae-ink print:hidden">
        Action Items and Upcoming Events on the Report tab are pulled live from the Tracker — manage them in{' '}
        <Link to="/my-tasks" className="text-hae-crimson hover:underline">
          My Tasks
        </Link>{' '}
        and{' '}
        <Link to="/events-dashboard" className="text-hae-crimson hover:underline">
          Events Dashboard
        </Link>
        .
      </div>

      <DocForm
        title="Dashboard Summary"
        subtitle="Header KPI tile values shown on the Report tab. Total Members and the Health Score are computed automatically from the Membership Snapshot below."
        docPath={['trackerAdvancementSummary', 'main']}
        empty={emptySummary}
        numericKeys={new Set(['totalMembersGoal', 'pipelineGoal', 'partnershipsGoal'])}
        fields={[
          { id: 'asOfDate', label: 'As Of Date', type: 'date' },
          { id: 'totalMembersGoal', label: 'Total Members Goal', type: 'number' },
          { id: 'pipelineGoal', label: 'Revenue Pipeline Goal ($)', type: 'number' },
          { id: 'partnershipsGoal', label: 'Strategic Partnerships Goal', type: 'number' },
        ]}
      />

      <AdvancementEditableList
        title="Financial Summary (YTD)"
        subtitle="Revenue by source — current, goal, forecast, and status."
        addLabel="+ Add Revenue Source"
        collectionPath="trackerAdvancementFinancials"
        totals
        columns={[
          { id: 'source', label: 'Revenue Source', type: 'text' },
          { id: 'current', label: 'Current', type: 'currency' },
          { id: 'goal', label: 'Goal', type: 'currency' },
          { id: 'forecast', label: 'Forecast', type: 'currency' },
          { id: 'status', label: 'Status', type: 'select', options: ADVANCEMENT_PROGRAM_STATUS_OPTIONS },
        ]}
      />

      <AdvancementEditableList
        title="Revenue Pipeline (by Source)"
        subtitle="Open pipeline value per source and its current stage."
        addLabel="+ Add Pipeline Source"
        collectionPath="trackerAdvancementPipeline"
        totals
        columns={[
          { id: 'source', label: 'Source', type: 'text' },
          { id: 'value', label: 'Value', type: 'currency' },
          { id: 'stage', label: 'Stage', type: 'select', options: ADVANCEMENT_PIPELINE_STAGE_OPTIONS },
        ]}
      />

      <DocForm
        title="Membership Snapshot"
        subtitle="Enter the current count for each member type. Total Members, Growth Rate, and the Health Score are computed automatically on the Report tab. Growth Rate compares Total Members against the last value in the history field below."
        docPath={['trackerAdvancementMembership', 'main']}
        empty={emptyMembership}
        numericKeys={new Set(ADVANCEMENT_MEMBERSHIP_TYPES.map((t) => t.id))}
        fields={[
          ...ADVANCEMENT_MEMBERSHIP_TYPES.map((t) => ({ id: t.id, label: t.label, type: 'number' })),
          { id: 'growthSeries', label: 'Total Members History (Last 12 Months) — comma-separated', wide: true },
        ]}
      />

      <AdvancementProgramsTable />

      <AdvancementEditableList
        title="Strategic Partnerships & Custom Programs (Pipeline)"
        subtitle="Active opportunities and pipeline value by partnership type."
        addLabel="+ Add Partnership Type"
        collectionPath="trackerAdvancementPartnerships"
        totals
        columns={[
          { id: 'type', label: 'Type', type: 'text' },
          { id: 'activeOpportunities', label: 'Active Opportunities', type: 'number' },
          { id: 'pipelineValue', label: 'Pipeline Value', type: 'currency' },
          { id: 'nextSteps', label: 'Next Steps', type: 'textarea' },
        ]}
      />

      <AdvancementEditableList
        title="Mission Critical / Non-Revenue Programs"
        subtitle="Impact and engagement for programs that build community rather than revenue."
        addLabel="+ Add Program"
        collectionPath="trackerAdvancementMissionPrograms"
        columns={[
          { id: 'name', label: 'Program', type: 'text' },
          { id: 'purpose', label: 'Purpose', type: 'textarea' },
          { id: 'reach', label: 'Reach', type: 'number' },
          { id: 'eventsSessions', label: 'Events/Sessions', type: 'number' },
          { id: 'participantsBeneficiaries', label: 'Participants/Beneficiaries', type: 'number' },
          { id: 'impactHighlights', label: 'Impact Highlights', type: 'textarea' },
        ]}
      />

      <AdvancementEditableList
        title="Board Engagement & Contributions (YTD)"
        subtitle="Introductions, meetings, and opportunities created per board member."
        addLabel="+ Add Board Member"
        collectionPath="trackerAdvancementBoard"
        columns={[
          { id: 'member', label: 'Board Member', type: 'text' },
          { id: 'sponsorIntro', label: 'Sponsor Intro', type: 'number' },
          { id: 'donorIntro', label: 'Donor Intro', type: 'number' },
          { id: 'partnerIntro', label: 'Partner Intro', type: 'number' },
          { id: 'meetings', label: 'Meetings', type: 'number' },
          { id: 'opportunitiesCreated', label: 'Opportunities Created', type: 'number' },
          { id: 'status', label: 'Status', type: 'select', options: ADVANCEMENT_PROGRAM_STATUS_OPTIONS },
        ]}
      />

      <AdvancementEditableList
        title="Recent Wins"
        subtitle="Highlights to celebrate on the board report."
        addLabel="+ Add Win"
        collectionPath="trackerAdvancementWins"
        columns={[
          { id: 'title', label: 'Win', type: 'textarea' },
          { id: 'date', label: 'Date', type: 'text' },
        ]}
      />
    </div>
  )
}
