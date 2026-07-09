import { useAuth } from './AuthContext.jsx'

/** Conditionally render children when the user has a permission. */
export default function Can({ permission, anyOf, staffOnly, adminOnly, children, fallback = null }) {
  const { hasPermission, hasAnyPermission, isAdmin, isStaff } = useAuth()

  if (adminOnly && !isAdmin) return fallback
  if (staffOnly && !isStaff) return fallback
  if (permission && !hasPermission(permission)) return fallback
  if (anyOf?.length && !hasAnyPermission(anyOf)) return fallback

  return children
}
