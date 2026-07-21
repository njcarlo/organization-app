import { useEffect, useRef, useState } from 'react'
import { hubHref, getVisibleModules, moduleHref, getModule } from './modules.js'
import { isHubHidden } from './platformSurface.js'
import { navigateToModule } from './sso.js'
import { useFeatures } from './FeaturesContext.jsx'

/**
 * Top site header — brand + optional platform switcher.
 * When the product surface is Tracker-only, Hub and other apps are hidden
 * (apps/data remain in the repo; they are just not linked here).
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
  /** Optional extra controls (e.g. a notifications bell) rendered before the user block. */
  actions = null,
}) {
  const current = getModule(moduleId)
  const displayTitle =
    title || (isHub ? 'Platform Hub' : current?.name) || 'HAE Platform'
  const { isModuleEnabled } = useFeatures()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef(null)
  const hideHub = isHubHidden()
  const brandHref = hideHub && !isHub ? '/' : hubHref()

  const platforms = getVisibleModules().filter((m) => {
    if (!isModuleEnabled(m.id)) return false
    if (isHub) return true
    return m.id === moduleId || (canAccessModule ? canAccessModule(m.id) : true)
  })

  const showSwitcher = !hideHub || platforms.length > 1 || isHub

  useEffect(() => {
    if (!switcherOpen) return undefined
    const onPointerDown = (e) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setSwitcherOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setSwitcherOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [switcherOpen])

  const goModule = (e, m) => {
    setSwitcherOpen(false)
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
          href={brandHref}
          className="hae-platform-header__brand"
          title={hideHub ? displayTitle : 'HAE Platform hub'}
        >
          <img src="/hae-logo.webp" alt="Harvard Alumni Entrepreneurs" />
        </a>

        <div className="hae-platform-header__divider" aria-hidden />

        {isHub && !hideHub ? (
          <div className="hae-platform-header__title-block">
            <div className="hae-platform-header__kicker">Now in</div>
            <div className="hae-platform-header__title">{displayTitle}</div>
          </div>
        ) : showSwitcher ? (
          <div className="hae-platform-header__switcher" ref={switcherRef}>
            <button
              type="button"
              className="hae-platform-header__title-block hae-platform-header__switcher-trigger"
              onClick={() => setSwitcherOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={switcherOpen}
            >
              <div className="hae-platform-header__kicker">Now in</div>
              <div className="hae-platform-header__title">
                {displayTitle}
                <svg
                  className="hae-platform-header__switcher-chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M2.5 4.5 6 8l3.5-3.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            {switcherOpen ? (
              <div className="hae-platform-header__switcher-menu" role="menu">
                {!hideHub ? (
                  <a
                    href={hubHref()}
                    className="hae-platform-header__switcher-item"
                    role="menuitem"
                  >
                    <span className="hae-platform-header__switcher-item-name">Hub</span>
                    <span className="hae-platform-header__switcher-item-desc">
                      All HAE apps
                    </span>
                  </a>
                ) : null}
                {platforms.map((m) => {
                  const active = m.id === moduleId
                  return (
                    <a
                      key={m.id}
                      href={moduleHref(m)}
                      onClick={(e) => goModule(e, m)}
                      className={`hae-platform-header__switcher-item${
                        active ? ' is-current' : ''
                      }`}
                      role="menuitem"
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="hae-platform-header__switcher-item-name">
                        {m.name}
                      </span>
                      <span className="hae-platform-header__switcher-item-desc">
                        {m.description}
                      </span>
                    </a>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="hae-platform-header__title-block">
            <div className="hae-platform-header__kicker">HAE</div>
            <div className="hae-platform-header__title">{displayTitle}</div>
          </div>
        )}

        <div className="hae-platform-header__spacer" aria-hidden />

        {isHub && !hideHub ? (
          <nav className="hae-platform-header__nav" aria-label="Platform apps">
            <span className="hae-platform-header__chip is-current" aria-current="page">
              Hub
            </span>
            {platforms.map((m) => (
              <a
                key={m.id}
                href={moduleHref(m)}
                onClick={(e) => goModule(e, m)}
                className="hae-platform-header__chip"
              >
                {m.short}
              </a>
            ))}
          </nav>
        ) : null}

        {actions ? <div className="hae-platform-header__actions">{actions}</div> : null}

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
