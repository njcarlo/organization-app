import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Chevron, NavIcon, iconForNavItem } from './navIcons.jsx'

/**
 * HAE in-app sidenav.
 *
 * Expandable sections with a single-column icon + label list.
 * Crimson accents mark the active route and open groups.
 *
 * sections: [
 *   { id, label, to?, end?, icon?, emptyLabel?, actions?: [{ key, label, onClick, danger? }],
 *     items?: [{ to, label, end?, icon?, description?, actions?: [{ key, label, onClick, danger? }] }] }
 * ]
 */
export default function SideNav({
  open = false,
  onClose,
  title,
  subtitle,
  sections = [],
  userName,
  roleLabel,
  onLogout,
  helpTo = '/help',
}) {
  const location = useLocation()

  const activeGroupIds = useMemo(() => {
    const ids = new Set()
    for (const section of sections) {
      if (!section.items?.length) continue
      const hit = section.items.some((item) =>
        pathMatches(location.pathname, item.to, item.end)
      )
      if (hit) ids.add(section.id)
    }
    return ids
  }, [sections, location.pathname])

  const [expanded, setExpanded] = useState(() => {
    if (activeGroupIds.size > 0) return new Set(activeGroupIds)
    const first = sections.find((s) => Array.isArray(s.items))
    return first ? new Set([first.id]) : new Set()
  })

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const id of activeGroupIds) next.add(id)
      return next
    })
  }, [activeGroupIds])

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const close = () => onClose?.()

  const [openMenuKey, setOpenMenuKey] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!openMenuKey) return
    const handlePointer = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuKey(null)
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpenMenuKey(null)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openMenuKey])

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-80 max-w-[85vw] flex-col overflow-hidden border-r border-hae-line bg-white transition-transform duration-200 lg:static lg:z-0 lg:h-full lg:max-w-none lg:translate-x-0 lg:shrink-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Crimson accent rail */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-hae-crimson"
      />

      <div className="shrink-0 border-b border-hae-line bg-hae-mist/60 px-4 py-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
              {subtitle || 'In this app'}
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-hae-ink">
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md px-2 py-1 text-sm text-hae-slate hover:bg-black/5 lg:hidden"
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 pl-3"
        aria-label={`${title} navigation`}
      >
        <div className="space-y-1">
          {sections.map((section) => {
            const hasChildren = Array.isArray(section.items)
            if (!hasChildren && section.to) {
              return (
                <NavLink
                  key={section.id}
                  to={section.to}
                  end={section.end}
                  onClick={close}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-hae-crimson/10 text-hae-crimson'
                        : 'text-hae-ink/80 hover:bg-hae-mist hover:text-hae-ink'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <span
                          aria-hidden
                          className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-hae-crimson"
                        />
                      ) : null}
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isActive
                            ? 'bg-hae-crimson/15 text-hae-crimson'
                            : 'bg-hae-mist text-hae-slate'
                        }`}
                      >
                        <NavIcon
                          name={iconForNavItem(section)}
                          className="[&>svg]:h-4 [&>svg]:w-4"
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                    </>
                  )}
                </NavLink>
              )
            }

            const isOpen = expanded.has(section.id)
            const groupActive = activeGroupIds.has(section.id)
            const childItems = section.items || []
            const sectionAction = Array.isArray(section.actions) ? section.actions[0] : undefined

            return (
              <div key={section.id} className="group/section relative rounded-lg">
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg py-2.5 pl-3 text-left text-sm font-semibold transition-colors ${
                    sectionAction ? 'pr-9' : 'pr-3'
                  } ${
                    groupActive || isOpen
                      ? 'text-hae-crimson'
                      : 'text-hae-ink hover:bg-hae-mist'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{section.label}</span>
                  <span
                    className={
                      groupActive || isOpen ? 'text-hae-crimson' : 'text-hae-slate'
                    }
                  >
                    <Chevron open={isOpen} />
                  </span>
                </button>
                {sectionAction ? (
                  <button
                    type="button"
                    onClick={sectionAction.onClick}
                    aria-label={sectionAction.label}
                    title={sectionAction.label}
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-white text-hae-slate opacity-0 hover:bg-hae-mist hover:text-hae-ink focus:opacity-100 focus:outline-none group-hover/section:opacity-100"
                  >
                    <NavIcon name="plus" className="[&>svg]:h-4 [&>svg]:w-4" />
                  </button>
                ) : null}

                {isOpen ? (
                  <div className="mb-2 mt-0.5 space-y-0.5">
                    {childItems.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-hae-slate">
                        {section.emptyLabel || 'Nothing here yet'}
                      </p>
                    ) : (
                      childItems.map((item) => {
                        const icon = iconForNavItem(item)
                        const active = pathMatches(
                          location.pathname,
                          item.to,
                          item.end
                        )
                        const hasActions = Array.isArray(item.actions) && item.actions.length > 0
                        const menuKey = item.to
                        const menuOpen = openMenuKey === menuKey
                        return (
                          <div key={item.to} className="group relative">
                            <NavLink
                              to={item.to}
                              end={item.end}
                              onClick={close}
                              title={item.description || item.label}
                              className={`relative flex items-center gap-2.5 rounded-lg py-2 pl-3 text-sm transition-colors ${
                                hasActions ? 'pr-9' : 'pr-3'
                              } ${
                                active
                                  ? 'bg-hae-crimson/10 font-semibold text-hae-crimson'
                                  : 'font-medium text-hae-ink/75 hover:bg-hae-mist hover:text-hae-ink'
                              }`}
                            >
                              {active ? (
                                <span
                                  aria-hidden
                                  className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-hae-crimson"
                                />
                              ) : null}
                              <span
                                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                  active
                                    ? 'bg-hae-crimson/15 text-hae-crimson'
                                    : 'bg-hae-mist/80 text-hae-slate'
                                }`}
                              >
                                <NavIcon
                                  name={icon}
                                  className="[&>svg]:h-4 [&>svg]:w-4"
                                />
                              </span>
                              <span className="min-w-0 flex-1 truncate leading-snug">
                                {item.label}
                              </span>
                            </NavLink>
                            {hasActions ? (
                              <div
                                className="absolute right-1 top-1/2 -translate-y-1/2"
                                ref={menuOpen ? menuRef : undefined}
                              >
                                <button
                                  type="button"
                                  onClick={() => setOpenMenuKey(menuOpen ? null : menuKey)}
                                  aria-label={`${item.label} actions`}
                                  aria-haspopup="menu"
                                  aria-expanded={menuOpen}
                                  data-open={menuOpen}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-hae-slate opacity-0 hover:bg-hae-mist hover:text-hae-ink focus:opacity-100 focus:outline-none group-hover:opacity-100 data-[open=true]:bg-hae-mist data-[open=true]:opacity-100"
                                >
                                  <NavIcon name="kebab" className="[&>svg]:h-4 [&>svg]:w-4" />
                                </button>
                                {menuOpen ? (
                                  <div
                                    role="menu"
                                    className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-hae-line bg-white py-1 shadow-lg"
                                  >
                                    {item.actions.map((action) => (
                                      <button
                                        key={action.key}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                          setOpenMenuKey(null)
                                          action.onClick()
                                        }}
                                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-hae-mist ${
                                          action.danger ? 'text-hae-red' : 'text-hae-ink'
                                        }`}
                                      >
                                        {action.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )
                      })
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-hae-line bg-hae-mist/40 px-4 py-3 pl-5">
        <div className="truncate text-sm font-medium text-hae-ink">
          {userName || 'User'}
        </div>
        {roleLabel ? (
          <div className="text-[11px] text-hae-slate">{roleLabel}</div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {helpTo ? (
            <NavLink
              to={helpTo}
              onClick={close}
              className="text-xs font-semibold text-hae-crimson hover:underline"
            >
              Help
            </NavLink>
          ) : null}
          {onLogout ? (
            <button
              type="button"
              onClick={() => onLogout()}
              className="text-xs text-hae-slate hover:text-hae-crimson"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

function pathMatches(pathname, to, end) {
  if (!to) return false
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * Turn a flat ModuleShell nav list into expandable sections.
 * Items with the same `group` share a section; ungrouped items become leaves
 * (or a single group when there are several).
 */
export function sectionsFromNavItems(items, { defaultGroupLabel = 'Pages' } = {}) {
  const leaves = []
  const groups = new Map()

  for (const item of items) {
    const group = item.group
    if (!group) {
      leaves.push({
        id: `leaf-${item.to}`,
        label: item.label,
        to: item.to,
        end: item.end,
        icon: item.icon,
      })
      continue
    }
    if (!groups.has(group)) {
      groups.set(group, {
        id: `group-${group}`,
        label: group,
        items: [],
      })
    }
    groups.get(group).items.push({
      to: item.to,
      label: item.label,
      end: item.end,
      icon: item.icon || iconForNavItem(item),
      description: item.description,
    })
  }

  const grouped = [...groups.values()]
  if (grouped.length === 0 && leaves.length > 1) {
    return [
      {
        id: 'pages',
        label: defaultGroupLabel,
        items: leaves.map((leaf) => ({
          to: leaf.to,
          label: leaf.label,
          end: leaf.end,
          icon: leaf.icon || iconForNavItem(leaf),
        })),
      },
    ]
  }

  return [...leaves, ...grouped]
}
