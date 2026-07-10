import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Expert profile — public or member workspace.
 * @param {{ basePath?: string, publicMode?: boolean }} props
 */
export default function ExpertDetail({ basePath = '', publicMode = false }) {
  const { expertId } = useParams()
  const [expert, setExpert] = useState(null)
  const [loading, setLoading] = useState(true)
  const directoryPath = `${basePath}/directory` || '/directory'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'experts', expertId))
        if (cancelled) return
        setExpert(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      } catch {
        if (!cancelled) setExpert(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [expertId])

  if (loading) return <p className="text-sm text-hae-slate">Loading profile…</p>
  if (!expert || (publicMode && expert.status !== 'Active')) {
    return (
      <p className="text-sm text-hae-red">
        Expert not found.{' '}
        <Link to={directoryPath || '/directory'}>Back to directory</Link>
      </p>
    )
  }

  const bookable = expert.status === 'Active' && Boolean(expert.bookingUrl)
  const showEmail = !publicMode && Boolean(expert.email)

  return (
    <div className="space-y-6">
      <Link
        to={directoryPath || '/directory'}
        className="text-xs font-semibold text-hae-crimson"
      >
        ← Directory
      </Link>

      <div className="grid gap-6 border border-hae-line bg-white p-4 sm:p-6 lg:grid-cols-[160px_1fr]">
        {expert.photoUrl ? (
          <img
            src={expert.photoUrl}
            alt=""
            className="mx-auto h-40 w-40 object-cover lg:mx-0"
          />
        ) : (
          <div className="mx-auto flex h-40 w-40 items-center justify-center bg-hae-crimson/10 font-display text-5xl text-hae-crimson lg:mx-0">
            {(expert.name || '?').slice(0, 1)}
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">
              {expert.name}
            </h1>
            {!publicMode && expert.status && expert.status !== 'Active' ? (
              <span className="rounded bg-hae-mist px-2 py-0.5 text-[10px] font-semibold tracking-wide text-hae-slate uppercase">
                {expert.status}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-hae-slate">
            {expert.title || 'Expert'}
            {expert.organization ? ` · ${expert.organization}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {(expert.expertise || []).map((t) => (
              <span
                key={t}
                className="bg-hae-mist px-2 py-0.5 text-[11px] font-medium text-hae-slate"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {bookable ? (
              <a
                href={expert.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-hae-crimson px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
              >
                Book 30 minutes
              </a>
            ) : (
              <span className="border border-hae-line px-4 py-2.5 text-xs text-hae-slate">
                {expert.status !== 'Active'
                  ? 'Not currently available for booking'
                  : 'Booking link not set'}
              </span>
            )}
            {expert.linkedinUrl ? (
              <a
                href={expert.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="border border-hae-line px-4 py-2.5 text-xs font-semibold tracking-wide text-hae-ink uppercase"
              >
                LinkedIn
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {expert.bio ? (
        <section className="border border-hae-line bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-hae-slate">
            About
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-hae-ink">
            {expert.bio}
          </p>
        </section>
      ) : null}

      <section className="border border-hae-line bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-hae-slate">
          Before you book
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-hae-slate">
          <li>Share a short description of your goals or questions in the booking form.</li>
          <li>Meetings are typically 30 minutes of focused, one-on-one mentorship.</li>
          <li>Office Hours is intended for HAE alumni members.</li>
          {showEmail ? (
            <li>
              Questions for this expert:{' '}
              <a href={`mailto:${expert.email}`} className="text-hae-crimson">
                {expert.email}
              </a>
            </li>
          ) : null}
        </ul>
        {publicMode ? (
          <p className="mt-4 text-xs text-hae-slate">
            Scheduling is handled on the expert’s booking page for now. In-app scheduling
            is planned for a later release.
          </p>
        ) : null}
      </section>
    </div>
  )
}
