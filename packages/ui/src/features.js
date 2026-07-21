/**
 * Platform feature flags — toggled by superadmins in Tracker → Admin.
 * Stored at Firestore: platformSettings/features
 *
 * When a flag is off, non-superadmin users lose that UI / module.
 * Superadmins always see everything — except product-surface hides
 * (see platformSurface.js), which apply to everyone.
 */

import { isSurveysHidden, visibleModuleIds } from './platformSurface.js'

export const FEATURES = {
  MODULE_TRACKER: 'module_tracker',
  MODULE_LMS: 'module_lms',
  MODULE_EIR: 'module_eir',
  MODULE_CRM: 'module_crm',
  MODULE_AMS: 'module_ams',
  SURVEYS: 'surveys',
  NOTIFICATIONS: 'notifications',
  BULK_IMPORT: 'bulk_import',
  LMS_TRACKING: 'lms_tracking',
  LMS_AUTHORING: 'lms_authoring',
  LMS_GAMIFICATION: 'lms_gamification',
  CRM_LINKING: 'crm_linking',
  CALENDAR_EXPORT: 'calendar_export',
}

/** UI catalog for the Admin toggles panel */
export const FEATURE_CATALOG = [
  {
    group: 'Apps',
    items: [
      {
        id: FEATURES.MODULE_TRACKER,
        label: 'Operations',
        description: 'Programs, projects, tasks, dashboard',
      },
      {
        id: FEATURES.MODULE_LMS,
        label: 'LMS (Academy)',
        description: 'Courses, enrollments, office hours',
      },
      {
        id: FEATURES.MODULE_EIR,
        label: 'EiR (Experts)',
        description: 'Expert Office Hours directory',
      },
      {
        id: FEATURES.MODULE_CRM,
        label: 'CRM',
        description: 'Contacts, pipeline, interactions',
      },
      {
        id: FEATURES.MODULE_AMS,
        label: 'AMS (Membership)',
        description: 'Members, memberships, events',
      },
    ],
  },
  {
    group: 'Tracker features',
    items: [
      {
        id: FEATURES.SURVEYS,
        label: 'Surveys',
        description: 'Create, share, and analyze surveys',
      },
      {
        id: FEATURES.NOTIFICATIONS,
        label: 'Notifications digest',
        description: 'Overdue tasks and check-ins digest',
      },
      {
        id: FEATURES.BULK_IMPORT,
        label: 'Bulk import',
        description: 'Admin CSV/JSON list imports',
      },
      {
        id: FEATURES.CALENDAR_EXPORT,
        label: 'Calendar export (.ics)',
        description: 'Download tasks / sessions / events as ICS',
      },
    ],
  },
  {
    group: 'LMS features',
    items: [
      {
        id: FEATURES.LMS_TRACKING,
        label: 'Learner tracking',
        description: 'Staff tracking dashboard and nudges',
      },
      {
        id: FEATURES.LMS_AUTHORING,
        label: 'Course authoring',
        description: 'Templates and module authoring tools',
      },
      {
        id: FEATURES.LMS_GAMIFICATION,
        label: 'Points & badges',
        description: 'Learner progress gamification',
      },
    ],
  },
  {
    group: 'CRM features',
    items: [
      {
        id: FEATURES.CRM_LINKING,
        label: 'Person linking',
        description: 'Show AMS/LMS matches on contacts',
      },
    ],
  },
]

/** Catalog filtered to the current product surface (Tracker-only hides other apps/Surveys). */
export function featureCatalogForSurface() {
  const allowedModules = visibleModuleIds()
  const hideSurveys = isSurveysHidden()
  return FEATURE_CATALOG.map((group) => {
    let items = group.items
    if (group.group === 'Apps' && allowedModules) {
      const moduleFeatureById = {
        [FEATURES.MODULE_TRACKER]: 'tracker',
        [FEATURES.MODULE_LMS]: 'lms',
        [FEATURES.MODULE_EIR]: 'eir',
        [FEATURES.MODULE_CRM]: 'crm',
        [FEATURES.MODULE_AMS]: 'ams',
      }
      items = items.filter((i) => {
        const mid = moduleFeatureById[i.id]
        return !mid || allowedModules.includes(mid)
      })
    }
    if (group.group === 'Tracker features' && hideSurveys) {
      items = items.filter((i) => i.id !== FEATURES.SURVEYS)
    }
    if (group.group === 'LMS features' && allowedModules && !allowedModules.includes('lms')) {
      items = []
    }
    if (group.group === 'CRM features' && allowedModules && !allowedModules.includes('crm')) {
      items = []
    }
    return { ...group, items }
  }).filter((g) => g.items.length > 0)
}

export const DEFAULT_FEATURES = Object.fromEntries(
  FEATURE_CATALOG.flatMap((g) =>
    g.items.map((i) => {
      // Tracker-only surface: other apps + surveys off by default (data kept).
      if (i.id === FEATURES.MODULE_TRACKER) return [i.id, true]
      if (
        i.id === FEATURES.MODULE_LMS ||
        i.id === FEATURES.MODULE_EIR ||
        i.id === FEATURES.MODULE_CRM ||
        i.id === FEATURES.MODULE_AMS ||
        i.id === FEATURES.SURVEYS
      ) {
        return [i.id, false]
      }
      return [i.id, true]
    })
  )
)

export function mergeFeatures(raw) {
  const flags = { ...DEFAULT_FEATURES }
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULT_FEATURES)) {
      if (typeof raw[key] === 'boolean') flags[key] = raw[key]
    }
  }
  // Product surface always wins for Surveys (UI hidden; data retained).
  if (isSurveysHidden()) flags[FEATURES.SURVEYS] = false
  const allowed = visibleModuleIds()
  if (allowed) {
    for (const [featureId, moduleId] of Object.entries({
      [FEATURES.MODULE_TRACKER]: 'tracker',
      [FEATURES.MODULE_LMS]: 'lms',
      [FEATURES.MODULE_EIR]: 'eir',
      [FEATURES.MODULE_CRM]: 'crm',
      [FEATURES.MODULE_AMS]: 'ams',
    })) {
      if (!allowed.includes(moduleId)) flags[featureId] = false
    }
  }
  return flags
}

export function isFeatureOn(flags, featureId, { isSuperAdmin = false } = {}) {
  // Surface hides apply even to superadmins (other apps/Surveys not in product UI).
  if (featureId === FEATURES.SURVEYS && isSurveysHidden()) return false
  const allowed = visibleModuleIds()
  if (allowed && featureId) {
    const moduleForFeature = {
      [FEATURES.MODULE_LMS]: 'lms',
      [FEATURES.MODULE_EIR]: 'eir',
      [FEATURES.MODULE_CRM]: 'crm',
      [FEATURES.MODULE_AMS]: 'ams',
    }[featureId]
    if (moduleForFeature && !allowed.includes(moduleForFeature)) return false
  }
  if (isSuperAdmin) return true
  if (!featureId) return true
  if (!flags || typeof flags[featureId] === 'undefined') return true
  return flags[featureId] !== false
}

/** Map platform module id → feature flag */
export const MODULE_FEATURE = {
  tracker: FEATURES.MODULE_TRACKER,
  lms: FEATURES.MODULE_LMS,
  eir: FEATURES.MODULE_EIR,
  crm: FEATURES.MODULE_CRM,
  ams: FEATURES.MODULE_AMS,
}

export const FEATURES_DOC_PATH = ['platformSettings', 'features']
