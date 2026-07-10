export { AuthProvider, useAuth } from './AuthContext.jsx'
export { default as LoginPage } from './LoginPage.jsx'
export { default as ProtectedRoute } from './ProtectedRoute.jsx'
export { default as ModuleShell } from './ModuleShell.jsx'
export { default as Can } from './Can.jsx'
export { default as HelpGuide } from './HelpGuide.jsx'
export { HELP_SECTIONS, sectionsForRole } from './helpContent.js'
export { MODULES, moduleHref } from './modules.js'
export {
  consumeSsoTokenIfPresent,
  createSsoToken,
  navigateToModule,
  withSsoToken,
} from './sso.js'
export {
  ROLES,
  ROLE_OPTIONS,
  PERMISSIONS,
  normalizeRole,
  hasPermission,
  hasAnyPermission,
  canAccessModule,
  isAdminRole,
  isStaffRole,
  roleLabel,
  permissionsForRole,
} from './rbac.js'
export {
  downloadBlob,
  downloadText,
  downloadCsv,
  csvCell,
  toCsv,
} from './download.js'
export {
  escapeIcsText,
  formatIcsDate,
  icsTimestamp,
  buildIcsCalendar,
  downloadIcs,
} from './ics.js'
