import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { downloadCsv } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import {
  QUESTION_TYPES,
  SURVEY_STATUSES,
  analyzeSurveyResponses,
  defaultInviteBody,
  emptyQuestion,
  parseEmails,
  surveyPublicUrl,
  surveyResponsesToCsvRows,
} from '../surveys'

const fieldClass =
  'w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson'

export default function SurveyEditor() {
  const { surveyId } = useParams()
  const isNew = !surveyId || surveyId === 'new'
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('Draft')
  const [questions, setQuestions] = useState([emptyQuestion(1)])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [responses, setResponses] = useState([])
  const [inviteEmails, setInviteEmails] = useState('')
  const [inviteSubject, setInviteSubject] = useState('')
  const [copied, setCopied] = useState(false)

  const publicUrl = useMemo(
    () => (isNew ? '' : surveyPublicUrl(surveyId)),
    [isNew, surveyId]
  )

  const analytics = useMemo(
    () => analyzeSurveyResponses(questions, responses),
    [questions, responses]
  )

  const load = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    setError('')
    try {
      const snap = await getDoc(doc(db, 'surveys', surveyId))
      if (!snap.exists()) {
        setError('Survey not found')
        setLoading(false)
        return
      }
      const data = snap.data()
      setTitle(data.title || '')
      setDescription(data.description || '')
      setStatus(data.status || 'Draft')
      setQuestions(
        Array.isArray(data.questions) && data.questions.length
          ? data.questions
          : [emptyQuestion(1)]
      )
      setInviteSubject(
        data.inviteSubject || `HAE survey: ${data.title || 'Your feedback'}`
      )

      const rSnap = await getDocs(
        query(collection(db, 'surveyResponses'), where('surveyId', '==', surveyId))
      )
      const list = rSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) =>
        String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''))
      )
      setResponses(list)
    } catch (err) {
      setError(err.message || 'Failed to load survey')
    } finally {
      setLoading(false)
    }
  }, [isNew, surveyId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!inviteSubject && title) {
      setInviteSubject(`HAE survey: ${title}`)
    }
  }, [title, inviteSubject])

  const updateQuestion = (id, patch) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    )
  }

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion(prev.length + 1)])
  }

  const removeQuestion = (id) => {
    setQuestions((prev) =>
      prev.length <= 1 ? prev : prev.filter((q) => q.id !== id)
    )
  }

  const save = async (e) => {
    e?.preventDefault?.()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    const cleaned = questions
      .map((q, i) => ({
        ...q,
        prompt: (q.prompt || '').trim(),
        order: i + 1,
        options: (q.options || [])
          .map((o) => String(o).trim())
          .filter(Boolean),
      }))
      .filter((q) => q.prompt)

    if (!cleaned.length) {
      setError('Add at least one question')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    const payload = {
      title: title.trim(),
      description: description.trim(),
      status,
      questions: cleaned,
      inviteSubject: (inviteSubject || `HAE survey: ${title}`).trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: userProfile?.name || user?.email || '',
    }

    try {
      if (isNew) {
        const ref = await addDoc(collection(db, 'surveys'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || '',
          createdByName: userProfile?.name || '',
          createdByEmail: (user?.email || '').toLowerCase(),
        })
        setMessage('Survey created')
        navigate(`/surveys/${ref.id}`, { replace: true })
      } else {
        await updateDoc(doc(db, 'surveys', surveyId), payload)
        setMessage('Saved')
        await load()
      }
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this survey link:', publicUrl)
    }
  }

  const exportCsv = () => {
    if (!responses.length) {
      setError('No responses to export yet.')
      return
    }
    const slug = (title || 'survey')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
    downloadCsv(
      `hae-survey-${slug || surveyId}-responses.csv`,
      surveyResponsesToCsvRows(questions, responses)
    )
    setMessage(`Exported ${responses.length} response${responses.length === 1 ? '' : 's'}.`)
  }

  const openMailto = async () => {
    if (isNew) {
      setError('Save the survey first, then send invites.')
      return
    }
    if (status !== 'Open') {
      setError('Set status to Open before inviting respondents.')
      return
    }
    const { valid, invalid } = parseEmails(inviteEmails)
    if (!valid.length) {
      setError('Add at least one valid email address.')
      return
    }
    if (invalid.length) {
      setError(`Skipped invalid addresses: ${invalid.join(', ')}`)
    } else {
      setError('')
    }

    const subject = encodeURIComponent(
      inviteSubject || `HAE survey: ${title || 'Your feedback'}`
    )
    const body = encodeURIComponent(
      defaultInviteBody({
        title: title || 'HAE survey',
        link: publicUrl,
        senderName: userProfile?.name || 'Harvard Alumni Entrepreneurs',
      })
    )
    // Most clients accept a limited number of BCC recipients in one mailto.
    const chunk = valid.slice(0, 40)
    const bcc = encodeURIComponent(chunk.join(','))
    window.location.href = `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`

    try {
      await addDoc(collection(db, 'surveyInvites'), {
        surveyId,
        surveyTitle: title,
        emails: chunk,
        subject: inviteSubject || `HAE survey: ${title}`,
        sentVia: 'mailto',
        sentAt: new Date().toISOString(),
        sentBy: user?.uid || '',
        sentByEmail: (user?.email || '').toLowerCase(),
        createdAt: serverTimestamp(),
      })
      setMessage(
        `Opened your email app for ${chunk.length} recipient${chunk.length === 1 ? '' : 's'}. Review and send from your inbox.`
      )
    } catch {
      setMessage('Opened your email app. Review and send from your inbox.')
    }
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading survey…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-hae-crimson uppercase">
            <Link to="/surveys" className="hover:underline">
              Surveys
            </Link>
          </p>
          <h1 className="mt-1 font-display text-3xl text-hae-ink sm:text-4xl">
            {isNew ? 'New survey' : 'Edit survey'}
          </h1>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      {error && <p className="text-sm text-hae-red">{error}</p>}
      {message && <p className="text-sm text-hae-green">{message}</p>}

      <form onSubmit={save} className="space-y-4 rounded-xl border border-hae-line bg-white p-4 sm:p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
            Title
          </span>
          <input
            required
            className={fieldClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Post-event feedback"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
            Description
          </span>
          <textarea
            rows={3}
            className={fieldClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shown at the top of the public survey"
          />
        </label>
        <label className="block max-w-xs">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
            Status
          </span>
          <select
            className={fieldClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {SURVEY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-hae-ink">Questions</h2>
          <button
            type="button"
            onClick={addQuestion}
            className="text-sm font-semibold text-hae-crimson"
          >
            + Add question
          </button>
        </div>
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="space-y-3 rounded-xl border border-hae-line bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
                Question {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="text-xs text-hae-slate hover:text-hae-red"
              >
                Remove
              </button>
            </div>
            <input
              className={fieldClass}
              placeholder="Question prompt"
              value={q.prompt}
              onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                className={fieldClass}
                value={q.type}
                onChange={(e) => updateQuestion(q.id, { type: e.target.value })}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-hae-ink">
                <input
                  type="checkbox"
                  checked={!!q.required}
                  onChange={(e) =>
                    updateQuestion(q.id, { required: e.target.checked })
                  }
                />
                Required
              </label>
            </div>
            {(q.type === 'single' || q.type === 'multi') && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
                  Options (one per line)
                </span>
                <textarea
                  rows={3}
                  className={fieldClass}
                  value={(q.options || []).join('\n')}
                  onChange={(e) =>
                    updateQuestion(q.id, {
                      options: e.target.value.split('\n'),
                    })
                  }
                />
              </label>
            )}
          </div>
        ))}
      </section>

      {!isNew && (
        <>
          <section className="space-y-3 rounded-xl border border-hae-line bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-hae-ink">Share & email</h2>
            <p className="text-sm text-hae-slate">
              Invites open in <strong>your email app</strong> (BCC). That keeps
              delivery in your own mailbox reputation — not an automated bulk
              sender — so it is much less likely to be treated as spam. Set
              status to <strong>Open</strong> before inviting.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                readOnly
                className={`${fieldClass} min-w-[240px] flex-1`}
                value={publicUrl}
              />
              <button
                type="button"
                onClick={copyLink}
                className="rounded-md border border-hae-line px-3 py-2 text-sm font-semibold text-hae-ink hover:bg-hae-mist"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-hae-line px-3 py-2 text-sm font-semibold text-hae-ink hover:bg-hae-mist"
              >
                Preview
              </a>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
                Email subject
              </span>
              <input
                className={fieldClass}
                value={inviteSubject}
                onChange={(e) => setInviteSubject(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
                Recipients (comma or line separated)
              </span>
              <textarea
                rows={4}
                className={fieldClass}
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="alumni@example.com, partner@example.com"
              />
            </label>
            <button
              type="button"
              onClick={openMailto}
              className="rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold text-white"
            >
              Compose invite email
            </button>
          </section>

          <section className="space-y-4 rounded-xl border border-hae-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-hae-ink">
                Analytics ({analytics.total} response
                {analytics.total === 1 ? '' : 's'})
              </h2>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!responses.length}
                className="hae-btn-secondary disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
            {analytics.total === 0 ? (
              <p className="text-sm text-hae-slate">
                No responses yet — analytics appear after the first submission.
              </p>
            ) : (
              <div className="space-y-5">
                {analytics.byQuestion.map((q) => (
                  <div key={q.id} className="border-b border-hae-line/70 pb-4 last:border-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-medium text-hae-ink">{q.prompt}</h3>
                      <span className="text-xs text-hae-slate">
                        {q.answered} answered
                        {q.avgRating != null ? ` · avg ${q.avgRating}/5` : ''}
                      </span>
                    </div>
                    {q.breakdown.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {q.breakdown.map((b) => (
                          <li key={b.option}>
                            <div className="mb-0.5 flex justify-between gap-2 text-xs text-hae-slate">
                              <span className="text-hae-ink">{b.option}</span>
                              <span>
                                {b.count} ({b.pct}%)
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded bg-hae-mist">
                              <div
                                className="h-full bg-hae-crimson/80"
                                style={{ width: `${b.pct}%` }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {q.textCount > 0 ? (
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-hae-slate">
                        {q.textSamples.map((t, i) => (
                          <li key={`${q.id}-t-${i}`} className="border-l-2 border-hae-line pl-2">
                            {t}
                          </li>
                        ))}
                        {q.textCount > q.textSamples.length ? (
                          <li className="text-xs">
                            +{q.textCount - q.textSamples.length} more in CSV export
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-hae-line bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-hae-ink">
              Individual responses ({responses.length})
            </h2>
            {responses.length === 0 ? (
              <p className="text-sm text-hae-slate">No responses yet.</p>
            ) : (
              <div className="space-y-3">
                {responses.map((r) => (
                  <div
                    key={r.id}
                    className="border-b border-hae-line/70 pb-3 last:border-0"
                  >
                    <div className="text-xs text-hae-slate">
                      {(r.submittedAt || '').toString().slice(0, 19).replace('T', ' ')}
                      {r.respondentEmail ? ` · ${r.respondentEmail}` : ''}
                      {r.respondentName ? ` · ${r.respondentName}` : ''}
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-hae-ink">
                      {(questions || []).map((q) => {
                        const ans = r.answers?.[q.id]
                        const display = Array.isArray(ans)
                          ? ans.join(', ')
                          : ans == null || ans === ''
                            ? '—'
                            : String(ans)
                        return (
                          <li key={q.id}>
                            <span className="font-medium">{q.prompt}: </span>
                            <span className="text-hae-slate">{display}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
