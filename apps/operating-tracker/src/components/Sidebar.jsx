import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getModule, FEATURES, useFeatures } from '@hae/ui'

/** Tracker sidenav — only this app’s pages (platform switch lives in the header). */
export default function Sidebar({ open = false, onClose }) {
  const { userProfile, isAdmin, logout, roleLabel } = useAuth()
  const { isEnabled } = useFeatures()
  const [programs, setPrograms] = useState([])
  const current = getModule('tracker')

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
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-60 max-w-[85vw] flex-col overflow-hidden border-r border-hae-line bg-white transition-transform duration-200 lg:static lg:z-0 lg:h-full lg:max-w-none lg:translate-x-0 lg:shrink-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-hae-line px-3 py-2 lg:hidden">
        <span className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
          Operating Tracker
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

      <div className="shrink-0 border-b border-hae-line px-4 py-4">
        <div className="text-[10px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
          In this app
        </div>
        <div className="mt-1 text-sm font-semibold text-hae-ink">Operating Tracker</div>
        {current?.description ? (
          <p className="mt-1 text-[11px] leading-snug text-hae-slate">
            {current.description}
          </p>
        ) : null}
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3"
        aria-label="Tracker navigation"
      >
        <div className="mb-3 space-y-0.5">
          <NavLink to="/" end className={linkClass} onClick={handleNav}>
            Dashboard
          </NavLink>
          <NavLink to="/my-tasks" className={linkClass} onClick={handleNav}>
            My Tasks
          </NavLink>
          {isEnabled(FEATURES.NOTIFICATIONS) ? (
            <NavLink to="/notifications" className={linkClass} onClick={handleNav}>
              Notifications
            </NavLink>
          ) : null}
          {isEnabled(FEATURES.SURVEYS) ? (
            <NavLink to="/surveys" className={linkClass} onClick={handleNav}>
              Surveys
            </NavLink>
          ) : null}
          <NavLink to="/help" className={linkClass} onClick={handleNav}>
            Help
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
        <div className="mb-2 space-y-0.5">
          {programs.length === 0 ? (
            <p className="px-3 py-2 text-xs text-hae-slate">No programs yet</p>
          ) : (
            programs.map((p) => (
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
            ))
          )}
        </div>
      </nav>

      <div className="shrink-0 border-t border-hae-line px-4 py-3">
        <div className="truncate text-sm font-medium text-hae-ink">
          {userProfile?.name || 'User'}
        </div>
        <div className="text-[11px] text-hae-slate">{roleLabel}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <NavLink
            to="/help"
            onClick={handleNav}
            className="text-xs font-semibold text-hae-crimson hover:underline"
          >
            Help
          </NavLink>
          <button
            type="button"
            onClick={() => logout()}
            className="text-xs text-hae-slate hover:text-hae-crimson"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
