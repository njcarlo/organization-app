import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useAuth } from '@hae/ui'
import { db } from '../firebase'
import { formatMoney, needsPayment } from '../constants'
import {
  buildStripeCheckoutUrl,
  loadMembershipPricing,
  newPaymentAttemptId,
  tierPricing,
} from '../membershipPricing'

/** Member-facing AMS home — membership dues + Stripe pay + upcoming events. */
export default function MemberHome() {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [memberships, setMemberships] = useState([])
  const [pricing, setPricing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState(null)
  const [payError, setPayError] = useState('')
  const email = (userProfile?.email || '').trim().toLowerCase()

  const load = useCallback(async () => {
    const eventSnap = await getDocs(collection(db, 'events'))
    let membershipList = []
    if (email) {
      const mSnap = await getDocs(
        query(collection(db, 'memberships'), where('memberEmail', '==', email))
      )
      membershipList = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    }
    const price = await loadMembershipPricing()
    setEvents(eventSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setMemberships(membershipList)
    setPricing(price)
    setLoading(false)
  }, [email])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await load()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return events
      .filter((ev) => !ev.date || ev.date >= today)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 8)
  }, [events])

  const startStripePay = async (membership) => {
    setPayError('')
    if (!pricing) return
    const tier = tierPricing(pricing, membership.tier)
    if (!tier.stripePaymentLinkUrl) {
      setPayError(
        'Stripe Payment Link is not configured for this tier yet. Please contact HAE staff.'
      )
      return
    }
    setPayingId(membership.id)
    try {
      const attemptId = newPaymentAttemptId()
      await updateDoc(doc(db, 'memberships', membership.id), {
        paymentAttemptId: attemptId,
        paymentAttemptAt: serverTimestamp(),
        amountDueCents: tier.amountCents,
        currency: pricing.currency,
      })
      const checkoutUrl = buildStripeCheckoutUrl({
        paymentLinkUrl: tier.stripePaymentLinkUrl,
        membershipId: membership.id,
        email,
        attemptId,
      })
      if (!checkoutUrl) {
        setPayError('Invalid Stripe Payment Link URL. Please contact staff.')
        setPayingId(null)
        return
      }
      window.location.assign(checkoutUrl)
    } catch (err) {
      setPayError(err?.message || 'Could not start Stripe checkout.')
      setPayingId(null)
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading…</p>

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Member · AMS
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl">
          My membership
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Welcome{userProfile?.name ? `, ${userProfile.name}` : ''}. View your
          membership status, pay dues with Stripe, and see upcoming HAE events.
        </p>
      </header>

      {payError ? (
        <p className="rounded-lg border border-hae-red/30 bg-red-50 px-3 py-2 text-sm text-hae-red">
          {payError}
        </p>
      ) : null}

      <section className="border border-hae-line bg-white">
        <div className="border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold">Memberships</h2>
        </div>
        {memberships.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">
            No membership records linked to {email || 'your account'} yet.
          </p>
        ) : (
          <ul className="divide-y divide-hae-line">
            {memberships.map((m) => {
              const tier = pricing ? tierPricing(pricing, m.tier) : null
              const amountCents = m.amountDueCents ?? tier?.amountCents
              const currency = m.currency || pricing?.currency || 'usd'
              const due = needsPayment(m)
              return (
                <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium capitalize">
                      {tier?.label || m.tier || m.type || 'Membership'}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-hae-slate">
                      <span>
                        Status:{' '}
                        <strong className="text-hae-ink">
                          {m.paymentStatus || 'Pending'}
                        </strong>
                      </span>
                      {m.renewalDate ? <span>Renewal {m.renewalDate}</span> : null}
                      {Number.isFinite(Number(amountCents)) ? (
                        <span>Dues {formatMoney(amountCents, currency)}</span>
                      ) : null}
                    </div>
                  </div>
                  {due ? (
                    <button
                      type="button"
                      className="hae-btn disabled:opacity-60"
                      disabled={payingId === m.id}
                      onClick={() => startStripePay(m)}
                    >
                      {payingId === m.id ? 'Redirecting…' : 'Pay with Stripe'}
                    </button>
                  ) : m.paymentStatus === 'Paid' ? (
                    <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-hae-green">
                      Paid
                    </span>
                  ) : (
                    <span className="rounded-md bg-hae-mist px-2.5 py-1 text-xs font-semibold text-hae-slate">
                      {m.paymentStatus}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="border border-hae-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hae-line px-4 py-3">
          <h2 className="text-sm font-semibold">Upcoming events</h2>
          <Link to="/events" className="text-xs font-semibold text-hae-crimson">
            View all
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hae-slate">No upcoming events.</p>
        ) : (
          <ul className="divide-y divide-hae-line">
            {upcoming.map((ev) => (
              <li key={ev.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{ev.name || ev.title}</div>
                <div className="text-xs text-hae-slate">
                  {ev.date || 'Date TBD'}
                  {ev.location ? ` · ${ev.location}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
