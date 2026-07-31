import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Collapsible slide-over panel anchored to the right edge of the screen.
 * - Esc / backdrop click closes (unless busy)
 * - Locks body scroll while open
 * - Sits above Modal (higher z-index) so it can open from within a modal.
 */
export default function Drawer({
  open,
  onClose,
  title,
  children,
  footer = null,
  size = 'md',
  busy = false,
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    setVisible(false)
    const raf = requestAnimationFrame(() => setVisible(true))
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, busy])

  if (!open) return null

  const width =
    size === 'sm'
      ? 'max-w-sm'
      : size === 'lg'
        ? 'max-w-xl'
        : size === 'xl'
          ? 'max-w-2xl'
          : 'max-w-md'

  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-transparent"
        onClick={() => {
          if (!busy) onClose?.()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Panel'}
        className={`relative z-[91] flex h-full w-full ${width} flex-col border-l border-hae-line bg-white shadow-[-12px_0_32px_rgba(26,26,26,0.12)] transition-transform duration-200 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hae-line/60 px-5 py-4">
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
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-hae-line/60 bg-hae-mist/60 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
