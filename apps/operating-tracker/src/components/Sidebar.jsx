import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ open = false, onClose }) {
  const { userProfile, isAdmin, logout } = useAuth()
  const [programs, setPrograms] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const snap = await getDocs(collection(db, 'programs'))
      if (cancelled) return
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setPrograms(list)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const linkClass = ({ isActive }) =>
    `block rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-hae-crimson/10 text-hae-crimson font-semibold'
        : 'text-hae-ink/80 hover:bg-black/5'
    }`

  const handleNav = () => {
    onClose?.()
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-60 max-w-[85vw] flex-col border-r border-hae-line bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:max-w-none lg:translate-x-0 lg:shrink-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-hae-line px-3 py-2 lg:hidden">
        <span className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
          Menu
        </span>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded-md px-2 py-1 text-sm text-hae-ink hover:bg-black/5"
          aria-label="Close navigation"
        >
          ✕
        </button>
      </div>

      <div className="border-b border-hae-line px-4 py-4">
        <img
          src="/hae-logo.webp"
          alt="Harvard Alumni Entrepreneurs"
          className="h-10 w-auto object-contain"
        />
        <div className="mt-2 text-[10px] font-semibold tracking-[0.14em] text-hae-slate uppercase">
          Operating Tracker
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-3 space-y-0.5">
          <NavLink to="/" end className={linkClass} onClick={handleNav}>
            Dashboard
          </NavLink>
          <NavLink to="/my-tasks" className={linkClass} onClick={handleNav}>
            My Tasks
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={linkClass} onClick={handleNav}>
              Admin
            </NavLink>
          )}
        </div>

        <div className="mb-1 px-3 text-[10px] font-semibold tracking-wider text-hae-slate uppercase">
          Programs
        </div>
        <div className="space-y-0.5">
          {programs.map((p) => (
            <NavLink
              key={p.id}
              to={`/programs/${p.id}`}
              className={linkClass}
              onClick={handleNav}
            >
              <div className="leading-snug">{p.name}</div>
              {p.lead ? (
                <div className="text-[11px] font-normal text-hae-slate">{p.lead}</div>
              ) : null}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-hae-line px-4 py-3">
        <div className="truncate text-sm font-medium text-hae-ink">
          {userProfile?.name || 'User'}
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-1 text-xs text-hae-slate hover:text-hae-crimson"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
