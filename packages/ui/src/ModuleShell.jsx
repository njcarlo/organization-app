import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { MODULES, moduleHref } from './modules.js'

/**
 * Shared shell for LMS / CRM / AMS / EiR apps.
 * navItems: [{ to, label, end? }]
 * moduleId: 'lms' | 'crm' | 'ams' | 'tracker' | 'eir'
 */
export default function ModuleShell({
  moduleId,
  title,
  navItems = [],
}) {
  const { userProfile, logout } = useAuth()
  const [navOpen, setNavOpen] = useState(false)

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
        <img
          src="/hae-logo.webp"
          alt="Harvard Alumni Entrepreneurs"
          className="h-9 w-auto object-contain"
        />
        <div className="mt-2 text-[10px] font-semibold tracking-[0.14em] text-hae-slate uppercase">
          {title}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-4 space-y-0.5">
          {navItems.map((item) => (
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

        <div className="mb-1 px-3 text-[10px] font-semibold tracking-wider text-hae-slate uppercase">
          Platform
        </div>
        <div className="space-y-0.5">
          {MODULES.map((m) => {
            const active = m.id === moduleId
            if (active) {
              return (
                <div
                  key={m.id}
                  className="rounded-md bg-hae-crimson/10 px-3 py-2 text-sm font-semibold text-hae-crimson"
                >
                  {m.short}
                  <div className="text-[11px] font-normal text-hae-slate">
                    Milestone {m.milestone}
                  </div>
                </div>
              )
            }
            const href = moduleHref(m)
            return (
              <a
                key={m.id}
                href={href}
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
        <button
          type="button"
          onClick={() => logout()}
          className="mt-1 text-xs text-hae-slate hover:text-hae-crimson"
        >
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-hae-mist">
      {navOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-hae-ink/40 lg:hidden"
          onClick={closeNav}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 max-w-[85vw] flex-col border-r border-hae-line bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:max-w-none lg:translate-x-0 lg:shrink-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-hae-line px-3 py-2 lg:hidden">
          <span className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
            Menu
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-hae-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-hae-line text-hae-ink hover:bg-hae-mist"
            aria-label="Open navigation"
            aria-expanded={navOpen}
          >
            <span className="sr-only">Menu</span>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-hae-ink">{title}</div>
            <div className="truncate text-[11px] text-hae-slate">
              {userProfile?.name || 'HAE'}
            </div>
          </div>
          <img
            src="/hae-logo.webp"
            alt=""
            className="h-7 w-auto object-contain"
          />
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
