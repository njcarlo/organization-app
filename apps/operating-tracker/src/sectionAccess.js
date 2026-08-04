/**
 * Per-user Tracker section restriction.
 *
 * `users/{uid}.sectionAccess` is an array of section ids (static ids below,
 * or a `customSections/{id}` doc id). Empty/missing = unrestricted (today's
 * behavior — full Tracker access per role, as in packages/ui/src/rbac.js).
 * When present and non-empty, the sidebar only shows those sections and
 * routing outside them redirects to "/" (see RestrictedHome).
 *
 * This is an app-level/UI restriction, not a Firestore rules boundary —
 * firestore.rules already grants any `isStaff()` user read/write on all
 * tracker collections, matching the existing client-side-filter convention.
 */

export const TRACKER_SECTIONS = [
  { id: 'programs', label: 'Programs', collectionName: 'programs', pathPrefix: '/programs' },
  { id: 'academy', label: 'Academy', landingPath: '/academy/course-registrations', pathPrefix: '/academy' },
  {
    id: 'custom-programs',
    label: 'Custom Programs',
    collectionName: 'customPrograms',
    pathPrefix: '/custom-programs',
  },
  {
    id: 'documents',
    label: 'Documents & Assets',
    collectionName: 'trackerDocuments',
    pathPrefix: '/documents',
  },
  { id: 'events', label: 'Events & Programs', landingPath: '/events-dashboard', pathPrefix: '/events' },
  { id: 'graphics', label: 'Graphics', landingPath: '/graphics-dashboard', pathPrefix: '/graphics' },
  { id: 'data', label: 'Data Projects', collectionName: 'trackerData', pathPrefix: '/data' },
  {
    id: 'board-commitments',
    label: 'Board Commitments',
    collectionName: 'boardCommitments',
    pathPrefix: '/board-commitments',
  },
  { id: 'chapters', label: 'Chapters', landingPath: '/chapter-leader-dashboard', pathPrefix: '/chapters' },
]

const sortByOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)

export function sectionDef(id) {
  return TRACKER_SECTIONS.find((s) => s.id === id)
}

export function sectionLabel(id, customSections = []) {
  return sectionDef(id)?.label || customSections.find((s) => s.id === id)?.label || id
}

export function isSectionRestricted(sectionAccess) {
  return Array.isArray(sectionAccess) && sectionAccess.length > 0
}

/** Find the best entry point for a restricted user: a section dashboard, or
 * the first item (by `order`) in the first allowed section that has one. */
export async function firstAllowedPath(sectionAccess, { getDocs, collection, db }) {
  for (const id of sectionAccess) {
    const def = sectionDef(id)
    if (def?.landingPath) return def.landingPath
    if (def?.collectionName) {
      const snap = await getDocs(collection(db, def.collectionName))
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortByOrder)
      if (items.length) return `${def.pathPrefix}/${items[0].id}`
      continue
    }
    // custom section — items live in the shared customSectionItems collection
    const snap = await getDocs(collection(db, 'customSectionItems'))
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((it) => it.sectionId === id)
      .sort(sortByOrder)
    if (items.length) return `/custom-sections/${id}/${items[0].id}`
  }
  return null
}
