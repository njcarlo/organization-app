import { Link } from 'react-router-dom'

const STEPS = [
  {
    title: 'Find an SME',
    body: 'Use the Directory to browse expert profiles, explore expertise areas, or open LinkedIn.',
  },
  {
    title: 'Open the profile',
    body: 'You’ll land on the expert’s page with bio, expertise tags, and booking details.',
  },
  {
    title: 'Book a 30-minute meeting',
    body: 'Choose an available time slot that works for you via their booking link.',
  },
  {
    title: 'Provide meeting details',
    body: 'Fill out the booking form with a short description of your goals or questions so the SME can prepare.',
  },
  {
    title: 'Confirm and prepare',
    body: 'Once submitted, you’ll receive a calendar invite. If the SME approves, they’ll confirm via email.',
  },
  {
    title: 'Engage',
    body: 'Show up ready to dive in — focused, one-on-one mentorship.',
  },
]

export default function HowItWorks() {
  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <h1 className="font-display text-4xl text-hae-ink">How it works</h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Office Hours connects founders with seasoned experts for personalized guidance.
          Flow modeled after the public HAE Expert Directory (reference only).
        </p>
      </header>

      <section className="border border-hae-line bg-white p-6">
        <h2 className="font-display text-2xl text-hae-ink">Find an expert</h2>
        <p className="mt-2 text-sm text-hae-slate">
          Office Hours connects you with Subject Matter Experts (SMEs) who can help you
          overcome challenges and move your venture forward.
        </p>
        <ol className="mt-6 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-hae-crimson font-display text-sm text-white">
                {i + 1}
              </div>
              <div>
                <div className="text-sm font-semibold text-hae-ink">{step.title}</div>
                <p className="mt-1 text-sm text-hae-slate">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link
          to="/directory"
          className="mt-6 inline-block bg-hae-crimson px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
        >
          Browse directory
        </Link>
      </section>

      <p className="text-xs text-hae-slate">
        Reference:{' '}
        <a
          href="https://sites.google.com/harvardae.org/experts/home"
          target="_blank"
          rel="noreferrer"
          className="text-hae-crimson hover:underline"
        >
          sites.google.com/harvardae.org/experts
        </a>
        . Profiles in this app are staff-managed and independent of that site’s content.
      </p>
    </div>
  )
}
