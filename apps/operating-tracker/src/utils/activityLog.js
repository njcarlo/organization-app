import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const TASK_FIELDS = [
  { key: 'name', label: 'Task name' },
  { key: 'owner', label: 'Owner' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'waitingOn', label: 'Waiting on' },
  { key: 'leadershipAttention', label: 'Leadership' },
  { key: 'nextAction', label: 'Next action' },
  { key: 'notes', label: 'Notes' },
  { key: 'subtasks', label: 'Subtasks' },
]

const PROJECT_FIELDS = [
  { key: 'name', label: 'Project name' },
  { key: 'lead', label: 'Lead' },
  { key: 'promise', label: 'Promise' },
  { key: 'health', label: 'Status' },
  { key: 'targetDate', label: 'Target date' },
  { key: 'notes', label: 'Notes' },
]

function displayValue(value) {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) {
    if (!value.length) return '—'
    return value
      .map((v) => (typeof v === 'string' ? v : v?.name || `${value.length} item(s)`))
      .join(', ')
  }
  return String(value)
}

function diffFields(before, after, fields) {
  const changes = []
  for (const { key, label } of fields) {
    const beforeValue = JSON.stringify(before?.[key] ?? null)
    const afterValue = JSON.stringify(after?.[key] ?? null)
    if (beforeValue !== afterValue) {
      changes.push({
        field: key,
        label,
        before: displayValue(before?.[key]),
        after: displayValue(after?.[key]),
      })
    }
  }
  return changes
}

/** Diff the user-facing task fields that changed between two versions of a task doc. */
export function diffTaskFields(before, after) {
  return diffFields(before, after, TASK_FIELDS)
}

/** Diff the user-facing project fields that changed between two versions of a project doc. */
export function diffProjectFields(before, after) {
  return diffFields(before, after, PROJECT_FIELDS)
}

/**
 * Record an entry in a task/project's `history` subcollection (an append-only audit trail).
 * Swallows failures so a logging hiccup never blocks the underlying save/delete.
 */
export async function logHistory({
  parentType,
  parentId,
  parentName = null,
  programId = null,
  action,
  changes = null,
  snapshot = null,
  commentText = null,
  byId = null,
  byName = 'Someone',
}) {
  try {
    await addDoc(collection(db, parentType, parentId, 'history'), {
      parentType,
      parentId,
      parentName,
      programId,
      action,
      changes,
      snapshot,
      commentText,
      byId,
      byName,
      createdAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Failed to record history entry', err)
  }
}

const ACTION_VERBS = {
  updated: 'updated',
  deleted: 'deleted this',
  comment_added: 'added a comment',
  comment_edited: 'edited a comment',
  comment_deleted: 'deleted a comment',
}

/** Short verb phrase describing a history entry's action, for feed/list rendering. */
export function describeAction(action) {
  return ACTION_VERBS[action] || action
}
