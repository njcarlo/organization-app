import { hubHref, MODULES, moduleHref, getModule } from './modules.js'
import { navigateToModule } from './sso.js'

/**
 * Top site header — brand + platform switcher.
 * Full-width; logo flush left. Sidenav stays scoped to the selected platform.
 */
export default function PlatformHeader({
  moduleId,
  title,
  userName,
  roleLabel,
  canAccessModule,
  onMenuClick,
  menuOpen = false,
}) {
  const current = getModule(moduleId)
  const displayTitle = title || current?.name || 'HAE Platform'

  const platforms = MODULES.filter(
    (m) => m.id === moduleId || (canAccessModule ? canAccessModule(m.id) : true)
  )

  const goModule = (e, m) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigateToModule(m)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-hae-line bg-white/95 backdrop-blur">
      <div className="flex w-full items-center gap-4 px-4 py-3.5 sm:gap-5 sm:px-5 sm:py-4 lg:px-6">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hae-line text-hae-ink hover:bg-hae-mist lg:hidden"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M2 4.5h14M2 9h14M2 13.5h14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}

        <a
          href={hubHref()}
          className="flex shrink-0 items-center no-underline"
          title="HAE Platform hub"
        >
          <img
            src="/hae-logo.webp"
            alt="Harvard Alumni Entrepreneurs"
            className="h-11 w-auto max-w-[200px] object-contain object-left sm:h-12 sm:max-w-[220px]"
          />
        </a>

        <div className="hidden h-8 w-px bg-hae-line sm:block" aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold tracking-[0.14em] text-hae-slate uppercase">
            Now in
          </div>
          <div className="truncate text-base font-semibold text-hae-ink sm:text-lg">
            {displayTitle}
          </div>
        </div>

        {(userName || roleLabel) && (
          <div className="hidden min-w-0 shrink-0 text-right md:block">
            <div className="truncate text-sm font-medium text-hae-ink">
              {userName || 'Signed in'}
            </div>
            {roleLabel ? (
              <div className="truncate text-xs text-hae-slate">{roleLabel}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-hae-line/80 bg-hae-mist/50">
        <nav
          className="flex w-full gap-1 overflow-x-auto px-4 py-2 sm:px-5 lg:px-6"
          aria-label="Platform apps"
        >
          <a
            href={hubHref()}
            className="shrink-0 rounded-md px-3 py-2 text-sm font-semibold text-hae-slate transition-colors hover:bg-white hover:text-hae-ink"
          >
            Hub
          </a>
          {platforms.map((m) => {
            const active = m.id === moduleId
            if (active) {
              return (
                <span
                  key={m.id}
                  aria-current="page"
                  className="shrink-0 rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold text-white"
                >
                  {m.short}
                </span>
              )
            }
            return (
              <a
                key={m.id}
                href={moduleHref(m)}
                onClick={(e) => goModule(e, m)}
                className="shrink-0 rounded-md px-3 py-2 text-sm font-semibold text-hae-ink/80 transition-colors hover:bg-white hover:text-hae-crimson"
              >
                {m.short}
              </a>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
