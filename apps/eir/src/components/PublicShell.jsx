import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuthOptional } from '@hae/ui'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/directory', label: 'Directory' },
  { to: '/how-it-works', label: 'How it works' },
]

/**
 * Marketing shell for the public Expert Office Hours site
 * (parity with sites.google.com/harvardae.org/experts — no login required).
 */
export default function PublicShell() {
  const auth = useAuthOptional()
  const signedIn = Boolean(auth?.user)

  return (
    <div className="min-h-screen bg-hae-mist text-hae-ink">
      <header className="border-b border-hae-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/hae-logo.webp"
              alt="Harvard Alumni Entrepreneurs"
              className="h-10 w-auto object-contain"
            />
            <div className="leading-tight">
              <div className="text-[11px] font-semibold tracking-[0.14em] text-hae-crimson uppercase">
                Expert Office Hours
              </div>
              <div className="text-sm font-semibold text-hae-ink">Find an expert</div>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-2 text-xs font-semibold tracking-wide uppercase ${
                    isActive
                      ? 'text-hae-crimson'
                      : 'text-hae-slate hover:text-hae-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {signedIn ? (
              <Link
                to="/app"
                className="ml-1 bg-hae-crimson px-3 py-2 text-xs font-semibold tracking-wide text-white uppercase"
              >
                Workspace
              </Link>
            ) : (
              <Link
                to="/login"
                className="ml-1 border border-hae-line px-3 py-2 text-xs font-semibold tracking-wide text-hae-ink uppercase"
              >
                Members
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-hae-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-hae-slate sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Office Hours is intended for HarvardAE alumni members.{' '}
            <a href="mailto:info@harvardae.org" className="text-hae-crimson hover:underline">
              info@harvardae.org
            </a>
          </p>
          <a
            href="https://www.harvardae.org/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-hae-crimson hover:underline"
          >
            harvardae.org
          </a>
        </div>
      </footer>
    </div>
  )
}
