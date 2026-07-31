/** Small badge showing a comment icon + count, rendered only when comments exist. */
export default function CommentIndicator({ count, className = '' }) {
  if (!count) return null
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-hae-mist px-1.5 py-0.5 text-[10px] font-semibold text-hae-slate ${className}`}
      title={`${count} comment${count === 1 ? '' : 's'}`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="h-3 w-3"
      >
        <path d="M2.5 4.5A2 2 0 0 1 4.5 2.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.6l-3.4 3v-3H4.5a2 2 0 0 1-2-2v-7Z" />
      </svg>
      {count}
    </span>
  )
}
