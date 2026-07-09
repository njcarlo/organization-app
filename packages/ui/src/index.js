export { AuthProvider, useAuth } from './AuthContext.jsx'
export { default as LoginPage } from './LoginPage.jsx'
export { default as ProtectedRoute } from './ProtectedRoute.jsx'
export { default as ModuleShell } from './ModuleShell.jsx'
export { default as Can } from './Can.jsx'
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
