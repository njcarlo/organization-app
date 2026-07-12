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
        className={`relative z-[81] w-full ${width} rounded-3xl border border-transparent bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-hae-ink">{title}</h2>
          <button
            type="button"
            onClick={() => {
              if (!busy) onClose?.()
            }}
            className="rounded-full px-2 py-1 text-sm text-hae-slate hover:bg-hae-mist"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-3xl bg-hae-mist/60 px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
