import { hubHref, MODULES, moduleHref, getModule } from './modules.js'
import { navigateToModule } from './sso.js'

/**
 * Top site header — brand + platform switcher.
 * Matches hub landing chrome; sidenav stays scoped to the selected platform.
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
      <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-3 py-2.5 sm:px-4 lg:px-5">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-hae-line text-hae-ink hover:bg-hae-mist lg:hidden"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
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
          className="flex min-w-0 shrink-0 items-center gap-2.5 no-underline"
          title="HAE Platform hub"
        >
          <img
            src="/hae-logo.webp"
            alt="Harvard Alumni Entrepreneurs"
            className="h-8 w-auto max-w-[140px] object-contain sm:h-9 sm:max-w-[160px]"
          />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-[10px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
              Harvard Alumni Entrepreneurs
            </div>
            <div className="truncate text-sm font-semibold text-hae-ink">HAE Platform</div>
          </div>
        </a>

        <div className="hidden h-6 w-px bg-hae-line md:block" aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-semibold tracking-[0.14em] text-hae-slate uppercase">
            Now in
          </div>
          <div className="truncate text-sm font-semibold text-hae-ink">{displayTitle}</div>
        </div>

        {(userName || roleLabel) && (
          <div className="hidden min-w-0 text-right lg:block">
            <div className="truncate text-xs font-medium text-hae-ink">
              {userName || 'Signed in'}
            </div>
            {roleLabel ? (
              <div className="truncate text-[11px] text-hae-slate">{roleLabel}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-hae-line/80 bg-hae-mist/50">
        <nav
          className="mx-auto flex max-w-[1100px] gap-0.5 overflow-x-auto px-2 py-1.5 sm:px-4 lg:px-5"
          aria-label="Platform apps"
        >
          <a
            href={hubHref()}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-hae-slate transition-colors hover:bg-white hover:text-hae-ink"
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
                  className="shrink-0 rounded-md bg-hae-crimson px-2.5 py-1.5 text-xs font-semibold text-white"
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
                className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-hae-ink/80 transition-colors hover:bg-white hover:text-hae-crimson"
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
