import { Link } from 'react-router-dom'

export default function PaymentCancel() {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <header>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Stripe · Membership
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink">Payment canceled</h1>
        <p className="mt-3 text-sm text-hae-slate">
          No charge was made. You can return to your membership and try Pay with
          Stripe again whenever you are ready.
        </p>
      </header>
      <Link
        to="/"
        className="inline-flex bg-hae-crimson px-3 py-2 text-sm font-semibold tracking-wide text-white uppercase hover:bg-hae-crimson-dark"
      >
        Back to my membership
      </Link>
    </div>
  )
}
