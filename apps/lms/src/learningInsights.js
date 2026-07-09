/** LMS learning analytics helpers — general Academy tracking, not industry-specific. */

export const COMPLETED_STATUSES = ['Completed', 'Certificate Eligible']
export const ACTIVE_STATUSES = ['Enrolled', 'In Progress']

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function daysBetween(a, b) {
  if (!a || !b) return null
  const da = new Date(`${a}T00:00:00`)
  const db = new Date(`${b}T00:00:00`)
  return Math.round((db - da) / (1000 * 60 * 60 * 24))
}

/** Enrollment needs attention: low progress, stalled, or overdue check-in. */
export function enrollmentRisk(enrollment, checkIns = [], today = todayIso()) {
  const reasons = []
  const progress = Number(enrollment.progress) || 0
  const status = enrollment.status || ''

  if (ACTIVE_STATUSES.includes(status) && progress < 25) {
    reasons.push('Low progress (<25%)')
  }
  if (status === 'Enrolled' && progress === 0) {
    reasons.push('Not started')
  }

  const overdue = checkIns.filter(
    (c) =>
      c.learnerEmail === enrollment.learnerEmail &&
      c.courseId === enrollment.courseId &&
      c.dueDate &&
      c.dueDate < today &&
      c.status !== 'Completed'
  )
  if (overdue.length) {
    reasons.push(`${overdue.length} overdue check-in${overdue.length > 1 ? 's' : ''}`)
  }

  const upcoming = checkIns.filter(
    (c) =>
      c.learnerEmail === enrollment.learnerEmail &&
      c.courseId === enrollment.courseId &&
      c.dueDate &&
      c.dueDate >= today &&
      c.dueDate <= addDays(today, 7) &&
      c.status !== 'Completed'
  )
  if (upcoming.length) {
    reasons.push('Check-in due within 7 days')
  }

  return {
    atRisk: reasons.length > 0 && !COMPLETED_STATUSES.includes(status),
    reasons,
    overdueCount: overdue.length,
  }
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function buildNudgeMailto({ learnerEmail, learnerName, courseName, reasons }) {
  const to = encodeURIComponent(learnerEmail || '')
  const subject = encodeURIComponent(
    `HAE Academy reminder${courseName ? `: ${courseName}` : ''}`
  )
  const body = encodeURIComponent(
    [
      `Hi ${learnerName || 'there'},`,
      ``,
      `This is a friendly nudge from HAE Academy about your learning progress.`,
      courseName ? `Course: ${courseName}` : '',
      reasons?.length ? `Notes: ${reasons.join('; ')}` : '',
      ``,
      `Please log in to the LMS when you can to continue or complete your check-in.`,
      ``,
      `Thank you,`,
      `HAE Academy`,
    ]
      .filter(Boolean)
      .join('\n')
  )
  return `mailto:${to}?subject=${subject}&body=${body}`
}

/** Points & badges derived from enrollments / check-ins / certificates (no extra DB). */
export const BADGE_DEFS = [
  {
    id: 'first-steps',
    label: 'First Steps',
    description: 'Enrolled in a course',
    test: (ctx) => ctx.enrollments.length >= 1,
    points: 10,
  },
  {
    id: 'momentum',
    label: 'Momentum',
    description: 'Reached 50% progress on a course',
    test: (ctx) => ctx.enrollments.some((e) => (e.progress || 0) >= 50),
    points: 25,
  },
  {
    id: 'finisher',
    label: 'Finisher',
    description: 'Completed a course',
    test: (ctx) =>
      ctx.enrollments.some((e) => COMPLETED_STATUSES.includes(e.status)),
    points: 50,
  },
  {
    id: 'check-in-champ',
    label: 'Check-in Champ',
    description: 'Completed 2+ check-ins',
    test: (ctx) =>
      ctx.checkIns.filter((c) => c.status === 'Completed').length >= 2,
    points: 30,
  },
  {
    id: 'certified',
    label: 'Certified',
    description: 'Earned a certificate',
    test: (ctx) => ctx.certificates.length >= 1,
    points: 75,
  },
  {
    id: 'pathfinder',
    label: 'Pathfinder',
    description: 'Active on both Academy and Flagship paths',
    test: (ctx) => {
      const paths = new Set(ctx.enrollments.map((e) => e.path).filter(Boolean))
      return paths.has('academy') && paths.has('flagship')
    },
    points: 40,
  },
]

export function computeLearnerScore({ enrollments = [], checkIns = [], certificates = [] }) {
  const ctx = { enrollments, checkIns, certificates }
  const badges = BADGE_DEFS.filter((b) => b.test(ctx))
  const progressPoints = enrollments.reduce(
    (sum, e) => sum + Math.min(40, Math.round((Number(e.progress) || 0) / 2.5)),
    0
  )
  const badgePoints = badges.reduce((sum, b) => sum + b.points, 0)
  const checkInPoints =
    checkIns.filter((c) => c.status === 'Completed').length * 15
  const certPoints = certificates.length * 50
  const points = progressPoints + badgePoints + checkInPoints + certPoints
  return { points, badges, progressPoints, badgePoints }
}

/** Ready course blueprints for faster authoring (generic HAE Academy). */
export const COURSE_TEMPLATES = [
  {
    id: 'academy-fast-track',
    name: 'Academy Fast Track (template)',
    path: 'academy',
    description:
      '6-week Fast Track outline: kickoff, core lessons, office hours, and a 60-day check-in.',
    durationWeeks: 6,
    status: 'Draft',
    modules: [
      { title: 'Welcome & orientation', type: 'Lesson', order: 1 },
      { title: 'Core concepts', type: 'Lesson', order: 2 },
      { title: 'Knowledge check quiz', type: 'Quiz', order: 3 },
      { title: 'Office hours — AMA', type: 'Office Hours', order: 4 },
      { title: 'Workbook exercise', type: 'Workbook', order: 5 },
      { title: '60-day check-in', type: 'Check-in', order: 6 },
    ],
  },
  {
    id: 'flagship-deep-dive',
    name: 'Flagship Deep Dive (template)',
    path: 'flagship',
    description:
      'Longer Flagship outline with discussion, branching scenario, and milestone check-ins.',
    durationWeeks: 12,
    status: 'Draft',
    modules: [
      { title: 'Program kickoff', type: 'Lesson', order: 1 },
      { title: 'Deep dive module A', type: 'Lesson', order: 2 },
      { title: 'Peer discussion', type: 'Discussion', order: 3 },
      { title: 'Decision scenario', type: 'Branching', order: 4 },
      { title: 'Practice simulation', type: 'Simulation', order: 5 },
      { title: 'Midpoint office hours', type: 'Office Hours', order: 6 },
      { title: '30-day check-in', type: 'Check-in', order: 7 },
      { title: 'Capstone workbook', type: 'Workbook', order: 8 },
      { title: '180-day check-in', type: 'Check-in', order: 9 },
    ],
  },
  {
    id: 'orientation-compliance',
    name: 'Orientation & policies (template)',
    path: 'academy',
    description:
      'Short orientation shell for onboarding policies, expectations, and a short quiz.',
    durationWeeks: 2,
    status: 'Draft',
    modules: [
      { title: 'Welcome to HAE Academy', type: 'Lesson', order: 1 },
      { title: 'Community guidelines', type: 'Lesson', order: 2 },
      { title: 'Orientation quiz', type: 'Quiz', order: 3 },
      { title: 'Q&A office hours', type: 'Office Hours', order: 4 },
    ],
  },
]

/** Simple quiz outline generator from topic keywords (local helper, not an external AI API). */
export function generateQuizOutline(topic, count = 5) {
  const t = (topic || 'this topic').trim() || 'this topic'
  const stems = [
    `What is the primary goal of ${t}?`,
    `Which approach best applies ${t} in practice?`,
    `Identify a common pitfall when working with ${t}.`,
    `How would you measure success for ${t}?`,
    `What should you do first when starting with ${t}?`,
    `Which stakeholder is most critical for ${t}?`,
    `True or false: ${t} requires ongoing follow-up.`,
  ]
  return stems.slice(0, Math.max(1, Math.min(count, stems.length))).map((prompt, i) => ({
    id: `quiz_${i + 1}`,
    prompt,
    type: 'single',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    order: i + 1,
  }))
}
