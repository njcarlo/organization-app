import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { PROJECT_DESTINATION_GROUPS } from '../constants'
import { logHistory } from '../utils/activityLog'

/**
 * Lets a user move or copy one or more projects (selected via checkbox, see
 * SelectionToolbar) into a different section/category — any top-level
 * collection that hosts projects, including user-created custom sections.
 * Move changes each project's `programId` in place; copy creates a new
 * project doc per selection (optionally duplicating its tasks) and leaves
 * the originals untouched.
 */
export default function MoveCopyProjectModal({
  open,
  onClose,
  projects,
  program,
  initialAction = 'move',
  onDone,
}) {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [groupKey, setGroupKey] = useState('')
  const [targetId, setTargetId] = useState('')
  const [action, setAction] = useState(initialAction)
  const [copyTasks, setCopyTasks] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const projectList = projects || []

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    setGroupKey('')
    setTargetId('')
    setAction(initialAction)
    setCopyTasks(true)

    const loadGroups = async () => {
      const staticGroups = await Promise.all(
        PROJECT_DESTINATION_GROUPS.map(async (g) => {
          const snap = await getDocs(collection(db, g.collectionName))
          const items = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          return { key: g.collectionName, label: g.label, pathPrefix: g.pathPrefix, items }
        })
      )

      const [sectionsSnap, sectionItemsSnap] = await Promise.all([
        getDocs(collection(db, 'customSections')),
        getDocs(collection(db, 'customSectionItems')),
      ])
      const sectionItems = sectionItemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const customGroups = sectionsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((section) => ({
          key: `customSectionItems:${section.id}`,
          label: section.label,
          pathPrefix: `/custom-sections/${section.id}`,
          items: sectionItems
            .filter((it) => it.sectionId === section.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        }))

      if (cancelled) return
      setGroups([...staticGroups, ...customGroups])
      setLoading(false)
    }

    loadGroups().catch((err) => {
      if (!cancelled) {
        setError(err.message || 'Failed to load destinations')
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [open, initialAction])

  const selectedGroup = useMemo(
    () => groups.find((g) => g.key === groupKey) || null,
    [groups, groupKey]
  )

  const close = () => {
    if (saving) return
    onClose?.()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!selectedGroup || !targetId || saving || !projectList.length) return
    const target = selectedGroup.items.find((it) => it.id === targetId)
    if (!target) return
    setSaving(true)
    setError('')
    try {
      const targetProjectsSnap = await getDocs(
        query(collection(db, 'projects'), where('programId', '==', target.id))
      )
      let nextOrder = targetProjectsSnap.docs.reduce(
        (m, d) => Math.max(m, d.data().order ?? 0),
        -1
      )

      const toMove =
        action === 'move'
          ? projectList.filter((p) => p.programId !== target.id)
          : projectList

      for (const project of toMove) {
        nextOrder += 1

        if (action === 'move') {
          await updateDoc(doc(db, 'projects', project.id), {
            programId: target.id,
            order: nextOrder,
          })
          logHistory({
            parentType: 'projects',
            parentId: project.id,
            parentName: project.name,
            programId: target.id,
            action: 'updated',
            changes: [
              {
                field: 'programId',
                label: 'Category',
                before: program?.name || '—',
                after: `${target.name} (${selectedGroup.label})`,
              },
            ],
            byId: user?.uid,
            byName: userProfile?.name || user?.email || 'Someone',
          })
        } else {
          const copyName = `${project.name} (copy)`
          const newProjectRef = await addDoc(collection(db, 'projects'), {
            name: copyName,
            lead: project.lead || [],
            promise: project.promise || '',
            health: project.health || 'ongoing',
            targetDate: project.targetDate || '',
            notes: project.notes || '',
            programId: target.id,
            order: nextOrder,
            createdAt: serverTimestamp(),
          })

          if (copyTasks) {
            const tasksSnap = await getDocs(
              query(collection(db, 'tasks'), where('projectId', '==', project.id))
            )
            const batch = writeBatch(db)
            tasksSnap.docs.forEach((d) => {
              const t = d.data()
              const newTaskRef = doc(collection(db, 'tasks'))
              batch.set(newTaskRef, {
                name: t.name || '',
                owner: t.owner || [],
                dueDate: t.dueDate || '',
                status: t.status || 'Not Started',
                priority: t.priority || '',
                waitingOn: t.waitingOn || '',
                leadershipAttention: t.leadershipAttention || 'None',
                nextAction: t.nextAction || '',
                notes: t.notes || '',
                subtasks: t.subtasks || [],
                order: t.order ?? 0,
                projectId: newProjectRef.id,
                projectName: copyName,
                programId: target.id,
                programName: target.name,
                createdAt: serverTimestamp(),
              })
            })
            await batch.commit()
          }
        }
      }

      onDone?.()
      onClose?.()
      if (action === 'move' && toMove.length) {
        navigate(`${selectedGroup.pathPrefix}/${target.id}`)
      }
    } catch (err) {
      setError(err.message || `Failed to ${action} project`)
    } finally {
      setSaving(false)
    }
  }

  const title =
    projectList.length === 1
      ? `Move or copy "${projectList[0]?.name || ''}"`
      : `Move or copy ${projectList.length} projects`

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      busy={saving}
      footer={
        <>
          <button type="button" className="hae-btn-secondary" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="move-copy-project-form"
            className="hae-btn"
            disabled={saving || loading || !groupKey || !targetId}
          >
            {saving ? 'Saving…' : action === 'move' ? 'Move' : 'Copy'}
          </button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-hae-slate">Loading destinations…</p>
      ) : (
        <form id="move-copy-project-form" onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-hae-red">{error}</p>}

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="move-copy-action"
                checked={action === 'move'}
                onChange={() => setAction('move')}
              />
              Move
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="move-copy-action"
                checked={action === 'copy'}
                onChange={() => setAction('copy')}
              />
              Copy
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Section / category</span>
            <select
              required
              value={groupKey}
              onChange={(e) => {
                setGroupKey(e.target.value)
                setTargetId('')
              }}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            >
              <option value="">Select a section</option>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-hae-slate">Sub category</span>
            <select
              required
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={!selectedGroup}
              className="rounded-md border border-hae-line px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">{selectedGroup ? 'Select an item' : 'Choose a section first'}</option>
              {selectedGroup?.items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
            {selectedGroup && selectedGroup.items.length === 0 ? (
              <span className="text-xs text-hae-slate">Nothing in this section yet.</span>
            ) : null}
          </label>

          {action === 'copy' ? (
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={copyTasks}
                onChange={(e) => setCopyTasks(e.target.checked)}
              />
              Also copy tasks
            </label>
          ) : null}
        </form>
      )}
    </Modal>
  )
}
