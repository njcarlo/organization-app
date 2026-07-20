import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { firstAllowedPath } from '../sectionAccess'

/** Landing page for section-restricted users — sends them into their first
 * allowed section instead of the org-wide Dashboard. */
export default function RestrictedHome() {
  const { sectionAccess } = useAuth()
  const [redirectPath, setRedirectPath] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    firstAllowedPath(sectionAccess, { getDocs, collection, db }).then((path) => {
      if (!cancelled) setRedirectPath(path)
    })
    return () => {
      cancelled = true
    }
  }, [sectionAccess])

  if (redirectPath === undefined) {
    return (
      <div className="flex h-full items-center justify-center py-16 text-sm text-hae-slate">
        Loading…
      </div>
    )
  }

  if (redirectPath) return <Navigate to={redirectPath} replace />

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-display text-2xl text-hae-ink">Nothing here yet</h1>
      <p className="mt-2 text-sm text-hae-slate">
        You don't have any items in your assigned section yet. Check back soon or ask an
        admin.
      </p>
    </div>
  )
}
