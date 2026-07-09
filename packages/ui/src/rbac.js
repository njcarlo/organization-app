/**
 * Platform RBAC — roles, permissions, and helpers.
 *
 * Roles (users.role):
 *   admin   — full platform control
 *   staff   — HAE team operational access (legacy alias: "user")
 *   member  — alumni member (EiR browse/book; limited AMS read)
 *   student — Academy learner (LMS self-service)
 */

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  MEMBER: 'member',
  STUDENT: 'student',
}

/** Legacy role stored as "user" → treat as staff */
export const ROLE_ALIASES = {
  user: ROLES.STAFF,
}

export const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: 'Admin', description: 'Full platform control' },
  { value: ROLES.STAFF, label: 'Staff', description: 'HAE team — manage apps' },
  { value: ROLES.MEMBER, label: 'Member', description: 'Alumni — EiR & limited AMS' },
  { value: ROLES.STUDENT, label: 'Student', description: 'Academy learner — LMS only' },
]

export const PERMISSIONS = {
  // Tracker
  TRACKER_READ: 'tracker:read',
  TRACKER_WRITE: 'tracker:write',
  TRACKER_ADMIN: 'tracker:admin',
  // LMS
  LMS_CATALOG: 'lms:catalog',
  LMS_LEARN: 'lms:learn',
  LMS_MANAGE: 'lms:manage',
  // EiR
  EIR_READ: 'eir:read',
  EIR_MANAGE: 'eir:manage',
  // CRM
  CRM_READ: 'crm:read',
  CRM_WRITE: 'crm:write',
  // AMS
  AMS_READ: 'ams:read',
  AMS_MANAGE: 'ams:manage',
  // Platform
  PLATFORM_USERS: 'platform:users',
  PLATFORM_IMPORT: 'platform:import',
}

const P = PERMISSIONS

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.STAFF]: [
    P.TRACKER_READ,
    P.TRACKER_WRITE,
    P.LMS_CATALOG,
    P.LMS_LEARN,
    P.LMS_MANAGE,
    P.EIR_READ,
    P.EIR_MANAGE,
    P.CRM_READ,
    P.CRM_WRITE,
    P.AMS_READ,
    P.AMS_MANAGE,
  ],
  [ROLES.MEMBER]: [P.LMS_CATALOG, P.EIR_READ, P.AMS_READ],
  [ROLES.STUDENT]: [P.LMS_CATALOG, P.LMS_LEARN, P.EIR_READ],
}

/** Module access for Platform sidebar links */
export const MODULE_PERMISSIONS = {
  tracker: P.TRACKER_READ,
  lms: [P.LMS_CATALOG, P.LMS_LEARN, P.LMS_MANAGE],
  eir: [P.EIR_READ, P.EIR_MANAGE],
  crm: [P.CRM_READ, P.CRM_WRITE],
  ams: [P.AMS_READ, P.AMS_MANAGE],
}

export function normalizeRole(role) {
  if (!role) return ROLES.MEMBER
  const r = String(role).toLowerCase().trim()
  if (ROLE_ALIASES[r]) return ROLE_ALIASES[r]
  if (Object.values(ROLES).includes(r)) return r
  return ROLES.MEMBER
}

export function permissionsForRole(role) {
  const normalized = normalizeRole(role)
  return ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS[ROLES.MEMBER]
}

export function hasPermission(roleOrPermissions, permission) {
  if (!permission) return true
  if (Array.isArray(roleOrPermissions)) {
    return roleOrPermissions.includes(permission)
  }
  return permissionsForRole(roleOrPermissions).includes(permission)
}

export function hasAnyPermission(roleOrPermissions, permissions = []) {
  if (!permissions.length) return true
  return permissions.some((p) => hasPermission(roleOrPermissions, p))
}

export function canAccessModule(roleOrPermissions, moduleId) {
  const needed = MODULE_PERMISSIONS[moduleId]
  if (!needed) return false
  if (Array.isArray(needed)) {
    return hasAnyPermission(roleOrPermissions, needed)
  }
  return hasPermission(roleOrPermissions, needed)
}

export function isAdminRole(role) {
  return normalizeRole(role) === ROLES.ADMIN
}

export function isStaffRole(role) {
  const r = normalizeRole(role)
  return r === ROLES.ADMIN || r === ROLES.STAFF
}

export function roleLabel(role) {
  const n = normalizeRole(role)
  return ROLE_OPTIONS.find((o) => o.value === n)?.label || n
}
