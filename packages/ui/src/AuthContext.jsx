import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@hae/firebase'
import {
  canAccessModule,
  hasAnyPermission,
  hasPermission,
  isAdminRole,
  isStaffRole,
  normalizeRole,
  permissionsForRole,
  roleLabel,
} from './rbac.js'
import { isSuperAdminEmail } from './superadmin.js'
import { ensureSuperAdminProfile } from './ensureSuperAdmin.js'
import { consumeSsoTokenIfPresent } from './sso.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let unsub = () => {}

    ;(async () => {
      try {
        await consumeSsoTokenIfPresent()
      } catch (err) {
        console.warn('SSO sign-in failed', err)
      }
      if (cancelled) return

      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser)
        if (!firebaseUser) {
          setUserProfile(null)
          setLoading(false)
          return
        }
        try {
          let profile = null
          if (isSuperAdminEmail(firebaseUser.email)) {
            profile = await ensureSuperAdminProfile(db, firebaseUser)
          }
          if (!profile) {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
            profile = snap.exists() ? { id: snap.id, ...snap.data() } : null
          }
          setUserProfile(profile)
        } catch {
          setUserProfile(null)
        } finally {
          setLoading(false)
        }
      })
    })()

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const role = normalizeRole(userProfile?.role)
  const permissions = useMemo(() => permissionsForRole(role), [role])
  const isSuperAdmin = isSuperAdminEmail(user?.email || userProfile?.email)
  const isAdmin = isAdminRole(role) || isSuperAdmin
  const isStaff = isStaffRole(role) || isSuperAdmin

  const value = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      role,
      roleLabel: isSuperAdmin ? 'Superadmin' : roleLabel(role),
      permissions,
      isAdmin,
      isStaff,
      isSuperAdmin,
      hasPermission: (perm) => isSuperAdmin || hasPermission(permissions, perm),
      hasAnyPermission: (perms) =>
        isSuperAdmin || hasAnyPermission(permissions, perms),
      canAccessModule: (moduleId) =>
        isSuperAdmin || canAccessModule(permissions, moduleId),
      login: (email, password) => signInWithEmailAndPassword(auth, email, password),
      requestPasswordReset: (email) =>
        sendPasswordResetEmail(auth, String(email || '').trim()),
      logout: () => signOut(auth),
    }),
    [user, userProfile, loading, role, permissions, isAdmin, isStaff, isSuperAdmin]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
