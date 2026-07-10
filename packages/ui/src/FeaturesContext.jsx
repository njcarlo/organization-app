import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@hae/firebase'
import {
  DEFAULT_FEATURES,
  FEATURES_DOC_PATH,
  MODULE_FEATURE,
  isFeatureOn,
  mergeFeatures,
} from './features.js'

const FeaturesContext = createContext(null)

/**
 * Live feature flags from Firestore.
 * Pass isSuperAdmin from the app AuthProvider (superadmins always see all features).
 */
export function FeaturesProvider({ children, isSuperAdmin = false }) {
  const [flags, setFlags] = useState(DEFAULT_FEATURES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const ref = doc(db, ...FEATURES_DOC_PATH)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setFlags(mergeFeatures(snap.exists() ? snap.data()?.flags : null))
        setLoading(false)
        setError('')
      },
      (err) => {
        console.warn('Feature flags load failed', err)
        setFlags(DEFAULT_FEATURES)
        setLoading(false)
        setError(err.message || 'Failed to load feature flags')
      }
    )
    return () => unsub()
  }, [])

  const isEnabled = useCallback(
    (featureId) => isFeatureOn(flags, featureId, { isSuperAdmin }),
    [flags, isSuperAdmin]
  )

  const isModuleEnabled = useCallback(
    (moduleId) => {
      const featureId = MODULE_FEATURE[moduleId]
      return featureId ? isEnabled(featureId) : true
    },
    [isEnabled]
  )

  const saveFlags = useCallback(
    async (nextFlags) => {
      if (!isSuperAdmin) {
        throw new Error('Only superadmins can change feature toggles')
      }
      const merged = mergeFeatures(nextFlags)
      await setDoc(
        doc(db, ...FEATURES_DOC_PATH),
        {
          flags: merged,
          updatedAt: serverTimestamp(),
          updatedBy: 'superadmin',
        },
        { merge: true }
      )
      return merged
    },
    [isSuperAdmin]
  )

  const value = useMemo(
    () => ({
      flags,
      loading,
      error,
      isEnabled,
      isModuleEnabled,
      saveFlags,
      isSuperAdmin,
    }),
    [flags, loading, error, isEnabled, isModuleEnabled, saveFlags, isSuperAdmin]
  )

  return (
    <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>
  )
}

export function useFeatures() {
  const ctx = useContext(FeaturesContext)
  if (!ctx) {
    return {
      flags: DEFAULT_FEATURES,
      loading: false,
      error: '',
      isEnabled: () => true,
      isModuleEnabled: () => true,
      saveFlags: async () => DEFAULT_FEATURES,
      isSuperAdmin: false,
    }
  }
  return ctx
}
