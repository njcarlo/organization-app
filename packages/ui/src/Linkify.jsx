const URL_PATTERN = /(https?:\/\/[^\s]+)/g

/** Renders text as-is, but turns any http(s) URLs within it into clickable links. */
export default function Linkify({ text, className = 'text-hae-crimson hover:underline' }) {
  if (!text) return null
  const parts = String(text).split(URL_PATTERN)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className={className}>
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}
