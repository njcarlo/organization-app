import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Chevron, NavIcon, iconForNavItem } from './navIcons.jsx'

/**
 * Dark expandable sidenav (Thermomix-style pattern, HAE branding).
 *
 * sections: [
 *   { id, label, to?, end?, icon?, items?: [{ to, label, end?, icon?, description? }] }
 * ]
 * - Leaf section: has `to`, no `items` → top-level link with chevron affordance optional
 * - Group section: has `items` → expandable; children render as centered icon + label
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

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[15.5rem] max-w-[85vw] flex-col overflow-hidden bg-[#2b3038] text-white transition-transform duration-200 lg:static lg:z-0 lg:h-full lg:max-w-none lg:translate-x-0 lg:shrink-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* White brand strip — app title, not an external logo */}
      <div className="shrink-0 border-b border-black/10 bg-white px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
              {subtitle || 'In this app'}
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-hae-ink">
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
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
        aria-label={`${title} navigation`}
      >
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
                  `flex items-center justify-between gap-2 px-4 py-3.5 text-[15px] font-medium transition-colors ${
                    isActive
                      ? 'bg-white/5 text-[#7ec8d8]'
                      : 'text-white/90 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <span className="truncate">{section.label}</span>
                <Chevron open={false} />
              </NavLink>
            )
          }

          const isOpen = expanded.has(section.id)
          const groupActive = activeGroupIds.has(section.id)
          const childItems = section.items || []

          return (
            <div key={section.id} className="border-b border-white/5 last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(section.id)}
                aria-expanded={isOpen}
                className={`flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-[15px] font-medium transition-colors ${
                  groupActive || isOpen
                    ? 'text-[#7ec8d8]'
                    : 'text-white/90 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="truncate">{section.label}</span>
                <Chevron open={isOpen} />
              </button>

              {isOpen ? (
                <div className="space-y-1 px-2 pb-4 pt-1">
                  {childItems.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-white/45">
                      {section.emptyLabel || 'Nothing here yet'}
                    </p>
                  ) : (
                    childItems.map((item) => {
                      const icon = iconForNavItem(item)
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          onClick={close}
                          className={({ isActive }) =>
                            `flex flex-col items-center gap-2 rounded-md px-3 py-4 text-center transition-colors ${
                              isActive
                                ? 'bg-white/10 text-[#7ec8d8]'
                                : 'text-white/70 hover:bg-white/5 hover:text-white'
                            }`
                          }
                        >
                          <span
                            className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${
                              pathMatches(location.pathname, item.to, item.end)
                                ? 'bg-[#7ec8d8]/15 text-[#7ec8d8]'
                                : 'bg-white/5 text-white/80'
                            }`}
                          >
                            <NavIcon name={icon} />
                          </span>
                          <span className="text-[12px] font-medium leading-snug">
                            {item.label}
                          </span>
                          {item.description ? (
                            <span className="text-[10px] leading-snug text-white/45">
                              {item.description}
                            </span>
                          ) : null}
                        </NavLink>
                      )
                    })
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="truncate text-sm font-medium text-white">
          {userName || 'User'}
        </div>
        {roleLabel ? (
          <div className="text-[11px] text-white/55">{roleLabel}</div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {helpTo ? (
            <NavLink
              to={helpTo}
              onClick={close}
              className="text-xs font-semibold text-[#7ec8d8] hover:underline"
            >
              Help
            </NavLink>
          ) : null}
          {onLogout ? (
            <button
              type="button"
              onClick={() => onLogout()}
              className="text-xs text-white/55 hover:text-white"
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
 * (or a single "Pages" group when there are several).
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
    // Prefer one expandable block of icon tiles over a long leaf list.
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
