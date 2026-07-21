import { visibleModuleIds } from './platformSurface.js'

/** Platform hub (landing) — Firebase Hosting site `hae` */
export const HUB_URL = 'https://hae.web.app'
export const HUB_LOCAL_PORT = 5180

/** Platform modules — one app per milestone / Firebase Hosting site */
export const MODULES = [
  {
    id: 'tracker',
    name: 'Operations',
    short: 'Tracker',
    milestone: 1,
    path: 'https://tracker-hae.web.app',
    localPort: 5173,
    description: 'Programs, projects, and tasks',
    tagline: 'Keep programs moving',
  },
  {
    id: 'lms',
    name: 'Learning',
    short: 'LMS',
    milestone: 2,
    path: 'https://lms-hae.web.app',
    localPort: 5174,
    description: 'Courses, enrollments, sessions',
    tagline: 'Academy & Flagship paths',
  },
  {
    id: 'eir',
    name: 'Experts',
    short: 'EiR',
    milestone: 2,
    path: 'https://eir-hae.web.app',
    localPort: 5177,
    description: 'Public Expert Office Hours directory',
    tagline: 'Find an expert',
  },
  {
    id: 'crm',
    name: 'Relationships',
    short: 'CRM',
    milestone: 3,
    path: 'https://crm-hae.web.app',
    localPort: 5175,
    description: 'Contacts, pipeline, interactions',
    tagline: 'Grow relationships',
  },
  {
    id: 'ams',
    name: 'Membership',
    short: 'AMS',
    milestone: 4,
    path: 'https://ams-hae.web.app',
    localPort: 5176,
    description: 'Members, memberships, events',
    tagline: 'Membership & events',
  },
]

/** Modules exposed in the product UI (header switcher). Others stay in repo. */
export function getVisibleModules() {
  const allowed = visibleModuleIds()
  if (!allowed) return MODULES
  return MODULES.filter((m) => allowed.includes(m.id))
}

export function getModule(moduleId) {
  return MODULES.find((m) => m.id === moduleId) || null
}

/** Resolve hub href for local vs deployed hosting. */
export function hubHref() {
  if (typeof window === 'undefined') return HUB_URL
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://localhost:${HUB_LOCAL_PORT}`
  }
  return HUB_URL
}

/** Resolve cross-app href for local vs deployed hosting. */
export function moduleHref(module) {
  if (typeof window === 'undefined') return module.path
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://localhost:${module.localPort}`
  }
  return module.path
}

/** Absolute URL for a module path (e.g. '/tracking'). */
export function moduleUrl(moduleId, path = '/') {
  const mod = MODULES.find((m) => m.id === moduleId)
  if (!mod) return path
  const base = moduleHref(mod).replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix === '/' ? '' : suffix}`
}
