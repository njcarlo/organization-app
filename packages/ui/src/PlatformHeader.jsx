import { hubHref, MODULES, moduleHref, getModule } from './modules.js'
import { navigateToModule } from './sso.js'
import { useFeatures } from './FeaturesContext.jsx'

/**
 * Top site header — brand + platform switcher in a single row.
 * Markup/classes match packages/branding/src/platform-header.css and the hub landing.
 * Left: logo + “Now in”; right: app chips. Sidenav stays scoped to the selected platform.
 */
export default function PlatformHeader({
  moduleId = null,
  title,
  userName,
  roleLabel,
  canAccessModule,
  onMenuClick,
  menuOpen = false,
  /** When true (hub), Hub chip is current and all modules are listed. */
  isHub = false,
}) {
  const current = getModule(moduleId)
  const displayTitle =
    title || (isHub ? 'Platform Hub' : current?.name) || 'HAE Platform'
  const { isModuleEnabled } = useFeatures()

  const platforms = MODULES.filter((m) => {
    if (!isModuleEnabled(m.id)) return false
    if (isHub) return true
    return m.id === moduleId || (canAccessModule ? canAccessModule(m.id) : true)
  })

  const goModule = (e, m) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigateToModule(m)
  }

  return (
    <header className="hae-platform-header">
      <div className="hae-platform-header__row">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="hae-platform-header__menu"
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
          className="hae-platform-header__brand"
          title="HAE Platform hub"
        >
          <img src="/hae-logo.webp" alt="Harvard Alumni Entrepreneurs" />
        </a>

        <div className="hae-platform-header__divider" aria-hidden />

        <div className="hae-platform-header__title-block">
          <div className="hae-platform-header__kicker">Now in</div>
          <div className="hae-platform-header__title">{displayTitle}</div>
        </div>

        <div className="hae-platform-header__spacer" aria-hidden />

        <nav className="hae-platform-header__nav" aria-label="Platform apps">
          {isHub ? (
            <span
              className="hae-platform-header__chip is-current"
              aria-current="page"
            >
              Hub
            </span>
          ) : (
            <a href={hubHref()} className="hae-platform-header__chip">
              Hub
            </a>
          )}
          {platforms.map((m) => {
            const active = !isHub && m.id === moduleId
            if (active) {
              return (
                <span
                  key={m.id}
                  aria-current="page"
                  className="hae-platform-header__chip is-current"
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
                className="hae-platform-header__chip"
              >
                {m.short}
              </a>
            )
          })}
        </nav>

        {(userName || roleLabel) && (
          <div className="hae-platform-header__user">
            <div className="hae-platform-header__user-name">
              {userName || 'Signed in'}
            </div>
            {roleLabel ? (
              <div className="hae-platform-header__user-role">{roleLabel}</div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  )
}
