import { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { useFeatures } from './FeaturesContext.jsx'
import { getModule } from './modules.js'
import { hasAnyPermission, hasPermission } from './rbac.js'
import PlatformHeader from './PlatformHeader.jsx'
import SideNav, { sectionsFromNavItems } from './SideNav.jsx'

/**
 * Shared shell for LMS / CRM / AMS / EiR apps.
 * Header switches platforms; sidenav is only for the selected app.
 * navItems: [{ to, label, end?, group?, icon?, adminOnly?, permission?, anyOf?, feature? }]
 *          or (ctx) => items[]
 */
export default function ModuleShell({
  moduleId,
  title,
  navItems = [],
  navGroupLabel,
}) {
  const auth = useAuth()
  const { userProfile, logout, isAdmin, isStaff, role, roleLabel, permissions, canAccessModule } =
    auth
  const { isEnabled, isModuleEnabled } = useFeatures()
  const [navOpen, setNavOpen] = useState(false)
  const current = getModule(moduleId)
  const displayTitle = title || current?.name || 'HAE'

  const resolvedNav =
    typeof navItems === 'function'
      ? navItems({
          isAdmin,
          isStaff,
          role,
          userProfile,
          permissions,
          hasPermission: auth.hasPermission,
          isEnabled,
          isModuleEnabled,
        })
      : navItems

  const visibleNav = resolvedNav.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.staffOnly && !isStaff) return false
    if (item.permission && !hasPermission(permissions, item.permission)) return false
    if (item.anyOf?.length && !hasAnyPermission(permissions, item.anyOf)) return false
    if (item.feature && !isEnabled(item.feature)) return false
    return true
  })

  const sections = useMemo(
    () =>
      sectionsFromNavItems(visibleNav, {
        defaultGroupLabel: navGroupLabel || displayTitle,
      }),
    [visibleNav, navGroupLabel, displayTitle]
  )

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

  const closeNav = () => setNavOpen(false)

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-hae-mist">
      <div className="shrink-0">
        <PlatformHeader
          moduleId={moduleId}
          title={displayTitle}
          userName={userProfile?.name}
          roleLabel={roleLabel}
          canAccessModule={canAccessModule}
          onMenuClick={() => setNavOpen(true)}
          menuOpen={navOpen}
        />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {navOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-hae-ink/40 lg:hidden"
            onClick={closeNav}
          />
        ) : null}

        <SideNav
          open={navOpen}
          onClose={closeNav}
          title={displayTitle}
          subtitle="In this app"
          sections={sections}
          userName={userProfile?.name}
          roleLabel={roleLabel}
          onLogout={logout}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
