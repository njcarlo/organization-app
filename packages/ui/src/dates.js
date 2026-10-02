// Platform-wide date display format: "Jan 05, 2026" (Mmm dd, yyyy).
// Accepts a YYYY-MM-DD string, a Date, epoch millis, or a Firestore Timestamp.

const DATE_OPTIONS = { month: 'short', day: '2-digit', year: 'numeric' }

export function toDisplayDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000)
  if (typeof value === 'number') return new Date(value)
  const str = String(value)
  // Date-only strings are calendar dates — parse as local, not UTC midnight.
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  // Only full ISO timestamps otherwise — free text ("TBD", "Spring") stays as typed.
  if (!/^\d{4}-\d{2}-\d{2}T/.test(str)) return null
  const date = new Date(str)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Jan 05, 2026". Unparseable input is returned as-is; empty input returns `fallback`. */
export function formatDate(value, fallback = '—') {
  if (value == null || value === '') return fallback
  const date = toDisplayDate(value)
  if (!date) return String(value)
  return date.toLocaleDateString('en-US', DATE_OPTIONS)
}

/** "Monday, Jan 05, 2026" (or "Mon, Jan 05, 2026" with weekday: 'short'). */
export function formatDateWithWeekday(value, { weekday = 'long', fallback = '—' } = {}) {
  const date = toDisplayDate(value)
  if (!date) return value ? String(value) : fallback
  return `${date.toLocaleDateString('en-US', { weekday })}, ${formatDate(date)}`
}

/** "Jan 05, 2026, 3:04 PM". */
export function formatDateTime(value, fallback = '') {
  const date = toDisplayDate(value)
  if (!date) return value ? String(value) : fallback
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${formatDate(date)}, ${time}`
}
