export const MEMBER_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'lapsed', label: 'Lapsed' },
  { value: 'alumni', label: 'Alumni' },
]

export const MEMBERSHIP_TIERS = [
  { value: 'standard', label: 'Standard' },
  { value: 'patron', label: 'Patron' },
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'student', label: 'Student' },
]

export const PAYMENT_STATUSES = ['Paid', 'Pending', 'Overdue', 'Waived']

export const COMMITTEE_ROLES = ['Chair', 'Vice Chair', 'Member', 'Advisor']

/** Default USD prices (cents) — override in AMS → Pricing via Stripe Payment Links. */
export const DEFAULT_MEMBERSHIP_PRICING = {
  currency: 'usd',
  tiers: {
    standard: {
      label: 'Standard',
      amountCents: 7500,
      stripePaymentLinkUrl: '',
    },
    patron: {
      label: 'Patron',
      amountCents: 25000,
      stripePaymentLinkUrl: '',
    },
    lifetime: {
      label: 'Lifetime',
      amountCents: 50000,
      stripePaymentLinkUrl: '',
    },
    student: {
      label: 'Student',
      amountCents: 2500,
      stripePaymentLinkUrl: '',
    },
  },
}

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

export function needsPayment(membership) {
  const status = membership?.paymentStatus || 'Pending'
  return status === 'Pending' || status === 'Overdue'
}
