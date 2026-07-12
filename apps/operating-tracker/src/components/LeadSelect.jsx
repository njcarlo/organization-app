import { useEffect, useRef, useState } from 'react'
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
  const wrapRef = useRef(null)
  const selected = toNameList(value)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const names = users.map((u) => u.name).filter(Boolean)
  const options = Array.from(
    new Set([...selected.filter((n) => !names.includes(n)), ...names])
  )

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
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${selected.length ? '' : 'text-hae-slate/60'}`}>
          {selected.length ? selected.join(', ') : placeholder}
        </span>
        <span className="shrink-0 text-hae-slate/60">▾</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full min-w-[200px] overflow-auto rounded-md border border-hae-line bg-white p-1 shadow-lg">
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
        </div>
      ) : null}
    </div>
  )
}
