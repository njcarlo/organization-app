import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import LeadSelect from './LeadSelect'
import { FEATURES, Modal, SideNav, useFeatures } from '@hae/ui'
import { EVENT_FORMAT_OPTIONS, EXEC_INBOX_EMAILS, HEALTH_OPTIONS } from '../constants'
import { formatDate, namesLabel, toNameList } from '../utils'

const CUSTOM_PROGRAM_STATUS_OPTIONS = ['Prospect', 'Approved']

const CATEGORY_META = {
  programs: { label: 'Program', pathPrefix: '/programs' },
  academyPrograms: { label: 'Academy item', pathPrefix: '/academy', showCourseFields: true },
  customPrograms: { label: 'Custom Program', pathPrefix: '/custom-programs', showCustomProgramFields: true },
  trackerDocuments: { label: 'Document', pathPrefix: '/documents' },
  trackerEvents: { label: 'Event', pathPrefix: '/events', showEventFields: true },
  trackerGraphics: { label: 'Graphic', pathPrefix: '/graphics' },
  trackerData: { label: 'Data Project', pathPrefix: '/data' },
  boardCommitments: { label: 'Board Commitment', pathPrefix: '/board-commitments' },
  chapters: { label: 'Chapter', pathPrefix: '/chapters', showChapterFields: true },
}

const emptyProject = {
  name: '',
  lead: [],
  promise: '',
  health: 'ongoing',
  targetDate: '',
  notes: '',
}

const sortByOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)
const toList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))

// Section order is a personal preference (per user); renamed labels are shared
// chrome that applies org-wide, so they live in separate docs/collections.
const sidebarOrderDoc = (uid) => `sidebarOrder/${uid}`
const SIDEBAR_LABELS_DOC = 'sidebarLabels/tracker'
const DEFAULT_SECTION_ORDER = [
  'programs',
  'academy',
  'custom-programs',
  'documents',
  'events',
  'graphics',
  'data',
  'board-commitments',
  'chapters',
]

/** Tracker sidenav — expandable chrome; platform switch lives in the header. */
export default function Sidebar({ open = false, onClose }) {
  const { user, userProfile, isAdmin, logout, roleLabel } = useAuth()
  const { isEnabled } = useFeatures()
  const navigate = useNavigate()
  const isExecInboxUser = EXEC_INBOX_EMAILS.includes((user?.email || '').toLowerCase())
  const [programs, setPrograms] = useState([])
  const [academyPrograms, setAcademyPrograms] = useState([])
  const [customPrograms, setCustomPrograms] = useState([])
  const [trackerDocuments, setTrackerDocuments] = useState([])
  const [trackerEvents, setTrackerEvents] = useState([])
  const [trackerGraphics, setTrackerGraphics] = useState([])
  const [trackerData, setTrackerData] = useState([])
  const [boardCommitments, setBoardCommitments] = useState([])
  const [chapters, setChapters] = useState([])
  const [addProjectModal, setAddProjectModal] = useState(null)
  const [editCategoryModal, setEditCategoryModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sectionConfig, setSectionConfig] = useState({ order: [], labels: {} })

  const setters = {
    programs: setPrograms,
    academyPrograms: setAcademyPrograms,
    customPrograms: setCustomPrograms,
    trackerDocuments: setTrackerDocuments,
    trackerEvents: setTrackerEvents,
    trackerGraphics: setTrackerGraphics,
    trackerData: setTrackerData,
    boardCommitments: setBoardCommitments,
    chapters: setChapters,
  }

  const reload = (collectionName) => {
    getDocs(collection(db, collectionName))
      .then((snap) => setters[collectionName](toList(snap).sort(sortByOrder)))
      .catch((err) => console.error(`Failed to load ${collectionName}`, err))
  }

  const reorderCategory = async (collectionName, orderedItems) => {
    const ids = orderedItems.map((item) => item.id)
    const setter = setters[collectionName]
    setter((prev) => {
      const byId = new Map(prev.map((entry) => [entry.id, entry]))
      return ids.map((id) => byId.get(id)).filter(Boolean)
    })
    try {
      const batch = writeBatch(db)
      ids.forEach((id, index) => {
        batch.update(doc(db, collectionName, id), { order: index })
      })
      await batch.commit()
    } catch (err) {
      console.error(`Failed to reorder ${collectionName}`, err)
      reload(collectionName)
    }
  }

  const reorderSections = async (reorderedSections) => {
    if (!user?.uid) return
    const orderedIds = reorderedSections.map((s) => s.id)
    setSectionConfig((prev) => ({ ...prev, order: orderedIds }))
    try {
      await setDoc(doc(db, sidebarOrderDoc(user.uid)), { order: orderedIds }, { merge: true })
    } catch (err) {
      console.error('Failed to save sidebar section order', err)
    }
  }

  const renameSection = async (sectionId, label) => {
    setSectionConfig((prev) => ({ ...prev, labels: { ...prev.labels, [sectionId]: label } }))
    try {
      await setDoc(
        doc(db, SIDEBAR_LABELS_DOC),
        { [`labels.${sectionId}`]: label },
        { merge: true }
      )
    } catch (err) {
      console.error('Failed to rename sidebar section', err)
    }
  }

  // Order: personal, keyed by uid. Labels: shared org-wide, one doc for everyone.
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    getDoc(doc(db, sidebarOrderDoc(user.uid)))
      .then((snap) => {
        if (cancelled || !snap.exists()) return
        const data = snap.data()
        setSectionConfig((prev) => ({
          ...prev,
          order: Array.isArray(data.order) ? data.order : [],
        }))
      })
      .catch((err) => console.error('Failed to load sidebar section order', err))
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, SIDEBAR_LABELS_DOC))
      .then((snap) => {
        if (cancelled || !snap.exists()) return
        const data = snap.data()
        setSectionConfig((prev) => ({
          ...prev,
          labels: data.labels && typeof data.labels === 'object' ? data.labels : {},
        }))
      })
      .catch((err) => console.error('Failed to load sidebar section labels', err))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
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
    loadInto('trackerDocuments', setTrackerDocuments)
    loadInto('trackerGraphics', setTrackerGraphics)
    loadInto('trackerData', setTrackerData)
    loadInto('boardCommitments', setBoardCommitments)
    loadInto('chapters', setChapters)
    return () => {
      cancelled = true
    }
  }, [])

  // Live-synced so events added from the Events & Programs Dashboard show up here immediately.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'trackerEvents'),
      (snap) => setTrackerEvents(toList(snap).sort(sortByOrder)),
      (err) => console.error('Failed to load trackerEvents', err)
    )
    return unsubscribe
  }, [])

  const openAddProject = (collectionName, category) => {
    setAddProjectModal({
      collectionName,
      categoryId: category.id,
      categoryName: category.name,
      form: emptyProject,
    })
  }

  const closeAddProject = () => {
    if (saving) return
    setAddProjectModal(null)
  }

  const submitAddProject = async (e) => {
    e.preventDefault()
    if (!addProjectModal?.form.name.trim() || saving) return
    const { collectionName, categoryId, form } = addProjectModal
    setSaving(true)
    try {
      await addDoc(collection(db, 'projects'), {
        name: form.name.trim(),
        lead: form.lead,
        promise: form.promise.trim(),
        health: form.health,
        targetDate: form.targetDate || '',
        notes: form.notes.trim(),
        programId: categoryId,
        createdAt: serverTimestamp(),
      })
      setAddProjectModal(null)
      navigate(`${CATEGORY_META[collectionName].pathPrefix}/${categoryId}`)
      onClose?.()
    } finally {
      setSaving(false)
    }
  }

  const emptyCategoryForm = (meta) => ({
    name: '',
    lead: [],
    ...(meta.showCourseFields
      ? { haeLead: [], startDate: '', durationWeeks: '', instructor: '', guestSpeaker: '' }
      : {}),
    ...(meta.showCustomProgramFields ? { startDate: '', status: '' } : {}),
    ...(meta.showEventFields
      ? {
          eventDate: '',
          eventTime: '',
          marketingDate: '',
          venue: '',
          format: '',
          health: 'not-started',
        }
      : {}),
    ...(meta.showChapterFields ? { chapterLeader: '', coLeaders: '' } : {}),
  })

  const openAddCategory = (collectionName) => {
    setEditCategoryModal({
      collectionName,
      id: null,
      form: emptyCategoryForm(CATEGORY_META[collectionName]),
    })
  }

  const openEditCategory = (collectionName, category) => {
    const meta = CATEGORY_META[collectionName]
    setEditCategoryModal({
      collectionName,
      id: category.id,
      form: {
        name: category.name || '',
        lead: toNameList(category.lead),
        ...(meta.showCourseFields
          ? {
              haeLead: toNameList(category.haeLead),
              startDate: category.startDate || '',
              durationWeeks: category.durationWeeks ?? '',
              instructor: category.instructor || '',
              guestSpeaker: category.guestSpeaker || '',
            }
          : {}),
        ...(meta.showCustomProgramFields
          ? { startDate: category.startDate || '', status: category.status || '' }
          : {}),
        ...(meta.showEventFields
          ? {
              eventDate: category.eventDate || '',
              eventTime: category.eventTime || '',
              marketingDate: category.marketingDate || '',
              venue: category.venue || '',
              format: category.format || '',
              health: category.health || 'not-started',
            }
          : {}),
        ...(meta.showChapterFields
          ? {
              chapterLeader: category.chapterLeader || '',
              coLeaders: category.coLeaders || '',
            }
          : {}),
      },
    })
  }

  const closeEditCategory = () => {
    if (saving) return
    setEditCategoryModal(null)
  }

  const submitEditCategory = async (e) => {
    e.preventDefault()
    if (!editCategoryModal?.form.name.trim() || saving) return
    const { collectionName, id, form } = editCategoryModal
    const meta = CATEGORY_META[collectionName]
    const data = {
      name: form.name.trim(),
      lead: form.lead,
      ...(meta.showCourseFields
        ? {
            haeLead: form.haeLead,
            startDate: form.startDate,
            durationWeeks: form.durationWeeks ? Number(form.durationWeeks) : null,
            instructor: form.instructor.trim(),
            guestSpeaker: form.guestSpeaker.trim(),
          }
        : {}),
      ...(meta.showCustomProgramFields ? { startDate: form.startDate, status: form.status } : {}),
      ...(meta.showEventFields
        ? {
            eventDate: form.eventDate,
            eventTime: form.eventTime.trim(),
            marketingDate: form.marketingDate,
            venue: form.venue.trim(),
            format: form.format,
            health: form.health,
          }
        : {}),
      ...(meta.showChapterFields
        ? { chapterLeader: form.chapterLeader.trim(), coLeaders: form.coLeaders.trim() }
        : {}),
    }
    setSaving(true)
    try {
      if (id) {
        await updateDoc(doc(db, collectionName, id), data)
      } else {
        await addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp() })
      }
      setEditCategoryModal(null)
      reload(collectionName)
    } catch (err) {
      console.error(`Failed to save ${meta.label.toLowerCase()}`, err)
      alert(err.message || `Failed to save ${meta.label.toLowerCase()}`)
    } finally {
      setSaving(false)
    }
  }

  const deleteCategory = async (collectionName, category) => {
    const label = CATEGORY_META[collectionName].label
    if (!confirm(`Delete "${category.name}"? Projects and tasks are not cascade-deleted. This action cannot be undone.`)) return
    try {
      await deleteDoc(doc(db, collectionName, category.id))
      reload(collectionName)
    } catch (err) {
      console.error(`Failed to delete ${label.toLowerCase()}`, err)
      alert(err.message || `Failed to delete ${label.toLowerCase()}`)
    }
  }

  const sectionActions = (collectionName, labelOverride) => [
    {
      key: 'add-category',
      label: labelOverride || `Add ${CATEGORY_META[collectionName].label.toLowerCase()}`,
      onClick: () => openAddCategory(collectionName),
    },
  ]

  const categoryActions = (collectionName, category) => [
    ...(collectionName === 'trackerEvents'
      ? []
      : [
          {
            key: 'add-project',
            label: 'Add project',
            onClick: () => openAddProject(collectionName, category),
          },
        ]),
    {
      key: 'edit-category',
      label: `Edit ${CATEGORY_META[collectionName].label.toLowerCase()}`,
      onClick: () => openEditCategory(collectionName, category),
    },
    {
      key: 'delete-category',
      label: `Delete ${CATEGORY_META[collectionName].label.toLowerCase()}`,
      danger: true,
      onClick: () => deleteCategory(collectionName, category),
    },
  ]

  const sections = useMemo(() => {
    const workspaceItems = [
      { to: '/', label: 'Dashboard', end: true, icon: 'home' },
      { to: '/my-tasks', label: 'My Tasks', icon: 'checklist' },
      { to: '/calendar', label: 'Calendar', icon: 'calendar' },
      { to: '/activity', label: 'Activity', icon: 'history' },
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

    next.push({
      id: 'programs',
      label: 'Programs',
      actions: sectionActions('programs'),
      onReorderItems: (items) => reorderCategory('programs', items),
      items: programs.map((p) => ({
        id: p.id,
        to: `/programs/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        actions: categoryActions('programs', p),
      })),
      emptyLabel: programs.length === 0 ? 'No programs yet' : undefined,
    })

    next.push({
      id: 'academy',
      label: 'Academy',
      actions: sectionActions('academyPrograms'),
      onReorderItems: (items) => reorderCategory('academyPrograms', items),
      items: [
        { to: '/academy/course-registrations', label: 'Course Registrations', icon: 'checklist' },
        ...academyPrograms.map((p) => ({
          id: p.id,
          to: `/academy/${p.id}`,
          label: p.name,
          icon: 'folder',
          description: namesLabel(p.lead) || undefined,
          actions: categoryActions('academyPrograms', p),
        })),
      ],
    })

    next.push({
      id: 'custom-programs',
      label: 'Custom Programs',
      actions: sectionActions('customPrograms'),
      onReorderItems: (items) => reorderCategory('customPrograms', items),
      items: customPrograms.map((p) => ({
        id: p.id,
        to: `/custom-programs/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        actions: categoryActions('customPrograms', p),
      })),
      emptyLabel: customPrograms.length === 0 ? 'No Custom Programs yet' : undefined,
    })

    next.push({
      id: 'documents',
      label: 'Documents & Assets',
      actions: sectionActions('trackerDocuments'),
      onReorderItems: (items) => reorderCategory('trackerDocuments', items),
      items: trackerDocuments.map((p) => ({
        id: p.id,
        to: `/documents/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        actions: categoryActions('trackerDocuments', p),
      })),
      emptyLabel: trackerDocuments.length === 0 ? 'No Documents & Assets yet' : undefined,
    })

    next.push({
      id: 'events',
      label: 'Events & Programs',
      actions: sectionActions('trackerEvents'),
      items: [
        { to: '/events-dashboard', label: 'Events & Programs Dashboard', icon: 'chart' },
      ],
    })

    next.push({
      id: 'graphics',
      label: 'Graphics',
      actions: sectionActions('trackerGraphics'),
      onReorderItems: (items) => reorderCategory('trackerGraphics', items),
      items: [
        { to: '/graphics-dashboard', label: 'Graphics Dashboard', icon: 'chart' },
        ...trackerGraphics.map((p) => ({
          id: p.id,
          to: `/graphics/${p.id}`,
          label: p.name,
          icon: 'folder',
          description: namesLabel(p.lead) || undefined,
          actions: categoryActions('trackerGraphics', p),
        })),
      ],
    })

    next.push({
      id: 'data',
      label: 'Data Projects',
      actions: sectionActions('trackerData', 'Add Data Project'),
      onReorderItems: (items) => reorderCategory('trackerData', items),
      items: trackerData.map((p) => ({
        id: p.id,
        to: `/data/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        actions: categoryActions('trackerData', p),
      })),
      emptyLabel: trackerData.length === 0 ? 'Nothing here yet' : undefined,
    })

    next.push({
      id: 'board-commitments',
      label: 'Board Commitments',
      actions: sectionActions('boardCommitments', 'Add Board Commitment'),
      onReorderItems: (items) => reorderCategory('boardCommitments', items),
      items: boardCommitments.map((p) => ({
        id: p.id,
        to: `/board-commitments/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        actions: categoryActions('boardCommitments', p),
      })),
      emptyLabel: boardCommitments.length === 0 ? 'Nothing here yet' : undefined,
    })

    next.push({
      id: 'chapters',
      label: 'Chapters',
      actions: sectionActions('chapters', 'Add a chapter'),
      // Chapters always display alphabetically rather than by saved drag order;
      // onReorderItems stays wired so drag-and-drop still works in the moment,
      // but the list re-sorts back to A-Z on the next render/reload.
      onReorderItems: (items) => reorderCategory('chapters', items),
      items: [...chapters].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((p) => ({
        id: p.id,
        to: `/chapters/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: [p.chapterLeader, p.coLeaders].filter(Boolean).join(' · ') || undefined,
        actions: categoryActions('chapters', p),
      })),
      emptyLabel: chapters.length === 0 ? 'No chapters yet' : undefined,
    })

    // Workspace stays fixed. The rest: reordering is a personal preference
    // (each user drags their own view), while renaming is shared org-wide
    // chrome — any staff user can rename, and it changes the label for everyone.
    const [workspace, ...content] = next
    const byId = new Map(content.map((section) => [section.id, section]))
    const orderedIds = [
      ...sectionConfig.order.filter((id) => byId.has(id)),
      ...DEFAULT_SECTION_ORDER.filter((id) => byId.has(id) && !sectionConfig.order.includes(id)),
    ]
    const orderedContent = orderedIds.map((id) => {
      const section = byId.get(id)
      const labelOverride = sectionConfig.labels[id]
      return {
        ...section,
        label: labelOverride || section.label,
        draggable: true,
        onRename: (label) => renameSection(id, label),
      }
    })

    return [workspace, ...orderedContent]
  }, [
    programs,
    academyPrograms,
    customPrograms,
    trackerDocuments,
    trackerEvents,
    trackerGraphics,
    trackerData,
    boardCommitments,
    chapters,
    isAdmin,
    isEnabled,
    isExecInboxUser,
    sectionConfig,
  ])

  return (
    <>
      <SideNav
        open={open}
        onClose={onClose}
        title="Operations"
        subtitle="In this app"
        sections={sections}
        userName={userProfile?.name}
        roleLabel={roleLabel}
        onLogout={logout}
        onReorderSections={reorderSections}
      />

      <Modal
        open={!!addProjectModal}
        onClose={closeAddProject}
        title={`Add project${addProjectModal ? ` to ${addProjectModal.categoryName}` : ''}`}
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={closeAddProject} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="sidebar-add-project-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Create project'}
            </button>
          </>
        }
      >
        {addProjectModal ? (
          <form
            id="sidebar-add-project-form"
            onSubmit={submitAddProject}
            className="grid gap-3 sm:grid-cols-2"
          >
            <input
              required
              placeholder="Project name"
              value={addProjectModal.form.name}
              onChange={(e) =>
                setAddProjectModal({
                  ...addProjectModal,
                  form: { ...addProjectModal.form, name: e.target.value },
                })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <LeadSelect
              placeholder="Lead"
              value={addProjectModal.form.lead}
              onChange={(lead) =>
                setAddProjectModal({
                  ...addProjectModal,
                  form: { ...addProjectModal.form, lead },
                })
              }
            />
            <input
              placeholder="Promise / outcome"
              value={addProjectModal.form.promise}
              onChange={(e) =>
                setAddProjectModal({
                  ...addProjectModal,
                  form: { ...addProjectModal.form, promise: e.target.value },
                })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Status</span>
              <select
                value={addProjectModal.form.health}
                onChange={(e) =>
                  setAddProjectModal({
                    ...addProjectModal,
                    form: { ...addProjectModal.form, health: e.target.value },
                  })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                {HEALTH_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="date"
              value={addProjectModal.form.targetDate}
              onChange={(e) =>
                setAddProjectModal({
                  ...addProjectModal,
                  form: { ...addProjectModal.form, targetDate: e.target.value },
                })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Notes"
              rows={3}
              value={addProjectModal.form.notes}
              onChange={(e) =>
                setAddProjectModal({
                  ...addProjectModal,
                  form: { ...addProjectModal.form, notes: e.target.value },
                })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
            />
          </form>
        ) : null}
      </Modal>

      <Modal
        open={!!editCategoryModal}
        onClose={closeEditCategory}
        title={
          editCategoryModal
            ? `${editCategoryModal.id ? 'Edit' : 'Add'} ${CATEGORY_META[editCategoryModal.collectionName].label.toLowerCase()}`
            : ''
        }
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={closeEditCategory} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="sidebar-edit-category-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {editCategoryModal ? (
          <form
            id="sidebar-edit-category-form"
            onSubmit={submitEditCategory}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">
                {CATEGORY_META[editCategoryModal.collectionName].showChapterFields
                  ? 'Chapter Name'
                  : CATEGORY_META[editCategoryModal.collectionName].showEventFields
                    ? 'Event Title'
                    : 'Name'}
              </span>
              <input
                required
                value={editCategoryModal.form.name}
                onChange={(e) =>
                  setEditCategoryModal({
                    ...editCategoryModal,
                    form: { ...editCategoryModal.form, name: e.target.value },
                  })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            {CATEGORY_META[editCategoryModal.collectionName].showChapterFields ? null : (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-hae-slate">
                  {CATEGORY_META[editCategoryModal.collectionName].showEventFields
                    ? 'HAE Lead'
                    : 'Overall lead'}
                </span>
                <LeadSelect
                  value={editCategoryModal.form.lead}
                  onChange={(lead) =>
                    setEditCategoryModal({
                      ...editCategoryModal,
                      form: { ...editCategoryModal.form, lead },
                    })
                  }
                />
              </label>
            )}
            {CATEGORY_META[editCategoryModal.collectionName].showChapterFields ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">Chapter Leader/s</span>
                  <input
                    value={editCategoryModal.form.chapterLeader}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, chapterLeader: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">Co-Leaders</span>
                  <input
                    value={editCategoryModal.form.coLeaders}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, coLeaders: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                  />
                </label>
              </>
            ) : null}
            {CATEGORY_META[editCategoryModal.collectionName].showEventFields ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">Date of Event</span>
                  <input
                    type="date"
                    value={editCategoryModal.form.eventDate}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, eventDate: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm text-hae-slate"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">
                    Time of Event (with timezone)
                  </span>
                  <input
                    value={editCategoryModal.form.eventTime}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, eventTime: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">Venue</span>
                  <input
                    value={editCategoryModal.form.venue}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, venue: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">Date of Marketing</span>
                  <input
                    type="date"
                    value={editCategoryModal.form.marketingDate}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, marketingDate: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm text-hae-slate"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">Online or In-Person</span>
                  <select
                    value={editCategoryModal.form.format}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, format: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm"
                  >
                    <option value="">Select format</option>
                    {EVENT_FORMAT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">Marketing Status</span>
                  <select
                    value={editCategoryModal.form.health}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, health: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm"
                  >
                    {HEALTH_OPTIONS.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            {CATEGORY_META[editCategoryModal.collectionName].showCourseFields ? (
              <>
                <LeadSelect
                  placeholder="HAE Lead"
                  value={editCategoryModal.form.haeLead}
                  onChange={(haeLead) =>
                    setEditCategoryModal({
                      ...editCategoryModal,
                      form: { ...editCategoryModal.form, haeLead },
                    })
                  }
                />
                <input
                  type="date"
                  value={editCategoryModal.form.startDate}
                  onChange={(e) =>
                    setEditCategoryModal({
                      ...editCategoryModal,
                      form: { ...editCategoryModal.form, startDate: e.target.value },
                    })
                  }
                  className="rounded-md border border-hae-line px-3 py-2 text-sm text-hae-slate"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Duration (weeks)"
                  value={editCategoryModal.form.durationWeeks}
                  onChange={(e) =>
                    setEditCategoryModal({
                      ...editCategoryModal,
                      form: { ...editCategoryModal.form, durationWeeks: e.target.value },
                    })
                  }
                  className="rounded-md border border-hae-line px-3 py-2 text-sm"
                />
                <input
                  placeholder="Instructor"
                  value={editCategoryModal.form.instructor}
                  onChange={(e) =>
                    setEditCategoryModal({
                      ...editCategoryModal,
                      form: { ...editCategoryModal.form, instructor: e.target.value },
                    })
                  }
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
                />
                <input
                  placeholder="Guest speaker"
                  value={editCategoryModal.form.guestSpeaker}
                  onChange={(e) =>
                    setEditCategoryModal({
                      ...editCategoryModal,
                      form: { ...editCategoryModal.form, guestSpeaker: e.target.value },
                    })
                  }
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson sm:col-span-2"
                />
              </>
            ) : null}
            {CATEGORY_META[editCategoryModal.collectionName].showCustomProgramFields ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">Start date</span>
                  <input
                    type="date"
                    value={editCategoryModal.form.startDate}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, startDate: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm text-hae-slate"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-hae-slate">Status</span>
                  <select
                    value={editCategoryModal.form.status}
                    onChange={(e) =>
                      setEditCategoryModal({
                        ...editCategoryModal,
                        form: { ...editCategoryModal.form, status: e.target.value },
                      })
                    }
                    className="rounded-md border border-hae-line px-3 py-2 text-sm"
                  >
                    <option value="">Select status</option>
                    {CUSTOM_PROGRAM_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </form>
        ) : null}
      </Modal>
    </>
  )
}
