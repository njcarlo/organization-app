/** Trigger a browser download for a text/blob payload. */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

/** Escape a CSV cell (RFC-style quoting). */
export function csvCell(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Build a CSV string from an array of row arrays. */
export function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

export function downloadCsv(filename, rows) {
  downloadText(filename, `${toCsv(rows)}\n`, 'text/csv;charset=utf-8')
}
