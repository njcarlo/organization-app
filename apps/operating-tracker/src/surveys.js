export const SURVEY_STATUSES = ['Draft', 'Open', 'Closed']

export const QUESTION_TYPES = [
  { value: 'short', label: 'Short text' },
  { value: 'long', label: 'Long text' },
  { value: 'single', label: 'Single choice' },
  { value: 'multi', label: 'Multiple choice' },
  { value: 'rating', label: 'Rating (1–5)' },
]

export function emptyQuestion(order = 1) {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    prompt: '',
    type: 'short',
    required: true,
    options: ['Option 1', 'Option 2'],
    order,
  }
}

export function parseEmails(text) {
  const parts = String(text || '')
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const valid = []
  const invalid = []
  for (const e of parts) {
    if (emailRe.test(e)) {
      if (!valid.includes(e)) valid.push(e)
    } else {
      invalid.push(e)
    }
  }
  return { valid, invalid }
}

export function surveyPublicPath(surveyId) {
  return `/s/${surveyId}`
}

export function surveyPublicUrl(surveyId) {
  if (typeof window === 'undefined') {
    return `https://hae-operating-tracker.web.app/s/${surveyId}`
  }
  return `${window.location.origin}/s/${surveyId}`
}

export function defaultInviteBody({ title, link, senderName }) {
  const who = senderName || 'Harvard Alumni Entrepreneurs'
  return [
    `Hello,`,
    ``,
    `${who} invites you to complete a short survey:`,
    ``,
    title,
    ``,
    `Please use this link:`,
    link,
    ``,
    `Thank you,`,
    who,
  ].join('\n')
}

function answerDisplay(ans) {
  if (Array.isArray(ans)) return ans.join('; ')
  if (ans == null || ans === '') return ''
  return String(ans)
}

/** Aggregate choice/rating counts and text samples for survey analytics. */
export function analyzeSurveyResponses(questions = [], responses = []) {
  const total = responses.length
  const byQuestion = (questions || []).map((q) => {
    const counts = {}
    const texts = []
    let answered = 0
    let ratingSum = 0
    let ratingN = 0

    for (const r of responses) {
      const ans = r.answers?.[q.id]
      if (ans == null || ans === '' || (Array.isArray(ans) && !ans.length)) {
        continue
      }
      answered += 1

      if (q.type === 'single' || q.type === 'rating') {
        const key = String(ans)
        counts[key] = (counts[key] || 0) + 1
        if (q.type === 'rating') {
          const n = Number(ans)
          if (!Number.isNaN(n)) {
            ratingSum += n
            ratingN += 1
          }
        }
      } else if (q.type === 'multi') {
        const parts = Array.isArray(ans) ? ans : [ans]
        for (const p of parts) {
          const key = String(p)
          counts[key] = (counts[key] || 0) + 1
        }
      } else {
        texts.push(answerDisplay(ans))
      }
    }

    const options =
      q.type === 'rating'
        ? ['1', '2', '3', '4', '5']
        : q.type === 'single' || q.type === 'multi'
          ? q.options || Object.keys(counts)
          : []

    const breakdown = options.map((opt) => ({
      option: String(opt),
      count: counts[String(opt)] || 0,
      pct: answered ? Math.round(((counts[String(opt)] || 0) / answered) * 100) : 0,
    }))

    // Include write-in keys not in options
    for (const key of Object.keys(counts)) {
      if (!breakdown.some((b) => b.option === key)) {
        breakdown.push({
          option: key,
          count: counts[key],
          pct: answered ? Math.round((counts[key] / answered) * 100) : 0,
        })
      }
    }

    return {
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      answered,
      skipped: total - answered,
      avgRating: ratingN ? Math.round((ratingSum / ratingN) * 10) / 10 : null,
      breakdown,
      textSamples: texts.slice(0, 20),
      textCount: texts.length,
    }
  })

  return { total, byQuestion }
}

/** Flat CSV rows for survey responses (header + data). */
export function surveyResponsesToCsvRows(questions = [], responses = []) {
  const qs = questions || []
  const header = [
    'submittedAt',
    'respondentName',
    'respondentEmail',
    ...qs.map((q, i) => `q${i + 1}_${(q.prompt || q.id).slice(0, 40)}`),
  ]
  const rows = [header]
  for (const r of responses) {
    rows.push([
      (r.submittedAt || '').toString(),
      r.respondentName || '',
      r.respondentEmail || '',
      ...qs.map((q) => answerDisplay(r.answers?.[q.id])),
    ])
  }
  return rows
}
