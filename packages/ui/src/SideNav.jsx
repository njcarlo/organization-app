import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Chevron, NavIcon, iconForNavItem } from './navIcons.jsx'

/**
 * HAE in-app sidenav.
 *
 * Expandable sections with a single-column icon + label list.
 * Crimson accents mark the active route and open groups.
 *
 * sections: [
 *   { id, label, to?, end?, icon?, emptyLabel?, actions?: [{ key, label, onClick, danger? }],
 *     onReorderItems?: (orderedItems) => void, onRename?: (newLabel) => void,
 *     items?: [{ id?, to, label, end?, icon?, description?, actions?: [{ key, label, onClick, danger? }] }] }
 * ]
 *
 * Items are drag-reorderable within a section when the section provides
 * `onReorderItems` — only items carrying an `id` become draggable; items
 * without one (e.g. a fixed "Dashboard" link ahead of a dynamic list) stay
 * pinned in place. `onReorderItems` is called with the full reordered
 * items array so the caller can persist the new order.
 *
 * Sections themselves are drag-reorderable against each other when
 * `onReorderSections` is passed to `SideNav` — only sections carrying
 * `draggable: true` become movable; others (e.g. a fixed "Workspace" group)
 * stay pinned in place. It's called with the full reordered sections array.
 * Sections with `onRename` get an inline rename affordance on hover.
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
  onReorderSections,
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

  const [renamingSectionId, setRenamingSectionId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')

  const startRename = (section) => {
    setRenamingSectionId(section.id)
    setRenameDraft(section.label)
  }
  const commitRename = (section) => {
    const value = renameDraft.trim()
    setRenamingSectionId(null)
    if (value && value !== section.label) section.onRename?.(value)
  }
  const cancelRename = () => setRenamingSectionId(null)

  const [openMenuKey, setOpenMenuKey] = useState(null)
  const [menuRect, setMenuRect] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  const closeMenu = () => {
    setOpenMenuKey(null)
    setMenuRect(null)
  }

  const toggleMenu = (key, buttonEl, actionCount) => {
    if (openMenuKey === key) {
      closeMenu()
      return
    }
    const rect = buttonEl.getBoundingClientRect()
    const estimatedHeight = actionCount * 36 + 16
    const openUpward = rect.bottom + estimatedHeight + 4 > window.innerHeight
    setMenuRect({
      top: openUpward ? null : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : null,
      right: window.innerWidth - rect.right,
    })
    setOpenMenuKey(key)
  }

  useEffect(() => {
    if (!openMenuKey) return
    const handlePointer = (e) => {
      if (buttonRef.current?.contains(e.target)) return
      if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu()
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') closeMenu()
    }
    const handleScrollOrResize = () => closeMenu()
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [openMenuKey])

  const renderSection = (section, dragProps = {}) => {
    const { dragHandle, wrapperRef, wrapperStyle, isDragging } = dragProps
    const hasChildren = Array.isArray(section.items)
    if (!hasChildren && section.to) {
      return (
        <NavLink
          key={section.id}
          to={section.to}
          end={section.end}
          onClick={close}
          className={({ isActive }) =>
            `relative flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-hae-crimson text-white shadow-[0_4px_12px_rgba(184,0,40,0.25)]'
                : 'text-hae-ink/80 hover:bg-hae-mist hover:text-hae-ink'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
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
    const isRenaming = renamingSectionId === section.id
    const menuActions = [
      ...(section.onRename
        ? [{ key: 'rename', label: 'Rename section', onClick: () => startRename(section) }]
        : []),
      ...(Array.isArray(section.actions) ? section.actions : []),
    ]
    const menuKey = `section:${section.id}`
    const menuOpen = openMenuKey === menuKey

    return (
      <div
        key={section.id}
        ref={wrapperRef}
        style={wrapperStyle}
        className={`group/section rounded-2xl ${isDragging ? 'z-10 opacity-90' : ''}`}
      >
        <div className="relative flex items-center gap-0.5">
          {dragHandle ? (
            <button
              type="button"
              {...dragHandle.attributes}
              {...dragHandle.listeners}
              ref={dragHandle.setActivatorNodeRef}
              aria-label={`Reorder ${section.label}`}
              className="flex h-8 w-4 shrink-0 touch-none items-center justify-center rounded text-hae-slate/50 opacity-0 hover:text-hae-ink group-hover/section:opacity-100 active:cursor-grabbing cursor-grab"
            >
              <NavIcon name="grip" className="[&>svg]:h-4 [&>svg]:w-4" />
            </button>
          ) : (
            <span className="h-8 w-4 shrink-0" aria-hidden />
          )}
          {isRenaming ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={() => commitRename(section)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitRename(section)
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelRename()
                }
              }}
              className="min-w-0 flex-1 rounded-xl border border-hae-crimson/40 bg-white px-2.5 py-2 text-sm font-semibold text-hae-ink outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => toggle(section.id)}
              aria-expanded={isOpen}
              className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl py-2.5 pl-3 pr-3 text-left text-sm font-semibold transition-colors ${
                groupActive || isOpen
                  ? 'text-hae-crimson'
                  : 'text-hae-ink hover:bg-hae-mist'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
              <span
                className={groupActive || isOpen ? 'text-hae-crimson' : 'text-hae-slate'}
              >
                <Chevron open={isOpen} />
              </span>
            </button>
          )}
          {!isRenaming && menuActions.length > 0 ? (
            <div
              className="relative shrink-0"
              ref={menuOpen ? buttonRef : undefined}
            >
              <button
                type="button"
                onClick={(e) => toggleMenu(menuKey, e.currentTarget, menuActions.length)}
                aria-label={`${section.label} actions`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                data-open={menuOpen}
                className="flex h-7 w-7 items-center justify-center rounded-full text-hae-slate opacity-0 hover:bg-hae-mist hover:text-hae-ink focus:opacity-100 focus:outline-none group-hover/section:opacity-100 data-[open=true]:bg-hae-mist data-[open=true]:opacity-100"
              >
                <NavIcon name="kebab" className="[&>svg]:h-4 [&>svg]:w-4" />
              </button>
              {menuOpen && menuRect
                ? createPortal(
                    <div
                      ref={menuRef}
                      role="menu"
                      style={{
                        position: 'fixed',
                        top: menuRect.top ?? undefined,
                        bottom: menuRect.bottom ?? undefined,
                        right: menuRect.right,
                      }}
                      className="z-50 w-44 overflow-hidden rounded-2xl border border-transparent bg-white py-1 shadow-xl"
                    >
                      {menuActions.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            closeMenu()
                            action.onClick()
                          }}
                          className={`block w-full px-3 py-2 text-left text-sm hover:bg-hae-mist ${
                            action.danger ? 'text-hae-red' : 'text-hae-ink'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )
                : null}
            </div>
          ) : (
            <span className="h-7 w-7 shrink-0" aria-hidden />
          )}
        </div>

        {isOpen ? (
          <div className="mb-2 mt-0.5 space-y-0.5">
            {childItems.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-hae-slate">
                {section.emptyLabel || 'Nothing here yet'}
              </p>
            ) : (
              (() => {
                const reorderable = typeof section.onReorderItems === 'function'
                const staticItems = reorderable
                  ? childItems.filter((it) => it.id == null)
                  : childItems
                const draggableItems = reorderable
                  ? childItems.filter((it) => it.id != null)
                  : []
                const renderRow = (item, dragProps) => (
                  <NavItemRow
                    key={item.to}
                    item={item}
                    active={pathMatches(location.pathname, item.to, item.end)}
                    close={close}
                    openMenuKey={openMenuKey}
                    toggleMenu={toggleMenu}
                    closeMenu={closeMenu}
                    menuRect={menuRect}
                    buttonRef={buttonRef}
                    menuRef={menuRef}
                    {...dragProps}
                  />
                )
                return (
                  <>
                    {staticItems.map((item) => renderRow(item))}
                    {draggableItems.length > 0 ? (
                      <SortableItemList
                        items={draggableItems}
                        onReorder={section.onReorderItems}
                        renderItem={renderRow}
                      />
                    ) : null}
                  </>
                )
              })()
            )}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-80 max-w-[85vw] flex-col overflow-hidden border-r-0 bg-white shadow-[4px_0_24px_rgba(26,26,26,0.06)] transition-transform duration-200 lg:static lg:z-0 lg:h-full lg:max-w-none lg:translate-x-0 lg:shrink-0 lg:shadow-none ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="shrink-0 px-4 py-5 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
              {subtitle || 'In this app'}
            </div>
            <div className="mt-1 truncate text-base font-semibold text-hae-ink">
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-full px-2 py-1 text-sm text-hae-slate hover:bg-hae-mist lg:hidden"
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
        aria-label={`${title} navigation`}
      >
        <div className="space-y-1">
          {(() => {
            const reorderableSections = typeof onReorderSections === 'function'
            const staticSections = reorderableSections
              ? sections.filter((s) => !s.draggable)
              : sections
            const draggableSections = reorderableSections
              ? sections.filter((s) => s.draggable)
              : []
            return (
              <>
                {staticSections.map((section) => renderSection(section))}
                {draggableSections.length > 0 ? (
                  <SortableSectionList
                    sections={draggableSections}
                    onReorder={onReorderSections}
                    renderSection={renderSection}
                  />
                ) : null}
              </>
            )
          })()}
        </div>
      </nav>

      <div className="shrink-0 mx-3 mb-3 rounded-2xl bg-hae-mist px-4 py-3">
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

function NavItemRow({
  item,
  active,
  close,
  openMenuKey,
  toggleMenu,
  closeMenu,
  menuRect,
  buttonRef,
  menuRef,
  dragHandle,
  wrapperRef,
  wrapperStyle,
  isDragging,
}) {
  const icon = iconForNavItem(item)
  const hasActions = Array.isArray(item.actions) && item.actions.length > 0
  const menuKey = item.to
  const menuOpen = openMenuKey === menuKey

  return (
    <div
      ref={wrapperRef}
      style={wrapperStyle}
      className={`group relative flex items-center gap-0.5 ${isDragging ? 'z-10 opacity-90' : ''}`}
    >
      {dragHandle ? (
        <button
          type="button"
          {...dragHandle.attributes}
          {...dragHandle.listeners}
          ref={dragHandle.setActivatorNodeRef}
          aria-label={`Reorder ${item.label}`}
          className="flex h-8 w-4 shrink-0 touch-none items-center justify-center rounded text-hae-slate/50 opacity-0 hover:text-hae-ink group-hover:opacity-100 active:cursor-grabbing cursor-grab"
        >
          <NavIcon name="grip" className="[&>svg]:h-4 [&>svg]:w-4" />
        </button>
      ) : null}
      <NavLink
        to={item.to}
        end={item.end}
        onClick={close}
        title={item.description || item.label}
        className={`relative flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl py-2 pl-3 text-sm transition-colors ${
          hasActions ? 'pr-9' : 'pr-3'
        } ${
          active
            ? 'bg-hae-crimson text-white font-semibold shadow-[0_4px_12px_rgba(184,0,40,0.22)]'
            : 'font-medium text-hae-ink/75 hover:bg-hae-mist hover:text-hae-ink'
        }`}
      >
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            active ? 'bg-white/20 text-white' : 'bg-hae-mist/80 text-hae-slate'
          }`}
        >
          <NavIcon name={icon} className="[&>svg]:h-4 [&>svg]:w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate leading-snug">{item.label}</span>
      </NavLink>
      {hasActions ? (
        <div
          className="absolute right-1 top-1/2 -translate-y-1/2"
          ref={menuOpen ? buttonRef : undefined}
        >
          <button
            type="button"
            onClick={(e) => toggleMenu(menuKey, e.currentTarget, item.actions.length)}
            aria-label={`${item.label} actions`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-open={menuOpen}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-hae-slate opacity-0 hover:bg-hae-mist hover:text-hae-ink focus:opacity-100 focus:outline-none group-hover:opacity-100 data-[open=true]:bg-hae-mist data-[open=true]:opacity-100"
          >
            <NavIcon name="kebab" className="[&>svg]:h-4 [&>svg]:w-4" />
          </button>
          {menuOpen && menuRect
            ? createPortal(
                <div
                  ref={menuRef}
                  role="menu"
                  style={{
                    position: 'fixed',
                    top: menuRect.top ?? undefined,
                    bottom: menuRect.bottom ?? undefined,
                    right: menuRect.right,
                  }}
                  className="z-50 w-44 overflow-hidden rounded-2xl border border-transparent bg-white py-1 shadow-xl"
                >
                  {item.actions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeMenu()
                        action.onClick()
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-hae-mist ${
                        action.danger ? 'text-hae-red' : 'text-hae-ink'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>,
                document.body
              )
            : null}
        </div>
      ) : null}
    </div>
  )
}

function SortableNavItem({ item, renderItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  return renderItem(item, {
    wrapperRef: setNodeRef,
    wrapperStyle: { transform: CSS.Transform.toString(transform), transition },
    isDragging,
    dragHandle: { attributes, listeners, setActivatorNodeRef },
  })
}

function SortableItemList({ items, onReorder, renderItem }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((it) => it.id === active.id)
    const newIndex = items.findIndex((it) => it.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableNavItem key={item.id} item={item} renderItem={renderItem} />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableSectionItem({ section, renderSection }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  return renderSection(section, {
    wrapperRef: setNodeRef,
    wrapperStyle: { transform: CSS.Transform.toString(transform), transition },
    isDragging,
    dragHandle: { attributes, listeners, setActivatorNodeRef },
  })
}

function SortableSectionList({ sections, onReorder, renderSection }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(sections, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {sections.map((section) => (
          <SortableSectionItem key={section.id} section={section} renderSection={renderSection} />
        ))}
      </SortableContext>
    </DndContext>
  )
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
