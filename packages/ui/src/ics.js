import { downloadText } from './download.js'

function pad(n) {
  return String(n).padStart(2, '0')
}

/** Escape text for ICS property values. */
export function escapeIcsText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n')
}

/**
 * Format a local date (YYYY-MM-DD) and optional HH:mm into ICS DATE or DATETIME.
 * All-day when time is missing.
 */
export function formatIcsDate(dateStr, timeStr = '') {
  const d = String(dateStr || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const t = String(timeStr || '').trim()
  if (/^\d{2}:\d{2}/.test(t)) {
    const hh = t.slice(0, 2)
    const mm = t.slice(3, 5)
    return {
      value: `${d.replace(/-/g, '')}T${hh}${mm}00`,
      allDay: false,
    }
  }
  return {
    value: d.replace(/-/g, ''),
    allDay: true,
  }
}

/** UTC stamp for DTSTAMP. */
export function icsTimestamp(date = new Date()) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

/**
 * @typedef {{
 *   uid: string,
 *   title: string,
 *   date: string,
 *   time?: string,
 *   endDate?: string,
 *   endTime?: string,
 *   description?: string,
 *   location?: string,
 *   url?: string,
 * }} IcsEventInput
 */

/**
 * Build a VCALENDAR string from event inputs.
 * @param {IcsEventInput[]} events
 * @param {{ calName?: string }} [opts]
 */
export function buildIcsCalendar(events, opts = {}) {
  const calName = opts.calName || 'HAE Calendar'
  const stamp = icsTimestamp()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Harvard Alumni Entrepreneurs//HAE Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
  ]

  for (const ev of events) {
    const start = formatIcsDate(ev.date, ev.time)
    if (!start) continue
    const end = formatIcsDate(
      ev.endDate || ev.date,
      ev.endTime || (start.allDay ? '' : ev.time)
    )
    let dtEnd = end
    if (start.allDay) {
      // All-day DTEND is exclusive; bump one day when same date
      const base = ev.endDate || ev.date
      const next = addDaysIso(base, ev.endDate && ev.endDate !== ev.date ? 0 : 1)
      dtEnd = formatIcsDate(next, '')
    } else if (!ev.endTime && !ev.endDate) {
      // Default 1-hour block when only start time is known
      dtEnd = formatIcsDate(ev.date, addMinutesHm(ev.time, 60))
    }

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${escapeIcsText(ev.uid)}`)
    lines.push(`DTSTAMP:${stamp}`)
    if (start.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${start.value}`)
      if (dtEnd) lines.push(`DTEND;VALUE=DATE:${dtEnd.value}`)
    } else {
      lines.push(`DTSTART:${start.value}`)
      if (dtEnd) lines.push(`DTEND:${dtEnd.value}`)
    }
    lines.push(`SUMMARY:${escapeIcsText(ev.title || 'HAE event')}`)
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`)
    }
    if (ev.location) {
      lines.push(`LOCATION:${escapeIcsText(ev.location)}`)
    }
    if (ev.url) {
      lines.push(`URL:${escapeIcsText(ev.url)}`)
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export function downloadIcs(filename, events, opts = {}) {
  const body = buildIcsCalendar(events, opts)
  const name = filename.endsWith('.ics') ? filename : `${filename}.ics`
  downloadText(name, body, 'text/calendar;charset=utf-8')
  return body
}

function addDaysIso(isoDate, days) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

function addMinutesHm(timeStr, minutes) {
  const t = String(timeStr || '09:00')
  const hh = Number(t.slice(0, 2)) || 0
  const mm = Number(t.slice(3, 5)) || 0
  const total = hh * 60 + mm + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${pad(nh)}:${pad(nm)}`
}
