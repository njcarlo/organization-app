import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { moduleUrl } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { formatDate, sortByPriorityThenDue } from '../utils'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function Notifications() {
  const { user, userProfile, isStaff } = useAuth()
  const [tasks, setTasks] = useState([])
  const [checkIns, setCheckIns] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const email = (user?.email || '').toLowerCase()
      const checkQuery = isStaff
        ? collection(db, 'checkIns')
        : email
          ? query(
              collection(db, 'checkIns'),
              where('learnerEmail', '==', email)
            )
          : null
      const [taskSnap, checkSnap] = await Promise.all([
        getDocs(collection(db, 'tasks')),
        checkQuery ? getDocs(checkQuery) : Promise.resolve({ docs: [] }),
      ])
      setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCheckIns(checkSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }, [isStaff, user?.email])

  useEffect(() => {
    load()
  }, [load])

  const today = todayIso()
  const soon = addDaysIso(7)
  const myName = (userProfile?.name || '').toLowerCase()
  const myEmail = (user?.email || '').toLowerCase()

  const digest = useMemo(() => {
    let myTasks = tasks.filter(
      (t) => (t.owner || '').toLowerCase() === myName && t.status !== 'Complete'
    )
    if (isStaff && !myName) {
      myTasks = tasks.filter((t) => t.status !== 'Complete')
    }

    const overdueTasks = myTasks
      .filter((t) => t.dueDate && t.dueDate < today)
      .sort(sortByPriorityThenDue)
    const dueSoonTasks = myTasks
      .filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= soon)
      .sort(sortByPriorityThenDue)
    const waitingTasks = myTasks
      .filter((t) => t.status === 'Waiting' || (t.waitingOn && String(t.waitingOn).trim()))
      .sort(sortByPriorityThenDue)
      .slice(0, 12)

    let relevantCheckIns = checkIns
    if (!isStaff) {
      relevantCheckIns = checkIns.filter(
        (c) => (c.learnerEmail || '').toLowerCase() === myEmail
      )
    }
    const overdueCheckIns = relevantCheckIns
      .filter((c) => c.dueDate && c.dueDate < today && c.status !== 'Completed')
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    const dueSoonCheckIns = relevantCheckIns
      .filter(
        (c) =>
          c.dueDate &&
          c.dueDate >= today &&
          c.dueDate <= soon &&
          c.status !== 'Completed'
      )
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))

    return {
      overdueTasks,
      dueSoonTasks,
      waitingTasks,
      overdueCheckIns,
      dueSoonCheckIns,
      total:
        overdueTasks.length +
        dueSoonTasks.length +
        waitingTasks.length +
        overdueCheckIns.length +
        dueSoonCheckIns.length,
    }
  }, [tasks, checkIns, myName, myEmail, isStaff, today, soon])

  const composeDigestEmail = () => {
    const lines = [
      'HAE notifications digest',
      '',
      `Overdue tasks: ${digest.overdueTasks.length}`,
      ...digest.overdueTasks
        .slice(0, 15)
        .map((t) => `- ${t.title || 'Task'} (due ${t.dueDate})`),
      '',
      `Due in 7 days: ${digest.dueSoonTasks.length}`,
      ...digest.dueSoonTasks
        .slice(0, 15)
        .map((t) => `- ${t.title || 'Task'} (due ${t.dueDate})`),
      '',
      `Overdue check-ins: ${digest.overdueCheckIns.length}`,
      ...digest.overdueCheckIns
        .slice(0, 15)
        .map(
          (c) =>
            `- ${c.learnerName || c.learnerEmail || 'Learner'} · ${c.courseName || 'Course'} (due ${c.dueDate})`
        ),
      '',
      'Open Tracker → Notifications for the full list.',
    ]
    const subject = encodeURIComponent(
      `HAE digest — ${digest.overdueTasks.length} overdue task(s), ${digest.overdueCheckIns.length} overdue check-in(s)`
    )
    const body = encodeURIComponent(lines.join('\n'))
    window.location.href = `mailto:${encodeURIComponent(myEmail || '')}?subject=${subject}&body=${body}`
  }

  if (loading) {
    return <p className="text-sm text-hae-slate">Loading notifications…</p>
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-hae-slate">
            In-app digest of overdue and upcoming work
            {isStaff ? ' (your tasks + LMS check-ins)' : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={composeDigestEmail}
          className="rounded-md border border-hae-line px-3 py-2 text-sm font-semibold text-hae-ink hover:bg-hae-mist"
        >
          Email me this digest
        </button>
      </header>

      {digest.total === 0 ? (
        <p className="rounded-xl border border-hae-line bg-white p-6 text-sm text-hae-slate">
          You are caught up — no overdue or due-soon items in the next 7 days.
        </p>
      ) : null}

      <DigestSection
        title="Overdue tasks"
        count={digest.overdueTasks.length}
        empty="None"
      >
        {digest.overdueTasks.map((t) => (
          <DigestRow
            key={t.id}
            title={t.title || 'Untitled task'}
            meta={`Due ${formatDate(t.dueDate)} · ${t.status || '—'}`}
            href="/my-tasks"
            tone="danger"
          />
        ))}
      </DigestSection>

      <DigestSection
        title="Tasks due in 7 days"
        count={digest.dueSoonTasks.length}
        empty="None"
      >
        {digest.dueSoonTasks.map((t) => (
          <DigestRow
            key={t.id}
            title={t.title || 'Untitled task'}
            meta={`Due ${formatDate(t.dueDate)} · ${t.status || '—'}`}
            href="/my-tasks"
          />
        ))}
      </DigestSection>

      <DigestSection
        title="Waiting on"
        count={digest.waitingTasks.length}
        empty="None"
      >
        {digest.waitingTasks.map((t) => (
          <DigestRow
            key={t.id}
            title={t.title || 'Untitled task'}
            meta={
              t.waitingOn
                ? `Waiting on ${t.waitingOn}`
                : `Status: ${t.status || 'Waiting'}`
            }
            href="/my-tasks"
          />
        ))}
      </DigestSection>

      <DigestSection
        title={isStaff ? 'Overdue LMS check-ins' : 'Your overdue check-ins'}
        count={digest.overdueCheckIns.length}
        empty="None"
      >
        {digest.overdueCheckIns.map((c) => (
          <DigestRow
            key={c.id}
            title={
              isStaff
                ? `${c.learnerName || c.learnerEmail || 'Learner'} · ${c.label || c.type || 'Check-in'}`
                : c.label || c.type || 'Check-in'
            }
            meta={`Due ${c.dueDate} · ${c.courseName || '—'}`}
            href={
              isStaff ? moduleUrl('lms', '/tracking') : moduleUrl('lms')
            }
            external
            tone="danger"
          />
        ))}
      </DigestSection>

      <DigestSection
        title={isStaff ? 'Check-ins due in 7 days' : 'Your check-ins due soon'}
        count={digest.dueSoonCheckIns.length}
        empty="None"
      >
        {digest.dueSoonCheckIns.map((c) => (
          <DigestRow
            key={c.id}
            title={
              isStaff
                ? `${c.learnerName || c.learnerEmail || 'Learner'} · ${c.label || c.type || 'Check-in'}`
                : c.label || c.type || 'Check-in'
            }
            meta={`Due ${c.dueDate} · ${c.courseName || '—'}`}
            href={
              isStaff ? moduleUrl('lms', '/tracking') : moduleUrl('lms')
            }
            external
          />
        ))}
      </DigestSection>
    </div>
  )
}

function DigestSection({ title, count, empty, children }) {
  return (
    <section className="rounded-xl border border-hae-line bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-hae-ink">
        {title}{' '}
        <span className="font-normal text-hae-slate">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="mt-2 text-sm text-hae-slate">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-hae-line/70">{children}</ul>
      )}
    </section>
  )
}

function DigestRow({ title, meta, href, external, tone }) {
  const className = `flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm ${
    tone === 'danger' ? 'text-hae-ink' : 'text-hae-ink'
  }`
  const titleClass =
    tone === 'danger' ? 'font-medium text-hae-red' : 'font-medium text-hae-ink'

  if (external) {
    return (
      <li>
        <a href={href} className={className}>
          <span className={titleClass}>{title}</span>
          <span className="text-xs text-hae-slate">{meta}</span>
        </a>
      </li>
    )
  }
  return (
    <li>
      <Link to={href} className={className}>
        <span className={titleClass}>{title}</span>
        <span className="text-xs text-hae-slate">{meta}</span>
      </Link>
    </li>
  )
}
