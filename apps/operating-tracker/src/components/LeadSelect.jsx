import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStaffUsers } from '../hooks/useStaffUsers'
import { toNameList } from '../utils'

const DEFAULT_CLASS =
  'rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson'

/** Multi-select dropdown for assigning one or more users as a lead/owner. */
export default function LeadSelect({
  value,
  onChange,
  className = DEFAULT_CLASS,
  placeholder = 'Unassigned',
}) {
  const users = useStaffUsers()
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState(null)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const selected = toNameList(value)

  const names = users.map((u) => u.name).filter(Boolean)
  const options = Array.from(
    new Set([...selected.filter((n) => !names.includes(n)), ...names])
  )

  const close = () => {
    setOpen(false)
    setMenuRect(null)
  }

  const toggleOpen = () => {
    if (open) {
      close()
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    const estimatedHeight = Math.min(options.length, 8) * 32 + 16
    const openUpward = rect.bottom + estimatedHeight + 4 > window.innerHeight
    const width = Math.max(rect.width, 200)
    const left = Math.min(rect.left, window.innerWidth - width - 8)
    setMenuRect({
      top: openUpward ? null : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : null,
      left: Math.max(left, 8),
      width,
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    const onScrollOrResize = (e) => {
      if (menuRef.current?.contains(e.target)) return
      close()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open])

  const toggle = (name) => {
    onChange(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name]
    )
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        ref={buttonRef}
        onClick={toggleOpen}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${selected.length ? '' : 'text-hae-slate/60'}`}>
          {selected.length ? selected.join(', ') : placeholder}
        </span>
        <span className="shrink-0 text-hae-slate/60">▾</span>
      </button>
      {open && menuRect
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: 'fixed',
                top: menuRect.top ?? undefined,
                bottom: menuRect.bottom ?? undefined,
                left: menuRect.left,
                width: menuRect.width,
              }}
              className="z-[90] max-h-56 overflow-auto rounded-md border border-hae-line bg-white p-1 shadow-lg"
            >
              {options.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-hae-slate">No users found</p>
              ) : (
                options.map((name) => (
                  <label
                    key={name}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hae-mist"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(name)}
                      onChange={() => toggle(name)}
                    />
                    {name}
                  </label>
                ))
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
