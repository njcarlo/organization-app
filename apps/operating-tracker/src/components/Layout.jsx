import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PlatformHeader } from '@hae/ui'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import NotificationsBell from './NotificationsBell'

export default function Layout() {
  const { userProfile, roleLabel, canAccessModule } = useAuth()
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-hae-mist print:h-auto print:overflow-visible print:bg-white">
      <div className="shrink-0 print:hidden">
        <PlatformHeader
          moduleId="tracker"
          title="Operations"
          userName={userProfile?.name}
          roleLabel={roleLabel}
          canAccessModule={canAccessModule}
          onMenuClick={() => setNavOpen(true)}
          menuOpen={navOpen}
          actions={<NotificationsBell />}
        />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden print:h-auto print:min-h-0 print:overflow-visible">
        {navOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-hae-ink/40 lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <div className="print:hidden">
          <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(184,0,40,0.06),transparent_55%),linear-gradient(180deg,#f3f3f3_0%,#f6f6f6_40%,#f0f0f0_100%)] print:h-auto print:overflow-visible print:bg-white">
          <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:px-0 print:py-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
