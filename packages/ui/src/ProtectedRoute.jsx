import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function ProtectedRoute({ adminOnly = false }) {
  const { user, userProfile, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hae-mist text-hae-slate">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />

  if (!userProfile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-hae-mist px-6 text-center">
        <p className="font-medium text-hae-ink">Account not found in the directory.</p>
        <p className="text-sm text-hae-slate">Ask an admin to add your user record.</p>
      </div>
    )
  }

  return <Outlet />
}
