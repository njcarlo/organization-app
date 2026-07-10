import { useState } from 'react'

/**
 * URL-based attachments (Drive / Dropbox / SharePoint links).
 * Spark-safe — no Firebase Storage required.
 */
export function parseAttachments(value) {
  if (Array.isArray(value)) {
    return value
      .map((a) => ({
        name: String(a?.name || a?.url || 'Link').trim(),
        url: String(a?.url || '').trim(),
      }))
      .filter((a) => a.url)
  }
  return []
}

export function attachmentsToFormLines(attachments) {
  return parseAttachments(attachments)
    .map((a) => (a.name && a.name !== a.url ? `${a.name} | ${a.url}` : a.url))
    .join('\n')
}

/** Parse lines like "Label | https://..." or bare URLs. */
export function formLinesToAttachments(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf('|')
      if (pipe > -1) {
        const name = line.slice(0, pipe).trim()
        const url = line.slice(pipe + 1).trim()
        return { name: name || url, url }
      }
      return { name: line, url: line }
    })
    .filter((a) => /^https?:\/\//i.test(a.url))
}

export function AttachmentList({ attachments }) {
  const list = parseAttachments(attachments)
  if (!list.length) return null
  return (
    <ul className="mt-1 space-y-0.5">
      {list.map((a) => (
        <li key={`${a.url}-${a.name}`}>
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-hae-crimson hover:underline"
          >
            {a.name || a.url}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function AttachmentField({ value, onChange, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
        Attachments (one URL per line; optional “Label | URL”)
      </span>
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Brief | https://drive.google.com/..."
        className="w-full border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
      />
    </label>
  )
}

/** Controlled helper for forms that store attachment lines as a string. */
export function useAttachmentLines(initial = '') {
  const [lines, setLines] = useState(initial)
  return {
    lines,
    setLines,
    attachments: formLinesToAttachments(lines),
    loadFrom: (attachments) => setLines(attachmentsToFormLines(attachments)),
  }
}
