import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { FEATURES, Modal, SideNav, useFeatures } from '@hae/ui'
import { EXEC_INBOX_EMAILS, HEALTH_OPTIONS } from '../constants'

const CATEGORY_META = {
  programs: { label: 'Program', pathPrefix: '/programs' },
  academyPrograms: { label: 'Academy item', pathPrefix: '/academy', showCourseFields: true },
  customPrograms: { label: 'Custom Program', pathPrefix: '/custom-programs' },
}

const emptyProject = {
  name: '',
  lead: '',
  promise: '',
  health: 'ongoing',
  targetDate: '',
  notes: '',
}

const sortByOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)
const toList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))

/** Tracker sidenav — expandable chrome; platform switch lives in the header. */
export default function Sidebar({ open = false, onClose }) {
  const { user, userProfile, isAdmin, logout, roleLabel } = useAuth()
  const { isEnabled } = useFeatures()
  const navigate = useNavigate()
  const isExecInboxUser = EXEC_INBOX_EMAILS.includes((user?.email || '').toLowerCase())
  const [programs, setPrograms] = useState([])
  const [academyPrograms, setAcademyPrograms] = useState([])
  const [customPrograms, setCustomPrograms] = useState([])
  const [addProjectModal, setAddProjectModal] = useState(null)
  const [editCategoryModal, setEditCategoryModal] = useState(null)
  const [saving, setSaving] = useState(false)

  const setters = { programs: setPrograms, academyPrograms: setAcademyPrograms, customPrograms: setCustomPrograms }

  const reload = (collectionName) => {
    getDocs(collection(db, collectionName))
      .then((snap) => setters[collectionName](toList(snap).sort(sortByOrder)))
      .catch((err) => console.error(`Failed to load ${collectionName}`, err))
  }

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
    return () => {
      cancelled = true
    }
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
        lead: form.lead.trim(),
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

  const openEditCategory = (collectionName, category) => {
    const showCourseFields = CATEGORY_META[collectionName].showCourseFields
    setEditCategoryModal({
      collectionName,
      id: category.id,
      form: {
        name: category.name || '',
        lead: category.lead || '',
        ...(showCourseFields
          ? {
              haeLead: category.haeLead || '',
              startDate: category.startDate || '',
              durationWeeks: category.durationWeeks ?? '',
              instructor: category.instructor || '',
              guestSpeaker: category.guestSpeaker || '',
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
    const showCourseFields = CATEGORY_META[collectionName].showCourseFields
    setSaving(true)
    try {
      await updateDoc(doc(db, collectionName, id), {
        name: form.name.trim(),
        lead: form.lead.trim(),
        ...(showCourseFields
          ? {
              haeLead: form.haeLead.trim(),
              startDate: form.startDate,
              durationWeeks: form.durationWeeks ? Number(form.durationWeeks) : null,
              instructor: form.instructor.trim(),
              guestSpeaker: form.guestSpeaker.trim(),
            }
          : {}),
      })
      setEditCategoryModal(null)
      reload(collectionName)
    } finally {
      setSaving(false)
    }
  }

  const deleteCategory = async (collectionName, category) => {
    const label = CATEGORY_META[collectionName].label
    if (!confirm(`Delete "${category.name}"? Projects and tasks are not cascade-deleted.`)) return
    try {
      await deleteDoc(doc(db, collectionName, category.id))
      reload(collectionName)
    } catch (err) {
      console.error(`Failed to delete ${label.toLowerCase()}`, err)
      alert(err.message || `Failed to delete ${label.toLowerCase()}`)
    }
  }

  const categoryActions = (collectionName, category) => [
    {
      key: 'add-project',
      label: 'Add project',
      onClick: () => openAddProject(collectionName, category),
    },
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
          actions: categoryActions('programs', p),
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
          actions: categoryActions('academyPrograms', p),
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
          actions: categoryActions('customPrograms', p),
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
            <input
              placeholder="Lead"
              value={addProjectModal.form.lead}
              onChange={(e) =>
                setAddProjectModal({
                  ...addProjectModal,
                  form: { ...addProjectModal.form, lead: e.target.value },
                })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
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
        title={editCategoryModal ? `Edit ${CATEGORY_META[editCategoryModal.collectionName].label.toLowerCase()}` : ''}
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
            <input
              required
              placeholder="Name"
              value={editCategoryModal.form.name}
              onChange={(e) =>
                setEditCategoryModal({
                  ...editCategoryModal,
                  form: { ...editCategoryModal.form, name: e.target.value },
                })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <input
              placeholder="Overall lead"
              value={editCategoryModal.form.lead}
              onChange={(e) =>
                setEditCategoryModal({
                  ...editCategoryModal,
                  form: { ...editCategoryModal.form, lead: e.target.value },
                })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            {CATEGORY_META[editCategoryModal.collectionName].showCourseFields ? (
              <>
                <input
                  placeholder="HAE Lead"
                  value={editCategoryModal.form.haeLead}
                  onChange={(e) =>
                    setEditCategoryModal({
                      ...editCategoryModal,
                      form: { ...editCategoryModal.form, haeLead: e.target.value },
                    })
                  }
                  className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
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
          </form>
        ) : null}
      </Modal>
    </>
  )
}
