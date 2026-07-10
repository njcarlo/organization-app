import { TASK_STATUSES } from './constants'

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
  const ra = TASK_STATUSES.indexOf(a.status)
  const rb = TASK_STATUSES.indexOf(b.status)
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
  'at-risk': 0,
  'needs-attention': 1,
  'not-started': 2,
  'on-track': 3,
  completed: 4,
}

export function sortByHealth(a, b) {
  const ra = HEALTH_RANK[a.health] ?? 5
  const rb = HEALTH_RANK[b.health] ?? 5
  if (ra !== rb) return ra - rb
  return (a.name || '').localeCompare(b.name || '')
}

export function healthBadgeClass(health) {
  if (health === 'not-started') return 'bg-slate-100 text-hae-slate'
  if (health === 'on-track') return 'bg-emerald-100 text-hae-green'
  if (health === 'needs-attention') return 'bg-amber-100 text-hae-yellow'
  if (health === 'at-risk') return 'bg-red-100 text-hae-red'
  if (health === 'completed') return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-hae-slate'
}

export function statusBadgeClass(status) {
  if (status === 'Time Sensitive') return 'bg-red-100 text-hae-red'
  if (status === 'Complete') return 'bg-emerald-50 text-hae-green'
  if (status === 'Waiting' || status === 'Review') return 'bg-amber-50 text-hae-yellow'
  if (status === 'In Progress') return 'bg-sky-50 text-sky-800'
  return 'bg-hae-mist text-hae-slate'
}

export function healthLabel(health) {
  if (health === 'not-started') return 'Not Started'
  if (health === 'on-track') return 'On Track'
  if (health === 'needs-attention') return 'Needs Attention'
  if (health === 'at-risk') return 'At Risk'
  if (health === 'completed') return 'Completed'
  return health || '—'
}
