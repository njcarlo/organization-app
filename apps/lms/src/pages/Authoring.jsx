import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { COURSE_TEMPLATES, generateQuizOutline } from '../learningInsights'

export default function Authoring() {
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [quizTopic, setQuizTopic] = useState('')
  const [quizCount, setQuizCount] = useState(5)

  const quizPreview = useMemo(
    () => generateQuizOutline(quizTopic, Number(quizCount) || 5),
    [quizTopic, quizCount]
  )

  const createFromTemplate = async (template) => {
    setBusyId(template.id)
    setError('')
    setMessage('')
    try {
      const courseRef = await addDoc(collection(db, 'courses'), {
        name: template.name,
        path: template.path,
        facilitator: '',
        description: template.description,
        durationWeeks: template.durationWeeks,
        status: 'Draft',
        templateId: template.id,
        createdAt: serverTimestamp(),
      })
      for (const mod of template.modules) {
        await addDoc(collection(db, 'modules'), {
          courseId: courseRef.id,
          courseName: template.name,
          title: mod.title,
          type: mod.type,
          order: mod.order,
          resourceUrl: '',
          createdAt: serverTimestamp(),
        })
      }
      setMessage(`Created “${template.name}” with ${template.modules.length} modules.`)
      navigate(`/courses/${courseRef.id}`)
    } catch (err) {
      setError(err.message || 'Could not create course from template')
    } finally {
      setBusyId('')
    }
  }

  const copyQuiz = async () => {
    const text = quizPreview
      .map((q, i) => `${i + 1}. ${q.prompt}\n   A) ${q.options[0]}\n   B) ${q.options[1]}\n   C) ${q.options[2]}\n   D) ${q.options[3]}`)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Quiz outline copied to clipboard. Paste into a Quiz module or doc.')
    } catch {
      setMessage('Copy failed — select the preview text manually.')
    }
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-hae-line pb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
          Staff · Authoring
        </p>
        <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl">
          Content authoring
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hae-slate">
          Start from ready course templates, add branching/simulation module
          types, and draft quiz outlines quickly. For polished SCORM packages,
          export/import from tools like Articulate or iSpring into your hosting
          later — this suite keeps authoring inside HAE Academy.
        </p>
      </header>

      {error && <p className="text-sm text-hae-red">{error}</p>}
      {message && <p className="text-sm text-hae-green">{message}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-hae-ink">Course templates</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {COURSE_TEMPLATES.map((t) => (
            <article
              key={t.id}
              className="flex flex-col border border-hae-line bg-white p-4"
            >
              <div className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
                {t.path === 'flagship' ? 'Flagship' : 'Academy'} · {t.durationWeeks} weeks
              </div>
              <h3 className="mt-2 text-sm font-semibold text-hae-ink">{t.name}</h3>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-hae-slate">
                {t.description}
              </p>
              <ul className="mt-3 space-y-1 text-[11px] text-hae-slate">
                {t.modules.slice(0, 4).map((m) => (
                  <li key={m.order}>
                    {m.order}. {m.title}{' '}
                    <span className="text-hae-ink/70">({m.type})</span>
                  </li>
                ))}
                {t.modules.length > 4 ? (
                  <li>+{t.modules.length - 4} more modules</li>
                ) : null}
              </ul>
              <button
                type="button"
                disabled={!!busyId}
                onClick={() => createFromTemplate(t)}
                className="mt-4 rounded-md bg-hae-crimson px-3 py-2 text-xs font-semibold tracking-wide text-white uppercase disabled:opacity-60"
              >
                {busyId === t.id ? 'Creating…' : 'Use template'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="border border-hae-line bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-hae-ink">Quiz outline helper</h2>
        <p className="mt-1 text-sm text-hae-slate">
          Local draft generator — enter a topic to get starter questions you can
          refine. Not connected to an external AI API.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_auto]">
          <input
            className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            placeholder="Topic (e.g. go-to-market for early startups)"
            value={quizTopic}
            onChange={(e) => setQuizTopic(e.target.value)}
          />
          <input
            type="number"
            min={1}
            max={7}
            className="rounded-md border border-hae-line px-3 py-2 text-sm"
            value={quizCount}
            onChange={(e) => setQuizCount(e.target.value)}
          />
          <button
            type="button"
            onClick={copyQuiz}
            className="rounded-md border border-hae-line px-3 py-2 text-sm font-semibold text-hae-ink hover:bg-hae-mist"
          >
            Copy outline
          </button>
        </div>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-hae-slate">
          {quizPreview.map((q) => (
            <li key={q.id}>
              <span className="font-medium text-hae-ink">{q.prompt}</span>
              <div className="mt-1 text-xs">{q.options.join(' · ')}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-dashed border-hae-line bg-hae-mist/40 p-4 text-sm text-hae-slate">
        <p className="font-medium text-hae-ink">Module types for richer content</p>
        <p className="mt-1">
          When editing a course, you can now mark modules as{' '}
          <strong>Branching</strong> (choice paths) or <strong>Simulation</strong>{' '}
          (practice scenarios), alongside Lesson, Quiz, Discussion, and Check-in.
          Link external media or SCORM packages via the resource URL field.
        </p>
        <Link
          to="/courses"
          className="mt-3 inline-block text-xs font-semibold text-hae-crimson"
        >
          Go to Manage courses →
        </Link>
      </section>
    </div>
  )
}
