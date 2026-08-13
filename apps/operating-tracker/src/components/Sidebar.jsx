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
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import LeadSelect from './LeadSelect'
import { FEATURES, Modal, SideNav, useFeatures, isSurveysHidden } from '@hae/ui'
import { EVENT_FORMAT_OPTIONS, EXEC_INBOX_EMAILS, HEALTH_OPTIONS } from '../constants'
import { formatDate, namesLabel, toNameList } from '../utils'

const CUSTOM_PROGRAM_STATUS_OPTIONS = ['Prospect', 'Approved']

const SECTION_TEMPLATE_OPTIONS = [
  { value: '', label: 'No template' },
  { value: 'documents', label: 'Links Directory (Documents & Assets)' },
  { value: 'tasks', label: 'Task Board (Programs)' },
  { value: 'events', label: 'Events Tracker (Events & Programs Dashboard)' },
]

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
  customSectionItems: { label: 'Item' },
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
  'content',
  'data',
  'board-commitments',
  'chapters',
]

/** Tracker sidenav — expandable chrome; platform switch lives in the header. */
export default function Sidebar({ open = false, onClose }) {
  const { user, userProfile, isAdmin, logout, roleLabel, sectionAccess } = useAuth()
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
  const [customSections, setCustomSections] = useState([])
  const [customSectionItems, setCustomSectionItems] = useState([])
  const [sidebarGroups, setSidebarGroups] = useState([])
  const [addProjectModal, setAddProjectModal] = useState(null)
  const [editCategoryModal, setEditCategoryModal] = useState(null)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [newSectionLabel, setNewSectionLabel] = useState('')
  const [newSectionTemplate, setNewSectionTemplate] = useState('')
  const [addingSection, setAddingSection] = useState(false)
  const [groupModal, setGroupModal] = useState(null)
  const [savingGroup, setSavingGroup] = useState(false)
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
    customSections: setCustomSections,
    customSectionItems: setCustomSectionItems,
    sidebarGroups: setSidebarGroups,
  }

  // customSectionItems spans many sections (tagged by sectionId), so it isn't
  // sorted as one flat list here — sorting happens per-section in `sections`.
  const reload = (collectionName) => {
    getDocs(collection(db, collectionName))
      .then((snap) => {
        const list = toList(snap)
        setters[collectionName](
          collectionName === 'customSectionItems' ? list : list.sort(sortByOrder)
        )
      })
      .catch((err) => console.error(`Failed to load ${collectionName}`, err))
  }

  const reorderCategory = async (collectionName, orderedItems) => {
    const ids = orderedItems.map((item) => item.id)
    const setter = setters[collectionName]
    // Update `order` in place rather than rebuilding the array — collections like
    // customSectionItems are shared across many sections, so `orderedItems` may
    // only be a subset; rebuilding from just those ids would drop the rest.
    // Re-sort by the updated `order` afterwards: most sections render this array
    // directly (no sort at the render site), so without re-sorting here the drag
    // visually snaps back even though Firestore is updated correctly.
    setter((prev) =>
      prev
        .map((entry) => {
          const idx = ids.indexOf(entry.id)
          return idx === -1 ? entry : { ...entry, order: idx }
        })
        .sort(sortByOrder)
    )
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
        { labels: { [sectionId]: label } },
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
    loadInto('customSections', setCustomSections)
    loadInto('customSectionItems', setCustomSectionItems)
    loadInto('sidebarGroups', setSidebarGroups)
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
      sectionId: category.sectionId,
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
    const { collectionName, categoryId, sectionId, form } = addProjectModal
    setSaving(true)
    try {
      const existingSnap = await getDocs(
        query(collection(db, 'projects'), where('programId', '==', categoryId))
      )
      const maxOrder = existingSnap.docs.reduce((m, d) => Math.max(m, d.data().order ?? 0), -1)
      await addDoc(collection(db, 'projects'), {
        name: form.name.trim(),
        lead: form.lead,
        promise: form.promise.trim(),
        health: form.health,
        targetDate: form.targetDate || '',
        notes: form.notes.trim(),
        programId: categoryId,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setAddProjectModal(null)
      const pathPrefix =
        collectionName === 'customSectionItems'
          ? `/custom-sections/${sectionId}`
          : CATEGORY_META[collectionName].pathPrefix
      navigate(`${pathPrefix}/${categoryId}`)
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

  const openAddCategory = (collectionName, sectionId, groupId) => {
    setEditCategoryModal({
      collectionName,
      sectionId,
      groupId,
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
    const { collectionName, id, sectionId, groupId, form } = editCategoryModal
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
        reload(collectionName)
      } else {
        await addDoc(collection(db, collectionName), {
          ...data,
          ...(collectionName === 'customSectionItems' ? { sectionId } : {}),
          ...(groupId ? { groupId } : {}),
          createdAt: serverTimestamp(),
        })
        if (collectionName === 'chapters') {
          const snap = await getDocs(collection(db, collectionName))
          await sortAlphabetically(collectionName, toList(snap))
        } else {
          reload(collectionName)
        }
      }
      setEditCategoryModal(null)
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

  // Groups are a lightweight second nesting level within a section — e.g.
  // clustering several Academy programs together. Scoped by `sectionKey`
  // (the collection name for built-in sections, or `customSectionItems:{id}`
  // for a user-created section, since that collection spans many sections).
  const groupsForKey = (sectionKey) =>
    sidebarGroups.filter((g) => g.sectionKey === sectionKey).sort(sortByOrder)

  const partitionByGroup = (rows, groupDefs, collectionName, sectionId) => {
    const byGroupId = new Map(groupDefs.map((g) => [g.id, []]))
    const ungrouped = []
    rows.forEach((row) => {
      if (row.groupId && byGroupId.has(row.groupId)) byGroupId.get(row.groupId).push(row)
      else ungrouped.push(row)
    })
    return {
      items: ungrouped,
      groups: groupDefs.map((g) => ({
        id: g.id,
        label: g.label,
        actions: [
          ...(collectionName
            ? [
                {
                  key: 'add-item',
                  label: `Add ${CATEGORY_META[collectionName].label.toLowerCase()}`,
                  onClick: () => openAddCategory(collectionName, sectionId, g.id),
                },
              ]
            : []),
          { key: 'rename-group', label: 'Rename group', onClick: () => openRenameGroup(g) },
          {
            key: 'delete-group',
            label: 'Delete group',
            danger: true,
            onClick: () => deleteGroup(g),
          },
        ],
        items: byGroupId.get(g.id),
      })),
    }
  }

  const openAddGroup = (sectionKey) => {
    setGroupModal({ sectionKey, id: null, label: '' })
  }

  const openRenameGroup = (group) => {
    setGroupModal({ sectionKey: group.sectionKey, id: group.id, label: group.label })
  }

  const closeGroupModal = () => {
    if (savingGroup) return
    setGroupModal(null)
  }

  const submitGroupModal = async (e) => {
    e.preventDefault()
    const label = groupModal?.label.trim()
    if (!label || savingGroup) return
    setSavingGroup(true)
    try {
      if (groupModal.id) {
        await updateDoc(doc(db, 'sidebarGroups', groupModal.id), { label })
      } else {
        const maxOrder = groupsForKey(groupModal.sectionKey).reduce(
          (max, g) => Math.max(max, g.order ?? 0),
          -1
        )
        await addDoc(collection(db, 'sidebarGroups'), {
          sectionKey: groupModal.sectionKey,
          label,
          order: maxOrder + 1,
          createdAt: serverTimestamp(),
        })
      }
      reload('sidebarGroups')
      setGroupModal(null)
    } catch (err) {
      console.error('Failed to save group', err)
      alert(err.message || 'Failed to save group')
    } finally {
      setSavingGroup(false)
    }
  }

  const deleteGroup = async (group) => {
    if (
      !confirm(`Delete "${group.label}"? Items in this group are not removed, just ungrouped.`)
    )
      return
    try {
      await deleteDoc(doc(db, 'sidebarGroups', group.id))
      reload('sidebarGroups')
    } catch (err) {
      console.error('Failed to delete group', err)
      alert(err.message || 'Failed to delete group')
    }
  }

  const moveItemToGroup = async (collectionName, itemId, groupId) => {
    try {
      await updateDoc(doc(db, collectionName, itemId), { groupId: groupId || null })
      reload(collectionName)
    } catch (err) {
      console.error('Failed to move item', err)
      alert(err.message || 'Failed to move item')
    }
  }

  const groupActions = (collectionName, category, groupDefs) => [
    ...(groupDefs.length
      ? groupDefs
          .filter((g) => g.id !== category.groupId)
          .map((g) => ({
            key: `move-to-group-${g.id}`,
            label: `Move to "${g.label}"`,
            onClick: () => moveItemToGroup(collectionName, category.id, g.id),
          }))
      : []),
    ...(category.groupId && groupDefs.some((g) => g.id === category.groupId)
      ? [
          {
            key: 'remove-from-group',
            label: 'Remove from group',
            onClick: () => moveItemToGroup(collectionName, category.id, null),
          },
        ]
      : []),
  ]

  const addGroupAction = (sectionKey) => ({
    key: 'add-group',
    label: 'Add group',
    onClick: () => openAddGroup(sectionKey),
  })

  const openAddSection = () => {
    setNewSectionLabel('')
    setNewSectionTemplate('')
    setAddSectionOpen(true)
  }

  const closeAddSection = () => {
    if (addingSection) return
    setAddSectionOpen(false)
  }

  // Seeds one starter customSectionItems "page" so a new section immediately
  // shows the pattern the user picked, instead of landing on an empty section.
  const seedSectionTemplate = async (sectionId, template) => {
    const itemRef = await addDoc(collection(db, 'customSectionItems'), {
      name: template === 'events' ? 'First event' : template === 'documents' ? 'Links' : 'First project',
      lead: [],
      sectionId,
      ...(template === 'documents' ? { kind: 'documents' } : {}),
      ...(template === 'events'
        ? {
            kind: 'events',
            eventDate: '',
            eventTime: '',
            marketingDate: '',
            venue: '',
            format: '',
            health: 'not-started',
          }
        : {}),
      createdAt: serverTimestamp(),
    })
    if (template === 'documents') {
      await addDoc(collection(db, 'trackerDocumentGroups'), {
        name: 'Links',
        programId: itemRef.id,
        order: 1,
        createdAt: serverTimestamp(),
      })
    } else if (template === 'tasks') {
      await addDoc(collection(db, 'projects'), {
        name: 'First project',
        lead: [],
        promise: '',
        health: 'ongoing',
        targetDate: '',
        notes: '',
        programId: itemRef.id,
        order: 0,
        createdAt: serverTimestamp(),
      })
    }
    return itemRef
  }

  const submitAddSection = async (e) => {
    e.preventDefault()
    const label = newSectionLabel.trim()
    if (!label || addingSection) return
    setAddingSection(true)
    try {
      const maxOrder = customSections.reduce((max, s) => Math.max(max, s.order ?? 0), -1)
      const sectionRef = await addDoc(collection(db, 'customSections'), {
        label,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      reload('customSections')
      let itemRef = null
      if (newSectionTemplate) {
        itemRef = await seedSectionTemplate(sectionRef.id, newSectionTemplate)
        reload('customSectionItems')
      }
      setAddSectionOpen(false)
      if (itemRef) navigate(`/custom-sections/${sectionRef.id}/${itemRef.id}`)
    } catch (err) {
      console.error('Failed to add section', err)
      alert(err.message || 'Failed to add section')
    } finally {
      setAddingSection(false)
    }
  }

  const deleteCustomSection = async (section) => {
    if (
      !confirm(
        `Delete "${section.label}"? Items in this section are not cascade-deleted. This action cannot be undone.`
      )
    )
      return
    try {
      await deleteDoc(doc(db, 'customSections', section.id))
      reload('customSections')
    } catch (err) {
      console.error('Failed to delete section', err)
      alert(err.message || 'Failed to delete section')
    }
  }

  const sectionActions = (collectionName, labelOverride, sectionId) => [
    {
      key: 'add-category',
      label: labelOverride || `Add ${CATEGORY_META[collectionName].label.toLowerCase()}`,
      onClick: () => openAddCategory(collectionName, sectionId),
    },
  ]

  const sortAlphabetically = (collectionName, items) => {
    const sorted = [...items].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    )
    return reorderCategory(collectionName, sorted)
  }

  // Appended to every section that supports drag reordering.
  const sortAzAction = (collectionName, items) => ({
    key: 'sort-az',
    label: 'Sort A–Z',
    onClick: () => sortAlphabetically(collectionName, items),
  })

  const categoryActions = (collectionName, category, groupDefs = []) => [
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
    ...groupActions(collectionName, category, groupDefs),
    {
      key: 'delete-category',
      label: `Delete ${CATEGORY_META[collectionName].label.toLowerCase()}`,
      danger: true,
      onClick: () => deleteCategory(collectionName, category),
    },
  ]

  const sections = useMemo(() => {
    // Section-restricted users don't get the org-wide Dashboard or Activity
    // feed — they land in (and stay within) their assigned section(s).
    const workspaceItems = sectionAccess
      ? [
          { to: '/my-tasks', label: 'My Tasks', icon: 'checklist' },
          { to: '/calendar', label: 'Calendar', icon: 'calendar' },
        ]
      : [
          { to: '/', label: 'Dashboard', end: true, icon: 'home' },
          { to: '/my-tasks', label: 'My Tasks', icon: 'checklist' },
          { to: '/calendar', label: 'Calendar', icon: 'calendar' },
          { to: '/activity', label: 'Activity', icon: 'history' },
          { to: '/advancement-dashboard', label: 'Advancement and Programming', icon: 'chart' },
        ]
    if (isExecInboxUser) {
      workspaceItems.push({
        to: '/executive-inbox',
        label: 'Executive Inbox',
        icon: 'message',
      })
      workspaceItems.push({
        to: '/daily-briefing',
        label: 'Daily Briefing',
        icon: 'calendar',
      })
    }
    if (!isSurveysHidden() && isEnabled(FEATURES.SURVEYS)) {
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

    const programsGroupDefs = groupsForKey('programs')
    const { items: programsItems, groups: programsGroups } = partitionByGroup(
      programs.map((p) => ({
        id: p.id,
        to: `/programs/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        groupId: p.groupId,
        actions: categoryActions('programs', p, programsGroupDefs),
      })),
      programsGroupDefs,
      'programs'
    )
    next.push({
      id: 'programs',
      label: 'Programs',
      actions: [
        ...sectionActions('programs'),
        sortAzAction('programs', programs),
        addGroupAction('programs'),
      ],
      onReorderItems: (items) => reorderCategory('programs', items),
      items: programsItems,
      groups: programsGroups,
      emptyLabel: programs.length === 0 ? 'No programs yet' : undefined,
    })

    const academyGroupDefs = groupsForKey('academyPrograms')
    const { items: academyItems, groups: academyGroups } = partitionByGroup(
      academyPrograms.map((p) => ({
        id: p.id,
        to: `/academy/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        groupId: p.groupId,
        actions: categoryActions('academyPrograms', p, academyGroupDefs),
      })),
      academyGroupDefs,
      'academyPrograms'
    )
    next.push({
      id: 'academy',
      label: 'Academy',
      actions: [
        ...sectionActions('academyPrograms'),
        sortAzAction('academyPrograms', academyPrograms),
        addGroupAction('academyPrograms'),
      ],
      onReorderItems: (items) => reorderCategory('academyPrograms', items),
      items: [
        { to: '/academy/course-registrations', label: 'Course Enrollments', icon: 'checklist' },
        { to: '/academy/links', label: 'Academy Links', icon: 'folder' },
        { to: '/academy/calendar', label: 'Academy Calendar', icon: 'calendar' },
        ...academyItems,
      ],
      groups: academyGroups,
    })

    const customProgramsGroupDefs = groupsForKey('customPrograms')
    const { items: customProgramsItems, groups: customProgramsGroups } = partitionByGroup(
      customPrograms.map((p) => ({
        id: p.id,
        to: `/custom-programs/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        groupId: p.groupId,
        actions: categoryActions('customPrograms', p, customProgramsGroupDefs),
      })),
      customProgramsGroupDefs,
      'customPrograms'
    )
    next.push({
      id: 'custom-programs',
      label: 'Custom Programs',
      actions: [
        ...sectionActions('customPrograms'),
        sortAzAction('customPrograms', customPrograms),
        addGroupAction('customPrograms'),
      ],
      onReorderItems: (items) => reorderCategory('customPrograms', items),
      items: customProgramsItems,
      groups: customProgramsGroups,
      emptyLabel: customPrograms.length === 0 ? 'No Custom Programs yet' : undefined,
    })

    const trackerDocumentsGroupDefs = groupsForKey('trackerDocuments')
    const { items: trackerDocumentsItems, groups: trackerDocumentsGroups } = partitionByGroup(
      trackerDocuments.map((p) => ({
        id: p.id,
        to: `/documents/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        groupId: p.groupId,
        actions: categoryActions('trackerDocuments', p, trackerDocumentsGroupDefs),
      })),
      trackerDocumentsGroupDefs,
      'trackerDocuments'
    )
    next.push({
      id: 'documents',
      label: 'Documents & Assets',
      actions: [
        ...sectionActions('trackerDocuments'),
        sortAzAction('trackerDocuments', trackerDocuments),
        addGroupAction('trackerDocuments'),
      ],
      onReorderItems: (items) => reorderCategory('trackerDocuments', items),
      items: trackerDocumentsItems,
      groups: trackerDocumentsGroups,
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

    const trackerGraphicsGroupDefs = groupsForKey('trackerGraphics')
    const { items: trackerGraphicsItems, groups: trackerGraphicsGroups } = partitionByGroup(
      trackerGraphics.map((p) => ({
        id: p.id,
        to: `/graphics/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        groupId: p.groupId,
        actions: categoryActions('trackerGraphics', p, trackerGraphicsGroupDefs),
      })),
      trackerGraphicsGroupDefs,
      'trackerGraphics'
    )
    next.push({
      id: 'graphics',
      label: 'Graphics',
      actions: [
        ...sectionActions('trackerGraphics'),
        sortAzAction('trackerGraphics', trackerGraphics),
        addGroupAction('trackerGraphics'),
      ],
      onReorderItems: (items) => reorderCategory('trackerGraphics', items),
      items: [{ to: '/graphics-dashboard', label: 'Graphics Dashboard', icon: 'chart' }, ...trackerGraphicsItems],
      groups: trackerGraphicsGroups,
    })

    next.push({
      id: 'content',
      label: 'Content',
      items: [{ to: '/content-calendar', label: 'Social Media Calendar', icon: 'calendar' }],
    })

    const trackerDataGroupDefs = groupsForKey('trackerData')
    const { items: trackerDataItems, groups: trackerDataGroups } = partitionByGroup(
      trackerData.map((p) => ({
        id: p.id,
        to: `/data/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        groupId: p.groupId,
        actions: categoryActions('trackerData', p, trackerDataGroupDefs),
      })),
      trackerDataGroupDefs,
      'trackerData'
    )
    next.push({
      id: 'data',
      label: 'Data Projects',
      actions: [
        ...sectionActions('trackerData', 'Add Data Project'),
        sortAzAction('trackerData', trackerData),
        addGroupAction('trackerData'),
      ],
      onReorderItems: (items) => reorderCategory('trackerData', items),
      items: trackerDataItems,
      groups: trackerDataGroups,
      emptyLabel: trackerData.length === 0 ? 'Nothing here yet' : undefined,
    })

    const boardCommitmentsGroupDefs = groupsForKey('boardCommitments')
    const { items: boardCommitmentsItems, groups: boardCommitmentsGroups } = partitionByGroup(
      boardCommitments.map((p) => ({
        id: p.id,
        to: `/board-commitments/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: namesLabel(p.lead) || undefined,
        groupId: p.groupId,
        actions: categoryActions('boardCommitments', p, boardCommitmentsGroupDefs),
      })),
      boardCommitmentsGroupDefs,
      'boardCommitments'
    )
    next.push({
      id: 'board-commitments',
      label: 'Board Commitments',
      actions: [
        ...sectionActions('boardCommitments', 'Add Board Commitment'),
        sortAzAction('boardCommitments', boardCommitments),
        addGroupAction('boardCommitments'),
      ],
      onReorderItems: (items) => reorderCategory('boardCommitments', items),
      items: boardCommitmentsItems,
      groups: boardCommitmentsGroups,
      emptyLabel: boardCommitments.length === 0 ? 'Nothing here yet' : undefined,
    })

    const chaptersGroupDefs = groupsForKey('chapters')
    const { items: chaptersItems, groups: chaptersGroups } = partitionByGroup(
      chapters.map((p) => ({
        id: p.id,
        to: `/chapters/${p.id}`,
        label: p.name,
        icon: 'folder',
        description: [p.chapterLeader, p.coLeaders].filter(Boolean).join(' · ') || undefined,
        groupId: p.groupId,
        actions: categoryActions('chapters', p, chaptersGroupDefs),
      })),
      chaptersGroupDefs,
      'chapters'
    )
    next.push({
      id: 'chapters',
      label: 'Chapters',
      actions: [
        ...sectionActions('chapters', 'Add a chapter'),
        sortAzAction('chapters', chapters),
        addGroupAction('chapters'),
      ],
      onReorderItems: (items) => reorderCategory('chapters', items),
      items: [
        { to: '/chapter-leader-dashboard', label: 'Chapter Leader Dashboard', icon: 'chart' },
        ...chaptersItems,
      ],
      groups: chaptersGroups,
      emptyLabel: chapters.length === 0 ? 'No chapters yet' : undefined,
    })

    // User-created sections, one per `customSections` doc; items live in the
    // shared `customSectionItems` collection, tagged by `sectionId`.
    customSections
      .slice()
      .sort(sortByOrder)
      .forEach((section) => {
        const sectionKey = `customSectionItems:${section.id}`
        const sectionGroupDefs = groupsForKey(sectionKey)
        const sectionItems = customSectionItems
          .filter((it) => it.sectionId === section.id)
          .sort(sortByOrder)
        const { items: partitionedItems, groups: sectionGroups } = partitionByGroup(
          sectionItems.map((p) => ({
            id: p.id,
            to: `/custom-sections/${section.id}/${p.id}`,
            label: p.name,
            icon: 'folder',
            description: namesLabel(p.lead) || undefined,
            groupId: p.groupId,
            actions: categoryActions('customSectionItems', p, sectionGroupDefs),
          })),
          sectionGroupDefs,
          'customSectionItems',
          section.id
        )
        next.push({
          id: section.id,
          label: section.label,
          actions: [
            ...sectionActions('customSectionItems', 'Add item', section.id),
            sortAzAction('customSectionItems', sectionItems),
            addGroupAction(sectionKey),
            {
              key: 'delete-section',
              label: 'Delete section',
              danger: true,
              onClick: () => deleteCustomSection(section),
            },
          ],
          onReorderItems: (items) => reorderCategory('customSectionItems', items),
          items: partitionedItems,
          groups: sectionGroups,
          emptyLabel: 'No items yet',
        })
      })

    // Workspace stays fixed. The rest: reordering is a personal preference
    // (each user drags their own view), while renaming is shared org-wide
    // chrome — any staff user can rename, and it changes the label for everyone.
    const [workspace, ...allContent] = next
    const content = sectionAccess
      ? allContent.filter((section) => sectionAccess.includes(section.id))
      : allContent
    const byId = new Map(content.map((section) => [section.id, section]))
    const orderedIds = [
      ...sectionConfig.order.filter((id) => byId.has(id)),
      ...DEFAULT_SECTION_ORDER.filter((id) => byId.has(id) && !sectionConfig.order.includes(id)),
    ]
    // Sections absent from both the user's saved order and the hardcoded
    // defaults (e.g. a custom section created after the user's last reorder)
    // would otherwise silently disappear — append them at the end.
    const remainingIds = [...byId.keys()].filter((id) => !orderedIds.includes(id))
    const finalOrderedIds = [...orderedIds, ...remainingIds]
    const orderedContent = finalOrderedIds.map((id) => {
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
    customSections,
    customSectionItems,
    sidebarGroups,
    isAdmin,
    isEnabled,
    isExecInboxUser,
    sectionConfig,
    sectionAccess,
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
        onReorderSections={sectionAccess ? undefined : reorderSections}
        onAddSection={sectionAccess ? undefined : openAddSection}
      />

      <Modal
        open={addSectionOpen}
        onClose={closeAddSection}
        title="Add a section"
        busy={addingSection}
        footer={
          <>
            <button
              type="button"
              className="hae-btn-secondary"
              onClick={closeAddSection}
              disabled={addingSection}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sidebar-add-section-form"
              className="hae-btn"
              disabled={addingSection}
            >
              {addingSection ? 'Saving…' : 'Create section'}
            </button>
          </>
        }
      >
        <form id="sidebar-add-section-form" onSubmit={submitAddSection} className="space-y-3">
          <input
            required
            autoFocus
            placeholder="Section name"
            value={newSectionLabel}
            onChange={(e) => setNewSectionLabel(e.target.value)}
            className="w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Starter template (optional)</span>
            <select
              value={newSectionTemplate}
              onChange={(e) => setNewSectionTemplate(e.target.value)}
              className="w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            >
              {SECTION_TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </form>
      </Modal>

      <Modal
        open={!!groupModal}
        onClose={closeGroupModal}
        title={groupModal?.id ? 'Rename group' : 'Add a group'}
        busy={savingGroup}
        footer={
          <>
            <button
              type="button"
              className="hae-btn-secondary"
              onClick={closeGroupModal}
              disabled={savingGroup}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sidebar-group-form"
              className="hae-btn"
              disabled={savingGroup}
            >
              {savingGroup ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {groupModal ? (
          <form id="sidebar-group-form" onSubmit={submitGroupModal} className="space-y-3">
            <input
              required
              autoFocus
              placeholder="Group name"
              value={groupModal.label}
              onChange={(e) => setGroupModal({ ...groupModal, label: e.target.value })}
              className="w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
          </form>
        ) : null}
      </Modal>

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
