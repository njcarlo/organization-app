/**
 * Floating action bar shown once one or more rows are checked, mirroring the
 * "N items selected" bulk-action bar pattern (Copy / Move to / clear).
 */
export default function SelectionToolbar({ count, onCopy, onMoveTo, onDelete, onClear }) {
  if (!count) return null

  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="flex items-center gap-1 rounded-2xl border border-hae-line bg-white px-2 py-2 shadow-xl">
        <span className="flex items-center gap-2 px-3 text-sm font-medium text-hae-ink">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hae-crimson text-xs font-semibold text-white">
            {count}
          </span>
          {count === 1 ? 'item selected' : 'items selected'}
        </span>
        <div className="h-6 w-px bg-hae-line" />
        <button
          type="button"
          onClick={onCopy}
          className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium text-hae-slate hover:bg-hae-mist hover:text-hae-ink"
        >
          <span aria-hidden className="text-sm">⧉</span>
          Copy
        </button>
        <button
          type="button"
          onClick={onMoveTo}
          className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium text-hae-slate hover:bg-hae-mist hover:text-hae-ink"
        >
          <span aria-hidden className="text-sm">→</span>
          Move to
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium text-hae-slate hover:bg-red-50 hover:text-hae-red"
        >
          <span aria-hidden className="text-sm">🗑</span>
          Delete
        </button>
        <div className="h-6 w-px bg-hae-line" />
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="rounded-full p-1.5 text-hae-slate hover:bg-hae-mist hover:text-hae-ink"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
