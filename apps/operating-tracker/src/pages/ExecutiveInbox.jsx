import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { EXEC_INBOX_EMAILS } from '../constants'

const SECTIONS = [
  { tag: 'needs_reply', title: 'Needs Reply' },
  { tag: 'urgent', title: 'Urgent' },
  { tag: 'action_item', title: 'Action Items' },
]

const OAUTH_ERROR_MESSAGES = {
  missing_params: 'Google did not return the expected authorization details. Try connecting again.',
  invalid_state: 'This Google connection link expired or was already used. Try connecting again.',
  oauth_failed: 'Google connection failed. Check the OAuth client redirect URI and try again.',
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function EmailSection({ title, emails }) {
  return (
    <div className="rounded-xl border border-hae-line bg-white p-4">
      <h2 className="mb-3 font-display text-lg text-hae-ink">
        {title} <span className="text-sm font-normal text-hae-slate">({emails.length})</span>
      </h2>
      {emails.length === 0 ? (
        <p className="text-sm text-hae-slate">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {emails.map((email) => (
            <li key={email.id} className="border-b border-hae-line/70 pb-2 last:border-0 last:pb-0">
              <a
                href={email.permalink}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-hae-ink hover:text-hae-crimson"
              >
                {email.subject || '(No subject)'}
              </a>
              <p className="text-xs text-hae-slate">{email.from}</p>
              <p className="mt-1 line-clamp-2 text-xs text-hae-slate">{email.snippet}</p>
              <p className="mt-1 text-[11px] text-hae-slate">{formatDateTime(email.receivedAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MeetingsSection({ meetings }) {
  return (
    <div className="rounded-xl border border-hae-line bg-white p-4">
      <h2 className="mb-3 font-display text-lg text-hae-ink">
        Meetings <span className="text-sm font-normal text-hae-slate">({meetings.length})</span>
      </h2>
      {meetings.length === 0 ? (
        <p className="text-sm text-hae-slate">Nothing upcoming.</p>
      ) : (
        <ul className="space-y-3">
          {meetings.map((meeting) => (
            <li key={meeting.id} className="border-b border-hae-line/70 pb-2 last:border-0 last:pb-0">
              <a
                href={meeting.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-hae-ink hover:text-hae-crimson"
              >
                {meeting.title}
              </a>
              <p className="text-xs text-hae-slate">
                {formatDateTime(meeting.start)}
                {meeting.location ? ` · ${meeting.location}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ExecutiveInbox() {
  const { user } = useAuth()
  const allowed = EXEC_INBOX_EMAILS.includes((user?.email || '').toLowerCase())

  const [status, setStatus] = useState(null)
  const [emails, setEmails] = useState([])
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [statusSnap, emailSnap, meetingSnap] = await Promise.all([
        getDoc(doc(db, 'execInboxStatus', 'singleton')),
        getDocs(collection(db, 'execInboxEmails')),
        getDocs(collection(db, 'execInboxMeetings')),
      ])
      setStatus(statusSnap.exists() ? statusSnap.data() : null)
      setEmails(emailSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setMeetings(
        meetingSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(a.start) - new Date(b.start))
      )
    } catch (err) {
      setError(err.message || 'Could not load executive inbox.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) load()
    else setLoading(false)
  }, [allowed, load])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error')
    if (oauthError) {
      setError(OAUTH_ERROR_MESSAGES[oauthError] || `Google connection error: ${oauthError}`)
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (params.get('connected') === '1') {
      load()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [load])

  const connect = async () => {
    setConnecting(true)
    setError('')
    try {
      const getUrl = httpsCallable(functions, 'execInboxGetOauthUrl')
      const { data } = await getUrl()
      window.location.href = data.url
    } catch (err) {
      setError(err.message || 'Could not start Google connection.')
      setConnecting(false)
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    setError('')
    try {
      const sync = httpsCallable(functions, 'execInboxSyncNow')
      await sync()
      await load()
    } catch (err) {
      setError(err.message || 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  const emailsByTag = useMemo(() => {
    const map = {}
    for (const section of SECTIONS) map[section.tag] = []
    for (const email of emails) {
      for (const tag of email.tags || []) {
        if (map[tag]) map[tag].push(email)
      }
    }
    return map
  }, [emails])

  if (!allowed) return null
  if (loading) return <p className="text-sm text-hae-slate">Loading executive inbox…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
            Executive Inbox
          </h1>
          <p className="mt-1 text-sm text-hae-slate">
            {status?.connected
              ? `Connected: ${status.connectedEmail} · Last synced ${formatDateTime(
                  status.lastSyncedAt?.toDate ? status.lastSyncedAt.toDate() : status.lastSyncedAt
                )}`
              : 'Not connected yet.'}
          </p>
        </div>
        {status?.connected ? (
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={connecting}
            className="rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {connecting ? 'Connecting…' : 'Connect Google Account'}
          </button>
        )}
      </header>

      {error ? <p className="text-sm text-hae-red">{error}</p> : null}

      {status?.lastSyncError ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-hae-yellow">
          Last sync error: {status.lastSyncError}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <EmailSection key={section.tag} title={section.title} emails={emailsByTag[section.tag]} />
        ))}
        <MeetingsSection meetings={meetings} />
      </div>
    </div>
  )
}
