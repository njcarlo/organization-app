import { Link } from 'react-router-dom'

const STEPS = [
  'Find an SME in the Directory',
  'Open their profile and review expertise',
  'Book a 30-minute meeting via their booking link',
  'Share goals in the booking form so they can prepare',
]

export default function PublicHome() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden border border-hae-line bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(184,0,40,0.14)_0%,_transparent_55%),linear-gradient(180deg,#fff_0%,#f6f6f6_100%)]"
        />
        <div className="relative px-5 py-12 sm:px-10 sm:py-16 md:py-20">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-hae-crimson uppercase">
            Harvard Alumni Entrepreneurs
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight text-hae-ink sm:text-5xl md:text-6xl">
            Expert Office Hours
          </h1>
          <p className="mt-4 max-w-2xl text-base text-hae-slate sm:text-lg">
            Connect founders with seasoned experts and a supportive community — personalized
            guidance, practical resources, and a pathway to move your venture forward.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/directory"
              className="bg-hae-crimson px-5 py-3 text-xs font-semibold tracking-wide text-white uppercase"
            >
              Find an expert
            </Link>
            <Link
              to="/how-it-works"
              className="border border-hae-line bg-white px-5 py-3 text-xs font-semibold tracking-wide text-hae-ink uppercase"
            >
              How it works
            </Link>
          </div>
          <p className="mt-6 text-sm text-hae-slate">
            Exclusively for HarvardAE alumni members.
          </p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="border border-hae-line bg-white p-6">
          <h2 className="font-display text-2xl text-hae-ink">Find an expert</h2>
          <p className="mt-2 text-sm text-hae-slate">
            Browse Subject Matter Experts (SMEs) who can help you overcome challenges and move
            your venture forward.
          </p>
          <ol className="mt-5 space-y-3">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-hae-slate">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-hae-crimson text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <Link
            to="/directory"
            className="mt-6 inline-block text-xs font-semibold tracking-wide text-hae-crimson uppercase hover:underline"
          >
            Browse directory →
          </Link>
        </div>

        <div className="border border-hae-line bg-white p-6">
          <h2 className="font-display text-2xl text-hae-ink">Members workspace</h2>
          <p className="mt-2 text-sm text-hae-slate">
            Signed-in members and staff can manage profiles, track the directory from the
            platform shell, and (later) use in-app scheduling.
          </p>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-hae-slate">
            <li>Public directory stays open for discovery</li>
            <li>Booking today uses each expert’s external booking link</li>
            <li>In-app scheduling will land in a later milestone</li>
          </ul>
          <Link
            to="/login"
            className="mt-6 inline-block border border-hae-line px-4 py-2.5 text-xs font-semibold tracking-wide text-hae-ink uppercase"
          >
            Member sign in
          </Link>
        </div>
      </section>
    </div>
  )
}
