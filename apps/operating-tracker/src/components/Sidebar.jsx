import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { FEATURES, SideNav, useFeatures } from '@hae/ui'

/** Tracker sidenav — expandable dark chrome; platform switch lives in the header. */
export default function Sidebar({ open = false, onClose }) {
  const { userProfile, isAdmin, logout, roleLabel } = useAuth()
  const { isEnabled } = useFeatures()
  const [programs, setPrograms] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const snap = await getDocs(collection(db, 'programs'))
      if (cancelled) return
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setPrograms(list)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const sections = useMemo(() => {
    const workspaceItems = [
      { to: '/', label: 'Dashboard', end: true, icon: 'home' },
      { to: '/my-tasks', label: 'My Tasks', icon: 'checklist' },
    ]
    if (isEnabled(FEATURES.NOTIFICATIONS)) {
      workspaceItems.push({
        to: '/notifications',
        label: 'Notifications',
        icon: 'bell',
      })
    }
    if (isEnabled(FEATURES.SURVEYS)) {
      workspaceItems.push({ to: '/surveys', label: 'Surveys', icon: 'survey' })
    }
    workspaceItems.push({ to: '/help', label: 'Help', icon: 'help' })
    if (isAdmin) {
      workspaceItems.push({ to: '/admin', label: 'Admin', icon: 'admin' })
    }

    const next = [
      {
        id: 'workspace',
        label: 'Workspace',
        items: workspaceItems,
      },
    ]

    if (programs.length > 0) {
      next.push({
        id: 'programs',
        label: 'Programs',
        items: programs.map((p) => ({
          to: `/programs/${p.id}`,
          label: p.name,
          icon: 'folder',
          description: p.lead || undefined,
        })),
      })
    } else {
      next.push({
        id: 'programs',
        label: 'Programs',
        items: [],
        emptyLabel: 'No programs yet',
      })
    }

    return next
  }, [programs, isAdmin, isEnabled])

  return (
    <SideNav
      open={open}
      onClose={onClose}
      title="Operating Tracker"
      subtitle="In this app"
      sections={sections}
      userName={userProfile?.name}
      roleLabel={roleLabel}
      onLogout={logout}
    />
  )
}
