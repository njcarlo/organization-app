/**
 * Platform feature flags — toggled by superadmins in Tracker → Admin.
 * Stored at Firestore: platformSettings/features
 *
 * When a flag is off, non-superadmin users lose that UI / module.
 * Superadmins always see everything.
 */

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
        label: 'Operating Tracker',
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

export const DEFAULT_FEATURES = Object.fromEntries(
  FEATURE_CATALOG.flatMap((g) => g.items.map((i) => [i.id, true]))
)

export function mergeFeatures(raw) {
  const flags = { ...DEFAULT_FEATURES }
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULT_FEATURES)) {
      if (typeof raw[key] === 'boolean') flags[key] = raw[key]
    }
  }
  return flags
}

export function isFeatureOn(flags, featureId, { isSuperAdmin = false } = {}) {
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
