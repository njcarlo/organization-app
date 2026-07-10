import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_MEMBERSHIP_PRICING,
  MEMBERSHIP_TIERS,
  formatMoney,
} from '../constants'
import {
  loadMembershipPricing,
  mergePricing,
  saveMembershipPricing,
} from '../membershipPricing'

const primaryBtn =
  'bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase hover:bg-hae-crimson-dark disabled:opacity-60'
const secondaryBtn =
  'border border-hae-line bg-white px-3 py-2 text-sm font-semibold text-hae-ink hover:bg-hae-mist'

/**
 * Staff: set dues amounts and paste Stripe Payment Link URLs per tier.
 * Create Payment Links in Stripe Dashboard → Payment links.
 */
export default function Pricing() {
  const [pricing, setPricing] = useState(DEFAULT_MEMBERSHIP_PRICING)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPricing(await loadMembershipPricing())
    } catch (err) {
      setError(err?.message || 'Could not load pricing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setTier = (tier, patch) => {
    setPricing((prev) => {
      const next = mergePricing(prev)
      next.tiers[tier] = { ...next.tiers[tier], ...patch }
      return next
    })
    setSaved(false)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const next = await saveMembershipPricing(pricing)
      setPricing(next)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Could not save pricing')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading pricing…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">
            Membership pricing
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-hae-slate">
            Set dues per tier and paste Stripe Payment Link URLs. Members pay
            through Stripe Checkout; unpaid memberships stay Pending until paid.
          </p>
        </div>
        <button type="button" className={secondaryBtn} onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? 'Hide setup' : 'Stripe setup'}
        </button>
      </header>

      {showHelp ? (
        <div className="space-y-3 border border-hae-line bg-white p-4 text-sm text-hae-ink">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              In the{' '}
              <a
                href="https://dashboard.stripe.com/payment-links"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-hae-crimson hover:underline"
              >
                Stripe Dashboard → Payment links
              </a>
              , create one Payment Link per membership tier (amount should match
              the dues below).
            </li>
            <li>
              Under After payment, set success redirect to{' '}
              <code className="rounded bg-hae-mist px-1 text-xs">
                https://hae-ams.web.app/payment/success
              </code>{' '}
              and cancel to{' '}
              <code className="rounded bg-hae-mist px-1 text-xs">
                https://hae-ams.web.app/payment/cancel
              </code>
              .
            </li>
            <li>
              Copy each Payment Link URL (starts with{' '}
              <code className="rounded bg-hae-mist px-1 text-xs">buy.stripe.com</code>
              ) into the table and Save.
            </li>
            <li>
              Members open <strong>My membership</strong> and click{' '}
              <strong>Pay with Stripe</strong>.
            </li>
          </ol>
          <p className="text-xs text-hae-slate">
            Works on Firebase Spark (no Cloud Functions). For webhook verification
            later, upgrade to Blaze and add a Stripe webhook endpoint.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="border border-hae-red/30 bg-red-50 px-3 py-2 text-sm text-hae-red">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="border border-hae-line bg-emerald-50 px-3 py-2 text-sm text-hae-green">
          Pricing saved.
        </p>
      ) : null}

      <form onSubmit={save} className="space-y-4">
        <label className="block max-w-xs">
          <span className="mb-1 block text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
            Currency
          </span>
          <select
            value={pricing.currency}
            onChange={(e) => {
              setPricing((p) => ({ ...p, currency: e.target.value }))
              setSaved(false)
            }}
            className="w-full border border-hae-line px-3 py-2 text-sm"
          >
            <option value="usd">USD</option>
            <option value="cad">CAD</option>
            <option value="eur">EUR</option>
            <option value="gbp">GBP</option>
          </select>
        </label>

        <div className="overflow-x-auto border border-hae-line bg-white">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Stripe Payment Link</th>
              </tr>
            </thead>
            <tbody>
              {MEMBERSHIP_TIERS.map((tier) => {
                const row = pricing.tiers[tier.value]
                return (
                  <tr key={tier.value} className="border-b border-hae-line/70">
                    <td className="px-3 py-3 text-sm font-medium capitalize">
                      {tier.label}
                      <div className="text-xs font-normal text-hae-slate">
                        {formatMoney(row.amountCents, pricing.currency)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-hae-slate">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={(row.amountCents / 100).toFixed(2)}
                          onChange={(e) =>
                            setTier(tier.value, {
                              amountCents: Math.round(
                                Math.max(0, Number(e.target.value) || 0) * 100
                              ),
                            })
                          }
                          className="w-28 border border-hae-line px-2 py-1.5 text-sm"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="url"
                        placeholder="https://buy.stripe.com/…"
                        value={row.stripePaymentLinkUrl}
                        onChange={(e) =>
                          setTier(tier.value, {
                            stripePaymentLinkUrl: e.target.value,
                          })
                        }
                        className="w-full min-w-[16rem] border border-hae-line px-2 py-1.5 text-sm"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button type="submit" className={primaryBtn} disabled={saving}>
          {saving ? 'Saving…' : 'Save pricing'}
        </button>
      </form>
    </div>
  )
}
