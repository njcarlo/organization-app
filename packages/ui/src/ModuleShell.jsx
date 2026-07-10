import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { getModule } from './modules.js'
import { hasAnyPermission, hasPermission } from './rbac.js'
import PlatformHeader from './PlatformHeader.jsx'

/**
 * Shared shell for LMS / CRM / AMS / EiR apps.
 * Header switches platforms; sidenav is only for the selected app.
 * navItems: [{ to, label, end?, adminOnly?, permission?, anyOf? }]
 *          or (ctx) => items[]
 */
export default function ModuleShell({
  moduleId,
  title,
  navItems = [],
}) {
  const auth = useAuth()
  const { userProfile, logout, isAdmin, isStaff, role, roleLabel, permissions, canAccessModule } =
    auth
  const [navOpen, setNavOpen] = useState(false)
  const current = getModule(moduleId)
  const displayTitle = title || current?.name || 'HAE'

  const resolvedNav =
    typeof navItems === 'function'
      ? navItems({ isAdmin, isStaff, role, userProfile, permissions, hasPermission: auth.hasPermission })
      : navItems

  const visibleNav = resolvedNav.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.staffOnly && !isStaff) return false
    if (item.permission && !hasPermission(permissions, item.permission)) return false
    if (item.anyOf?.length && !hasAnyPermission(permissions, item.anyOf)) return false
    return true
  })

  useEffect(() => {
    if (!navOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [navOpen])

  const linkClass = ({ isActive }) =>
    `block rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-hae-crimson/10 font-semibold text-hae-crimson'
        : 'text-hae-ink/80 hover:bg-black/5'
    }`

  const closeNav = () => setNavOpen(false)

  const sidebar = (
    <>
      <div className="border-b border-hae-line px-4 py-4">
        <div className="text-[10px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
          In this app
        </div>
        <div className="mt-1 text-sm font-semibold text-hae-ink">{displayTitle}</div>
        {current?.description ? (
          <p className="mt-1 text-[11px] leading-snug text-hae-slate">
            {current.description}
          </p>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={`${displayTitle} navigation`}>
        <div className="space-y-0.5">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkClass}
              onClick={closeNav}
            >
              {item.label}
            </NavLink>
          ))}
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
            onClick={closeNav}
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
    </>
  )

  return (
    <div className="flex min-h-screen flex-col bg-hae-mist">
      <PlatformHeader
        moduleId={moduleId}
        title={displayTitle}
        userName={userProfile?.name}
        roleLabel={roleLabel}
        canAccessModule={canAccessModule}
        onMenuClick={() => setNavOpen(true)}
        menuOpen={navOpen}
      />

      <div className="flex min-h-0 flex-1">
        {navOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-hae-ink/40 lg:hidden"
            onClick={closeNav}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-60 max-w-[85vw] flex-col border-r border-hae-line bg-white transition-transform duration-200 lg:static lg:z-0 lg:h-auto lg:max-w-none lg:translate-x-0 lg:shrink-0 ${
            navOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-hae-line px-3 py-2 lg:hidden">
            <span className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
              {displayTitle}
            </span>
            <button
              type="button"
              onClick={closeNav}
              className="rounded-md px-2 py-1 text-sm text-hae-ink hover:bg-black/5"
              aria-label="Close navigation"
            >
              ✕
            </button>
          </div>
          {sidebar}
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
