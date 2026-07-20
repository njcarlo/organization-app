import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import {
  canAccessModule,
  hasAnyPermission,
  hasPermission,
  isAdminRole,
  isStaffRole,
  normalizeRole,
  permissionsForRole,
  roleLabel,
} from '../../../../packages/ui/src/rbac.js'
import { isSuperAdminEmail } from '../../../../packages/ui/src/superadmin.js'
import { ensureSuperAdminProfile } from '../../../../packages/ui/src/ensureSuperAdmin.js'
import { consumeSsoTokenIfPresent } from '../../../../packages/ui/src/sso.js'
import { isSectionRestricted } from '../sectionAccess'

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
        if (firebaseUser) {
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
          }
        } else {
          setUserProfile(null)
        }
        setLoading(false)
      })
    })()

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const requestPasswordReset = (email) =>
    sendPasswordResetEmail(auth, String(email || '').trim())

  const logout = () => firebaseSignOut(auth)

  const refreshProfile = async () => {
    if (!auth.currentUser) return
    const snap = await getDoc(doc(db, 'users', auth.currentUser.uid))
    setUserProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  }

  const role = normalizeRole(userProfile?.role)
  const permissions = useMemo(() => permissionsForRole(role), [role])
  const isSuperAdmin = isSuperAdminEmail(user?.email || userProfile?.email)
  const isAdmin = isAdminRole(role) || isSuperAdmin
  const isStaff = isStaffRole(role) || isSuperAdmin
  // Superadmins and platform admins are never section-restricted, even if a
  // stale sectionAccess value lingers on their user doc.
  const sectionAccess =
    !isSuperAdmin && !isAdmin && isSectionRestricted(userProfile?.sectionAccess)
      ? userProfile.sectionAccess
      : null

  const value = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      login,
      requestPasswordReset,
      logout,
      refreshProfile,
      role,
      roleLabel: isSuperAdmin ? 'Superadmin' : roleLabel(role),
      permissions,
      isAdmin,
      isStaff,
      isSuperAdmin,
      sectionAccess,
      hasPermission: (perm) => isSuperAdmin || hasPermission(permissions, perm),
      hasAnyPermission: (perms) =>
        isSuperAdmin || hasAnyPermission(permissions, perms),
      canAccessModule: (moduleId) =>
        isSuperAdmin || canAccessModule(permissions, moduleId),
    }),
    [
      user,
      userProfile,
      loading,
      role,
      permissions,
      isAdmin,
      isStaff,
      isSuperAdmin,
      sectionAccess,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
