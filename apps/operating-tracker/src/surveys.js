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
