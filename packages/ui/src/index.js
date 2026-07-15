export { AuthProvider, useAuth, useAuthOptional } from './AuthContext.jsx'
export { default as LoginPage } from './LoginPage.jsx'
export { default as AuthActionPage } from './AuthActionPage.jsx'
export { default as ProtectedRoute } from './ProtectedRoute.jsx'
export { default as ModuleShell } from './ModuleShell.jsx'
export { default as PlatformHeader } from './PlatformHeader.jsx'
export { default as SideNav, sectionsFromNavItems } from './SideNav.jsx'
export { NavIcon, iconForNavItem } from './navIcons.jsx'
export { default as Modal } from './Modal.jsx'
export { default as Can } from './Can.jsx'
export { default as HelpGuide } from './HelpGuide.jsx'
export { default as CommentsPanel } from './CommentsPanel.jsx'
export { useStaffUsers } from './useStaffUsers.js'
export { HELP_SECTIONS, sectionsForRole } from './helpContent.js'
export {
  MODULES,
  HUB_URL,
  HUB_LOCAL_PORT,
  getModule,
  hubHref,
  moduleHref,
  moduleUrl,
} from './modules.js'
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
  SUPERADMIN_EMAILS,
  normalizeEmail,
  isSuperAdminEmail,
} from './superadmin.js'
export { ensureSuperAdminProfile } from './ensureSuperAdmin.js'
export {
  FEATURES,
  FEATURE_CATALOG,
  DEFAULT_FEATURES,
  MODULE_FEATURE,
  FEATURES_DOC_PATH,
  mergeFeatures,
  isFeatureOn,
} from './features.js'
export { FeaturesProvider, useFeatures } from './FeaturesContext.jsx'
export { default as FeaturesGate } from './FeaturesGate.jsx'
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
export { timeOfDayGreeting } from './greeting.js'
