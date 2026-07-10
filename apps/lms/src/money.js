/** LMS money helpers (aligned with AMS / Tracker metrics). */

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
