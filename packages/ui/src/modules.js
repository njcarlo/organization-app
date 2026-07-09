/** Platform modules — one app per milestone / Firebase Hosting site */
export const MODULES = [
  {
    id: 'tracker',
    name: 'Operating Tracker',
    short: 'Tracker',
    milestone: 1,
    path: 'https://hae-operating-tracker.web.app',
    localPort: 5173,
    description: 'Programs, projects, and tasks',
  },
  {
    id: 'lms',
    name: 'Learning',
    short: 'LMS',
    milestone: 2,
    path: 'https://hae-lms.web.app',
    localPort: 5174,
    description: 'Courses, enrollments, sessions',
  },
  {
    id: 'eir',
    name: 'Experts',
    short: 'EiR',
    milestone: 2,
    path: 'https://hae-eir.web.app',
    localPort: 5177,
    description: 'Expert Office Hours directory',
  },
  {
    id: 'crm',
    name: 'Relationships',
    short: 'CRM',
    milestone: 3,
    path: 'https://hae-crm.web.app',
    localPort: 5175,
    description: 'Contacts, pipeline, interactions',
  },
  {
    id: 'ams',
    name: 'Membership',
    short: 'AMS',
    milestone: 4,
    path: 'https://hae-ams.web.app',
    localPort: 5176,
    description: 'Members, renewals, events',
  },
]

/** Resolve cross-app href for local vs deployed hosting. */
export function moduleHref(module) {
  if (typeof window === 'undefined') return module.path
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://localhost:${module.localPort}`
  }
  return module.path
}
