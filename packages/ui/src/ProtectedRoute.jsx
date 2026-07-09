import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { hasAnyPermission, hasPermission } from './rbac.js'

/**
 * Route guard.
 * - adminOnly: legacy — requires admin role
 * - permission: single permission string
 * - anyOf: array of permissions (OR)
 * - staffOnly: requires admin or staff
 */
export default function ProtectedRoute({
  adminOnly = false,
  staffOnly = false,
  permission = null,
  anyOf = null,
}) {
  const { user, userProfile, loading, isAdmin, isStaff, permissions } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hae-mist text-hae-slate">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!userProfile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-hae-mist px-6 text-center">
        <p className="font-medium text-hae-ink">Account not found in the directory.</p>
        <p className="text-sm text-hae-slate">Ask an admin to add your user record.</p>
      </div>
    )
  }

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  if (staffOnly && !isStaff) return <Navigate to="/" replace />
  if (permission && !hasPermission(permissions, permission)) {
    return <Navigate to="/" replace />
  }
  if (anyOf?.length && !hasAnyPermission(permissions, anyOf)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
