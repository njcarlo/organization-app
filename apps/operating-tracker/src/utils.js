import { HEALTH_ALIASES, TASK_STATUSES, TASK_STATUS_ALIASES } from './constants'

/** Maps legacy task status strings onto the current 5-status hierarchy. */
export function normalizeTaskStatus(status) {
  return TASK_STATUS_ALIASES[status] || status
}

/** Maps legacy project health values onto the current 5-status hierarchy. */
export function normalizeHealth(health) {
  return HEALTH_ALIASES[health] || health
}

/** Days until due date (negative if overdue). Returns null if no date. */
export function daysUntil(dueDate) {
  if (!dueDate) return null
  const due = new Date(dueDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due - today) / (1000 * 60 * 60 * 24))
}

/** Auto priority from due date: HIGH ≤1 day, MEDIUM ≤3 days, LOW otherwise */
export function autoPriority(dueDate) {
  const d = daysUntil(dueDate)
  if (d === null) return 'LOW'
  if (d <= 1) return 'HIGH'
  if (d <= 3) return 'MEDIUM'
  return 'LOW'
}

/** Effective priority: manual override or auto-calculated */
export function effectivePriority(task) {
  if (task.priority) return task.priority
  return autoPriority(task.dueDate)
}

const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export function sortByPriorityThenDue(a, b) {
  const ta = a.status === 'Time Sensitive'
  const tb = b.status === 'Time Sensitive'
  if (ta !== tb) return ta ? -1 : 1
  const pa = PRIORITY_RANK[effectivePriority(a)] ?? 3
  const pb = PRIORITY_RANK[effectivePriority(b)] ?? 3
  if (pa !== pb) return pa - pb
  const da = a.dueDate || '9999-99-99'
  const db = b.dueDate || '9999-99-99'
  return da.localeCompare(db)
}

export function sortByStatus(a, b) {
  const ra = TASK_STATUSES.indexOf(normalizeTaskStatus(a.status))
  const rb = TASK_STATUSES.indexOf(normalizeTaskStatus(b.status))
  return (ra === -1 ? TASK_STATUSES.length : ra) - (rb === -1 ? TASK_STATUSES.length : rb)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${m}/${d}/${y.slice(2)}`
}

export function programNameOf(task, programsById) {
  return task.programName || programsById[task.programId]?.name || '—'
}

export function projectNameOf(task, projectsById) {
  return task.projectName || projectsById[task.projectId]?.name || '—'
}

export function priorityBadgeClass(priority) {
  if (priority === 'HIGH') return 'bg-red-100 text-hae-red'
  if (priority === 'MEDIUM') return 'bg-amber-100 text-hae-yellow'
  return 'bg-slate-100 text-hae-slate'
}

const HEALTH_RANK = {
  'time-sensitive': 0,
  'needs-attention': 1,
  'not-started': 2,
  ongoing: 3,
  completed: 4,
}

export function sortByHealth(a, b) {
  const ra = HEALTH_RANK[normalizeHealth(a.health)] ?? 4
  const rb = HEALTH_RANK[normalizeHealth(b.health)] ?? 4
  if (ra !== rb) return ra - rb
  return (a.name || '').localeCompare(b.name || '')
}

export function healthBadgeClass(health) {
  const h = normalizeHealth(health)
  if (h === 'time-sensitive') return 'bg-hae-crimson text-white'
  if (h === 'not-started') return 'bg-gray-200 text-black'
  if (h === 'ongoing') return 'bg-orange-200 text-amber-900'
  if (h === 'needs-attention') return 'bg-yellow-200 text-black'
  if (h === 'completed') return 'bg-green-900 text-green-400'
  return 'bg-gray-200 text-black'
}

export function statusBadgeClass(status) {
  const s = normalizeTaskStatus(status)
  if (s === 'Time Sensitive') return 'bg-hae-crimson text-white'
  if (s === 'Complete') return 'bg-green-900 text-green-400'
  if (s === 'Needs Attention') return 'bg-yellow-200 text-black'
  if (s === 'Ongoing') return 'bg-orange-200 text-amber-900'
  return 'bg-gray-200 text-black'
}

/** Derived status shown alongside the actual task status — not selectable in the dropdown. */
export const WAITING_ON_BADGE_CLASS = 'bg-purple-600 text-white'

export function isWaitingOn(task) {
  return Boolean(task?.waitingOn && String(task.waitingOn).trim())
}

export function healthLabel(health) {
  const h = normalizeHealth(health)
  if (h === 'time-sensitive') return 'Time Sensitive'
  if (h === 'not-started') return 'Not Started'
  if (h === 'ongoing') return 'Ongoing'
  if (h === 'needs-attention') return 'Needs Attention'
  if (h === 'completed') return 'Complete'
  return health || '—'
}
