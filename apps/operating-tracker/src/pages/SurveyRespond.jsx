import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const fieldClass =
  'w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson'

export default function SurveyRespond() {
  const { surveyId } = useParams()
  const [survey, setSurvey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const snap = await getDoc(doc(db, 'surveys', surveyId))
      if (!snap.exists()) {
        setError('This survey was not found.')
        setSurvey(null)
        return
      }
      const data = { id: snap.id, ...snap.data() }
      if (data.status !== 'Open') {
        setError(
          data.status === 'Closed'
            ? 'This survey is closed.'
            : 'This survey is not open for responses yet.'
        )
      }
      setSurvey(data)
    } catch (err) {
      setError(err.message || 'Could not load survey')
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    load()
  }, [load])

  const setAnswer = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
  }

  const toggleMulti = (qid, option) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[qid]) ? prev[qid] : []
      return {
        ...prev,
        [qid]: cur.includes(option)
          ? cur.filter((x) => x !== option)
          : [...cur, option],
      }
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!survey || survey.status !== 'Open') return

    for (const q of survey.questions || []) {
      if (!q.required) continue
      const a = answers[q.id]
      const empty =
        a == null ||
        a === '' ||
        (Array.isArray(a) && a.length === 0)
      if (empty) {
        setError(`Please answer: ${q.prompt}`)
        return
      }
    }

    setSubmitting(true)
    setError('')
    try {
      await addDoc(collection(db, 'surveyResponses'), {
        surveyId: survey.id,
        surveyTitle: survey.title || '',
        respondentName: name.trim(),
        respondentEmail: email.trim().toLowerCase(),
        answers,
        submittedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
      })
      setDone(true)
    } catch (err) {
      setError(err.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hae-mist px-4">
        <p className="text-sm text-hae-slate">Loading survey…</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(184,0,40,0.10)_0%,_#ffffff_45%,_#f6f6f6_100%)]"
        />
        <div className="relative w-full max-w-lg border border-hae-line bg-white/95 p-6 text-center shadow-[0_8px_28px_rgba(26,26,26,0.04)] sm:p-8">
          <img
            src="/hae-logo.webp"
            alt="Harvard Alumni Entrepreneurs"
            className="mx-auto h-12 w-auto object-contain"
          />
          <h1 className="mt-5 font-display text-2xl text-hae-ink">Thank you</h1>
          <p className="mt-2 text-sm text-hae-slate">
            Your response to “{survey?.title}” was submitted.
          </p>
        </div>
      </div>
    )
  }

  const canRespond = survey && survey.status === 'Open' && !error?.includes('not found')

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(184,0,40,0.10)_0%,_#ffffff_42%,_#f6f6f6_100%)]"
      />
      <div className="relative mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <img
            src="/hae-logo.webp"
            alt="Harvard Alumni Entrepreneurs"
            className="mx-auto h-12 w-auto object-contain"
          />
        </div>

        <div className="border border-hae-line bg-white/95 p-5 shadow-[0_8px_28px_rgba(26,26,26,0.04)] sm:p-7">
          <h1 className="font-display text-2xl text-hae-ink sm:text-3xl">
            {survey?.title || 'Survey'}
          </h1>
          {survey?.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-hae-slate">
              {survey.description}
            </p>
          ) : null}

          {error && <p className="mt-4 text-sm text-hae-red">{error}</p>}

          {canRespond ? (
            <form onSubmit={submit} className="mt-6 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
                    Your name (optional)
                  </span>
                  <input
                    className={fieldClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
                    Your email (optional)
                  </span>
                  <input
                    type="email"
                    className={fieldClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>

              {(survey.questions || []).map((q, idx) => (
                <fieldset key={q.id} className="space-y-2">
                  <legend className="text-sm font-semibold text-hae-ink">
                    {idx + 1}. {q.prompt}
                    {q.required ? (
                      <span className="text-hae-crimson"> *</span>
                    ) : null}
                  </legend>

                  {q.type === 'short' && (
                    <input
                      className={fieldClass}
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      required={q.required}
                    />
                  )}
                  {q.type === 'long' && (
                    <textarea
                      rows={4}
                      className={fieldClass}
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      required={q.required}
                    />
                  )}
                  {q.type === 'single' && (
                    <div className="space-y-2">
                      {(q.options || []).map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 text-sm text-hae-ink"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === opt}
                            onChange={() => setAnswer(q.id, opt)}
                            required={q.required}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'multi' && (
                    <div className="space-y-2">
                      {(q.options || []).map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 text-sm text-hae-ink"
                        >
                          <input
                            type="checkbox"
                            checked={(answers[q.id] || []).includes(opt)}
                            onChange={() => toggleMulti(q.id, opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'rating' && (
                    <div className="flex flex-wrap gap-3">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label
                          key={n}
                          className="flex items-center gap-1.5 text-sm text-hae-ink"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={String(answers[q.id]) === String(n)}
                            onChange={() => setAnswer(q.id, n)}
                            required={q.required}
                          />
                          {n}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              ))}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-hae-crimson px-4 py-2.5 text-sm font-semibold tracking-wide text-white uppercase hover:bg-hae-crimson-dark disabled:opacity-60 sm:w-auto"
              >
                {submitting ? 'Submitting…' : 'Submit response'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
