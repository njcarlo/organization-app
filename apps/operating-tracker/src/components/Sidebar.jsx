import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const { userProfile, isAdmin, logout } = useAuth()
  const [programs, setPrograms] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const snap = await getDocs(collection(db, 'programs'))
      if (cancelled) return
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setPrograms(list)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const linkClass = ({ isActive }) =>
    `block rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-hae-crimson/10 text-hae-crimson font-semibold'
        : 'text-hae-ink/80 hover:bg-black/5'
    }`

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-hae-line bg-white">
      <div className="border-b border-hae-line px-4 py-4">
        <img
          src="/hae-logo.webp"
          alt="Harvard Alumni Entrepreneurs"
          className="h-10 w-auto object-contain"
        />
        <div className="mt-2 text-[10px] font-semibold tracking-[0.14em] text-hae-slate uppercase">
          Operating Tracker
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-3 space-y-0.5">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/my-tasks" className={linkClass}>
            My Tasks
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          )}
        </div>

        <div className="mb-1 px-3 text-[10px] font-semibold tracking-wider text-hae-slate uppercase">
          Programs
        </div>
        <div className="space-y-0.5">
          {programs.map((p) => (
            <NavLink key={p.id} to={`/programs/${p.id}`} className={linkClass}>
              <div className="leading-snug">{p.name}</div>
              {p.lead ? (
                <div className="text-[11px] font-normal text-hae-slate">{p.lead}</div>
              ) : null}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-hae-line px-4 py-3">
        <div className="truncate text-sm font-medium text-hae-ink">
          {userProfile?.name || 'User'}
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-1 text-xs text-hae-slate hover:text-hae-crimson"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
