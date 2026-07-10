import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { MODULES, moduleHref } from '@hae/ui'
import { canAccessModule } from '../../../../packages/ui/src/rbac.js'
import { navigateToModule } from '../../../../packages/ui/src/sso.js'
import { EXEC_INBOX_EMAILS } from '../constants'

export default function Sidebar({ open = false, onClose }) {
  const { user, userProfile, isAdmin, logout, roleLabel, permissions } = useAuth()
  const isExecInboxUser = EXEC_INBOX_EMAILS.includes((user?.email || '').toLowerCase())
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
          className="h-10 w-auto max-w-[180px] object-contain"
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
          <NavLink to="/help" className={linkClass} onClick={handleNav}>
            Help
          </NavLink>
          <NavLink to="/surveys" className={linkClass} onClick={handleNav}>
            Surveys
          </NavLink>
          {isExecInboxUser && (
            <NavLink to="/executive-inbox" className={linkClass} onClick={handleNav}>
              Executive Inbox
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass} onClick={handleNav}>
              Admin
            </NavLink>
          )}
        </div>

        <div className="mb-1 px-3 text-[10px] font-semibold tracking-wider text-hae-slate uppercase">
          Programs
        </div>
        <div className="mb-4 space-y-0.5">
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

        <div className="mb-1 px-3 text-[10px] font-semibold tracking-wider text-hae-slate uppercase">
          Platform
        </div>
        <div className="space-y-0.5">
          {MODULES.filter(
            (m) => m.id === 'tracker' || canAccessModule(permissions, m.id)
          ).map((m) => {
            if (m.id === 'tracker') {
              return (
                <div
                  key={m.id}
                  className="rounded-md bg-hae-crimson/10 px-3 py-2 text-sm font-semibold text-hae-crimson"
                >
                  {m.short}
                  <div className="text-[11px] font-normal text-hae-slate">
                    {m.description}
                  </div>
                </div>
              )
            }
            return (
              <a
                key={m.id}
                href={moduleHref(m)}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                    return
                  }
                  e.preventDefault()
                  navigateToModule(m)
                }}
                className="block rounded-md px-3 py-2 text-sm text-hae-ink/80 hover:bg-black/5"
              >
                {m.short}
                <div className="text-[11px] text-hae-slate">{m.description}</div>
              </a>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-hae-line px-4 py-3">
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
