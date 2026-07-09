import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { MODULES } from './modules.js'

/**
 * Shared shell for LMS / CRM / AMS apps.
 * navItems: [{ to, label, end? }]
 * moduleId: 'lms' | 'crm' | 'ams' | 'tracker'
 */
export default function ModuleShell({
  moduleId,
  title,
  navItems = [],
  basePath = '',
}) {
  const { userProfile, logout } = useAuth()

  const linkClass = ({ isActive }) =>
    `block rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-hae-crimson/10 font-semibold text-hae-crimson'
        : 'text-hae-ink/80 hover:bg-black/5'
    }`

  return (
    <div className="flex min-h-screen bg-hae-mist">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-hae-line bg-white">
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
              // Cross-app links: in local/dev each app is separate; on Firebase
              // multi-site hosting they live on different paths/sites.
              const href =
                typeof window !== 'undefined' &&
                window.location.hostname.includes('localhost')
                  ? `#` // same-origin stubs; use platform hub later
                  : m.path
              return (
                <a
                  key={m.id}
                  href={href === '#' ? undefined : href}
                  onClick={
                    href === '#'
                      ? (e) => {
                          e.preventDefault()
                          alert(
                            `${m.name} runs as its own app. Use npm run dev:${m.id} or open the deployed /${m.id}/ site.`
                          )
                        }
                      : undefined
                  }
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
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
