/**
 * Product surface controls — hide apps/nav without deleting code or Firestore data.
 *
 * Other apps (LMS, EiR, CRM, AMS) and Hub stay in the repo and may still be
 * deployed; they are simply not linked from the Tracker header.
 * Surveys routes/pages remain on disk; data in `surveys*` is untouched.
 */
export const PLATFORM_SURFACE = {
  /** Module ids shown in the platform switcher. Tracker-only for now. */
  visibleModuleIds: ['tracker'],
  /** Hide Hub landing links from the header (logo stays in-app). */
  hideHub: true,
  /** Hide Surveys from Tracker nav/routes (collections + page files kept). */
  hideSurveys: true,
}

export function isHubHidden() {
  return PLATFORM_SURFACE.hideHub !== false
}

export function isSurveysHidden() {
  return PLATFORM_SURFACE.hideSurveys === true
}

export function visibleModuleIds() {
  const ids = PLATFORM_SURFACE.visibleModuleIds
  return Array.isArray(ids) && ids.length > 0 ? ids : null
}
