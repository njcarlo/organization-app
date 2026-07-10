import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_MEMBERSHIP_PRICING, MEMBERSHIP_TIERS } from './constants'

export const PRICING_DOC = ['amsSettings', 'pricing']

export function mergePricing(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_MEMBERSHIP_PRICING))
  if (!raw || typeof raw !== 'object') return base
  if (raw.currency) base.currency = String(raw.currency).toLowerCase()
  for (const tier of MEMBERSHIP_TIERS) {
    const incoming = raw.tiers?.[tier.value]
    if (!incoming) continue
    base.tiers[tier.value] = {
      ...base.tiers[tier.value],
      label: incoming.label || base.tiers[tier.value].label || tier.label,
      amountCents:
        Number.isFinite(Number(incoming.amountCents))
          ? Math.max(0, Math.round(Number(incoming.amountCents)))
          : base.tiers[tier.value].amountCents,
      stripePaymentLinkUrl: String(incoming.stripePaymentLinkUrl || '').trim(),
    }
  }
  return base
}

export async function loadMembershipPricing() {
  const snap = await getDoc(doc(db, ...PRICING_DOC))
  return mergePricing(snap.exists() ? snap.data() : null)
}

export async function saveMembershipPricing(pricing) {
  const next = mergePricing(pricing)
  await setDoc(
    doc(db, ...PRICING_DOC),
    {
      ...next,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
  return next
}

export function tierPricing(pricing, tierValue) {
  const p = mergePricing(pricing)
  return (
    p.tiers[tierValue] || {
      label: tierValue,
      amountCents: 0,
      stripePaymentLinkUrl: '',
    }
  )
}

/**
 * Build a Stripe Payment Link URL with membership + email context.
 * Staff paste Payment Link URLs from the Stripe Dashboard (Products → Payment link).
 */
export function buildStripeCheckoutUrl({
  paymentLinkUrl,
  membershipId,
  email,
  attemptId,
}) {
  const raw = String(paymentLinkUrl || '').trim()
  if (!raw) return null
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const reference =
    membershipId && attemptId
      ? `${membershipId}:${attemptId}`
      : membershipId || attemptId || ''
  if (reference) url.searchParams.set('client_reference_id', reference)
  if (email) url.searchParams.set('prefilled_email', email)
  return url.toString()
}

export function newPaymentAttemptId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  return `pay${Date.now().toString(36)}`
}
