/** Project fundraising / budget metrics helpers (mirrors AMS money formatting). */

export const METRIC_TYPES = [
  { value: '', label: 'None' },
  { value: 'donation-drive', label: 'Donation drive' },
  { value: 'budget', label: 'Budget / spend' },
  { value: 'course-earnings', label: 'Course earnings' },
]

export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Waived', 'Comp', 'Overdue']

export function formatMoney(amountCents, currency = 'usd') {
  const cents = Number(amountCents)
  if (!Number.isFinite(cents)) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}

export function parseDollarsToCents(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.round(n * 100))
}

export function centsToDollarsInput(cents) {
  if (cents == null || cents === '') return ''
  const n = Number(cents)
  if (!Number.isFinite(n)) return ''
  return String(n / 100)
}

export function pctTowardGoal(raisedCents, goalCents) {
  const raised = Number(raisedCents) || 0
  const goal = Number(goalCents) || 0
  if (goal <= 0) return null
  return Math.min(999, Math.round((raised / goal) * 100))
}

export function hasProjectMetrics(project) {
  return Boolean(project?.metricType)
}

export function metricTypeLabel(metricType) {
  return METRIC_TYPES.find((t) => t.value === metricType)?.label || metricType || ''
}

/** Sum raised/goal across projects that have metrics. */
export function rollupProjectMetrics(projects) {
  let raised = 0
  let goal = 0
  let count = 0
  for (const p of projects || []) {
    if (!p.metricType) continue
    count += 1
    raised += Number(p.raisedCents) || 0
    goal += Number(p.goalCents) || 0
  }
  return { count, raisedCents: raised, goalCents: goal, pct: pctTowardGoal(raised, goal) }
}

/** Est. course earnings from enrollments + course price. */
export function courseEarningsCents(enrollments, coursesById) {
  let paid = 0
  let pending = 0
  for (const e of enrollments || []) {
    const course = coursesById?.[e.courseId]
    const cents =
      e.amountPaidCents != null && e.amountPaidCents !== ''
        ? Number(e.amountPaidCents)
        : Number(course?.priceCents) || 0
    if (!Number.isFinite(cents) || cents <= 0) continue
    const status = e.paymentStatus || 'Pending'
    if (status === 'Paid') paid += cents
    else if (status === 'Pending' || status === 'Overdue') pending += cents
  }
  return { paidCents: paid, pendingCents: pending }
}
