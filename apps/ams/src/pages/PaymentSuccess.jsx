import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useAuth } from '@hae/ui'
import { db } from '../firebase'
import { formatMoney, needsPayment } from '../constants'
import { loadMembershipPricing, tierPricing } from '../membershipPricing'

/**
 * Return URL after Stripe Payment Link success.
 * Confirms payment on the membership owned by the signed-in member.
 */
export default function PaymentSuccess() {
  const { userProfile } = useAuth()
  const [params] = useSearchParams()
  const [status, setStatus] = useState('working')
  const [message, setMessage] = useState('Confirming your payment…')
  const [summary, setSummary] = useState(null)

  const email = (userProfile?.email || '').trim().toLowerCase()
  const membershipIdFromQuery = useMemo(() => {
    const mid = params.get('mid') || params.get('membershipId') || ''
    const ref = params.get('client_reference_id') || ''
    if (mid) return mid
    if (ref.includes(':')) return ref.split(':')[0]
    return ref || ''
  }, [params])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!email) {
        setStatus('error')
        setMessage('Sign in with the email on your membership to confirm payment.')
        return
      }
      try {
        const pricing = await loadMembershipPricing()
        let membership = null

        if (membershipIdFromQuery) {
          const snap = await getDoc(doc(db, 'memberships', membershipIdFromQuery))
          if (snap.exists()) {
            membership = { id: snap.id, ...snap.data() }
          }
        }

        if (!membership) {
          const mSnap = await getDocs(
            query(collection(db, 'memberships'), where('memberEmail', '==', email))
          )
          const list = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          const recent = list
            .filter((m) => needsPayment(m) && m.paymentAttemptAt)
            .sort((a, b) => {
              const ta = a.paymentAttemptAt?.toMillis?.() || 0
              const tb = b.paymentAttemptAt?.toMillis?.() || 0
              return tb - ta
            })
          membership = recent[0] || list.find((m) => m.paymentStatus === 'Paid') || null
        }

        if (!membership) {
          setStatus('error')
          setMessage('Could not find a membership to update for your account.')
          return
        }

        if ((membership.memberEmail || '').toLowerCase() !== email) {
          setStatus('error')
          setMessage('This payment does not match your signed-in account.')
          return
        }

        const tier = tierPricing(pricing, membership.tier)
        const amountCents = membership.amountDueCents ?? tier.amountCents ?? 0

        if (membership.paymentStatus === 'Paid') {
          if (!cancelled) {
            setSummary({
              tier: membership.tier,
              amountCents,
              currency: pricing.currency,
            })
            setStatus('done')
            setMessage('This membership is already marked Paid. Thank you!')
          }
          return
        }

        if (membership.paymentStatus === 'Waived') {
          setStatus('done')
          setMessage('This membership is waived — no payment needed.')
          return
        }

        await updateDoc(doc(db, 'memberships', membership.id), {
          paymentStatus: 'Paid',
          paidAt: serverTimestamp(),
          paymentMethod: 'stripe',
          amountPaidCents: amountCents,
          currency: pricing.currency,
          stripeClientReference:
            params.get('client_reference_id') ||
            `${membership.id}:${membership.paymentAttemptId || ''}`,
        })

        if (!cancelled) {
          setSummary({
            tier: membership.tier,
            amountCents,
            currency: pricing.currency,
          })
          setStatus('done')
          setMessage('Payment received. Your membership is now Paid.')
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setMessage(err?.message || 'Could not confirm payment.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [email, membershipIdFromQuery, params])

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <header>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Stripe · Membership
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink">
          {status === 'working'
            ? 'Confirming…'
            : status === 'done'
              ? 'Thank you'
              : 'Payment issue'}
        </h1>
        <p className="mt-3 text-sm text-hae-slate">{message}</p>
      </header>

      {summary ? (
        <div className="rounded-xl border border-hae-line bg-white px-4 py-3 text-sm">
          <div className="font-medium capitalize">{summary.tier} membership</div>
          <div className="text-hae-slate">
            {formatMoney(summary.amountCents, summary.currency)}
          </div>
        </div>
      ) : null}

      <Link to="/" className="hae-btn inline-flex">
        Back to my membership
      </Link>
    </div>
  )
}
