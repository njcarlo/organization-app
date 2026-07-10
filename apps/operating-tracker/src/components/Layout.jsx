import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PlatformHeader } from '@hae/ui'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'

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
    <div className="flex min-h-screen flex-col bg-hae-mist">
      <PlatformHeader
        moduleId="tracker"
        title="Operating Tracker"
        userName={userProfile?.name}
        roleLabel={roleLabel}
        canAccessModule={canAccessModule}
        onMenuClick={() => setNavOpen(true)}
        menuOpen={navOpen}
      />

      <div className="flex min-h-0 flex-1">
        {navOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-hae-ink/40 lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
