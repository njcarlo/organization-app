import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { moduleUrl } from '@hae/ui'
import { db } from '../firebase'

function normEmail(value) {
  return String(value || '').trim().toLowerCase()
}

/**
 * Staff-only panel: match CRM contact email to AMS members / LMS enrollments.
 */
export default function PersonLinks({ email }) {
  const key = normEmail(email)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!key) {
      setData(null)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [mSnap, eSnap, memSnap, cSnap] = await Promise.all([
          getDocs(collection(db, 'members')),
          getDocs(collection(db, 'enrollments')),
          getDocs(collection(db, 'memberships')),
          getDocs(collection(db, 'certificates')),
        ])
        if (cancelled) return
        const members = mSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => normEmail(m.email) === key)
        const enrollments = eSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((e) => normEmail(e.learnerEmail) === key)
        const memberships = memSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => normEmail(m.memberEmail) === key)
        const certificates = cSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => normEmail(c.learnerEmail) === key)
        setData({ members, enrollments, memberships, certificates })
      } catch (err) {
        if (!cancelled) setData({ error: err.message || 'Failed to load links' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  if (!key) {
    return (
      <p className="text-xs text-hae-slate">
        Add an email to see AMS membership and LMS enrollments for this person.
      </p>
    )
  }

  if (loading) {
    return <p className="text-xs text-hae-slate">Looking up linked records…</p>
  }

  if (data?.error) {
    return <p className="text-xs text-hae-red">{data.error}</p>
  }

  if (!data) return null

  const empty =
    !data.members.length &&
    !data.enrollments.length &&
    !data.memberships.length &&
    !data.certificates.length

  return (
    <div className="space-y-3 border border-hae-line bg-hae-mist/40 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
          Linked across platform
        </h3>
        <span className="text-[11px] text-hae-slate">{key}</span>
      </div>
      {empty ? (
        <p className="text-xs text-hae-slate">
          No AMS member or LMS enrollment matches this email yet. Use the same
          login email when creating members and enrollments.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <LinkBlock
            title="AMS members"
            href={moduleUrl('ams', '/members')}
            items={data.members.map((m) => ({
              id: m.id,
              label: m.name || 'Member',
              meta: [m.status, m.cohort, m.chapter].filter(Boolean).join(' · '),
            }))}
          />
          <LinkBlock
            title="AMS memberships"
            href={moduleUrl('ams', '/memberships')}
            items={data.memberships.map((m) => ({
              id: m.id,
              label: m.tier || m.memberName || 'Membership',
              meta: [m.status, m.renewalDate].filter(Boolean).join(' · '),
            }))}
          />
          <LinkBlock
            title="LMS enrollments"
            href={moduleUrl('lms', '/enrollments')}
            items={data.enrollments.map((e) => ({
              id: e.id,
              label: e.courseName || 'Course',
              meta: [e.status, e.path].filter(Boolean).join(' · '),
            }))}
          />
          <LinkBlock
            title="LMS certificates"
            href={moduleUrl('lms', '/certificates')}
            items={data.certificates.map((c) => ({
              id: c.id,
              label: c.courseName || 'Certificate',
              meta: c.status || '',
            }))}
          />
        </div>
      )}
    </div>
  )
}

function LinkBlock({ title, href, items }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-hae-ink">
          {title} ({items.length})
        </span>
        <a
          href={href}
          className="text-[11px] font-semibold text-hae-crimson hover:underline"
        >
          Open
        </a>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-hae-slate">None</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="text-xs text-hae-slate">
              <span className="font-medium text-hae-ink">{item.label}</span>
              {item.meta ? ` · ${item.meta}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
