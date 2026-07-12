import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { FEATURES, SideNav, useFeatures } from '@hae/ui'
import { EXEC_INBOX_EMAILS } from '../constants'

/** Tracker sidenav — expandable chrome; platform switch lives in the header. */
export default function Sidebar({ open = false, onClose }) {
  const { user, userProfile, isAdmin, logout, roleLabel } = useAuth()
  const { isEnabled } = useFeatures()
  const isExecInboxUser = EXEC_INBOX_EMAILS.includes((user?.email || '').toLowerCase())
  const [programs, setPrograms] = useState([])
  const [academyPrograms, setAcademyPrograms] = useState([])
  const [customPrograms, setCustomPrograms] = useState([])

  useEffect(() => {
    let cancelled = false
    const sortByOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)
    const toList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const loadInto = (collectionName, setter) => {
      getDocs(collection(db, collectionName))
        .then((snap) => {
          if (cancelled) return
          setter(toList(snap).sort(sortByOrder))
        })
        .catch((err) => {
          console.error(`Failed to load ${collectionName}`, err)
        })
    }
    loadInto('programs', setPrograms)
    loadInto('academyPrograms', setAcademyPrograms)
    loadInto('customPrograms', setCustomPrograms)
    return () => {
      cancelled = true
    }
  }, [])

  const sections = useMemo(() => {
    const workspaceItems = [
      { to: '/', label: 'Dashboard', end: true, icon: 'home' },
      { to: '/my-tasks', label: 'My Tasks', icon: 'checklist' },
      { to: '/calendar', label: 'Calendar', icon: 'calendar' },
    ]
    if (isExecInboxUser) {
      workspaceItems.push({
        to: '/executive-inbox',
        label: 'Executive Inbox',
        icon: 'message',
      })
    }
    if (isEnabled(FEATURES.SURVEYS)) {
      workspaceItems.push({ to: '/surveys', label: 'Surveys', icon: 'survey' })
    }
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

    next.push({
      id: 'academy',
      label: 'Academy',
      items: [
        { to: '/academy/course-registrations', label: 'Course Registrations', icon: 'checklist' },
        ...academyPrograms.map((p) => ({
          to: `/academy/${p.id}`,
          label: p.name,
          icon: 'folder',
          description: p.lead || undefined,
        })),
      ],
    })

    if (customPrograms.length > 0) {
      next.push({
        id: 'custom-programs',
        label: 'Custom Programs',
        items: customPrograms.map((p) => ({
          to: `/custom-programs/${p.id}`,
          label: p.name,
          icon: 'folder',
          description: p.lead || undefined,
        })),
      })
    } else {
      next.push({
        id: 'custom-programs',
        label: 'Custom Programs',
        items: [],
        emptyLabel: 'No Custom Programs yet',
      })
    }

    return next
  }, [programs, academyPrograms, customPrograms, isAdmin, isEnabled, isExecInboxUser])

  return (
    <SideNav
      open={open}
      onClose={onClose}
      title="Operations"
      subtitle="In this app"
      sections={sections}
      userName={userProfile?.name}
      roleLabel={roleLabel}
      onLogout={logout}
    />
  )
}
