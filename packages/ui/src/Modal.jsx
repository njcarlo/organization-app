import { useEffect } from 'react'

/**
 * Simple centered modal dialog.
 * - Esc / backdrop click closes (unless busy)
 * - Locks body scroll while open
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer = null,
  size = 'md',
  busy = false,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, busy])

  if (!open) return null

  const width =
    size === 'sm'
      ? 'max-w-md'
      : size === 'lg'
        ? 'max-w-2xl'
        : 'max-w-xl'

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-hae-ink/45"
        onClick={() => {
          if (!busy) onClose?.()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        className={`relative z-[81] w-full ${width} rounded-xl border border-hae-line bg-white shadow-xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-hae-line px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-hae-ink">{title}</h2>
          <button
            type="button"
            onClick={() => {
              if (!busy) onClose?.()
            }}
            className="rounded-md px-2 py-1 text-sm text-hae-slate hover:bg-hae-mist"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-4 sm:px-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hae-line bg-hae-mist/40 px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
