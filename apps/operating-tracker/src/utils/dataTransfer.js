/**
 * Firestore JSON import/export helpers for Admin.
 * Documents use `_id` for stable IDs on import.
 */
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export const EXPORT_COLLECTIONS = [
  { id: 'programs', label: 'Programs', app: 'Tracker' },
  { id: 'academyPrograms', label: 'Academy', app: 'Tracker' },
  { id: 'customPrograms', label: 'Custom Programs', app: 'Tracker' },
  { id: 'trackerDocuments', label: 'Documents', app: 'Tracker' },
  { id: 'trackerDocumentFiles', label: 'Document Files', app: 'Tracker' },
  { id: 'trackerEvents', label: 'Events', app: 'Tracker' },
  { id: 'trackerGraphics', label: 'Graphics', app: 'Tracker' },
  { id: 'courseRegistrations', label: 'Course Registrations', app: 'Tracker' },
  { id: 'projects', label: 'Projects', app: 'Tracker' },
  { id: 'tasks', label: 'Tasks', app: 'Tracker' },
  { id: 'surveys', label: 'Surveys', app: 'Tracker' },
  { id: 'surveyResponses', label: 'Survey responses', app: 'Tracker' },
  { id: 'surveyInvites', label: 'Survey invites', app: 'Tracker' },
  { id: 'users', label: 'Users (profiles)', app: 'Tracker' },
  { id: 'courses', label: 'Courses', app: 'LMS' },
  { id: 'modules', label: 'Modules', app: 'LMS' },
  { id: 'enrollments', label: 'Enrollments', app: 'LMS' },
  { id: 'sessions', label: 'Sessions', app: 'LMS' },
  { id: 'checkIns', label: 'Check-ins', app: 'LMS' },
  { id: 'certificates', label: 'Certificates', app: 'LMS' },
  { id: 'experts', label: 'Experts', app: 'EiR' },
  { id: 'contacts', label: 'Contacts', app: 'CRM' },
  { id: 'interactions', label: 'Interactions', app: 'CRM' },
  { id: 'members', label: 'Members', app: 'AMS' },
  { id: 'memberships', label: 'Memberships', app: 'AMS' },
  { id: 'events', label: 'Events', app: 'AMS' },
  { id: 'committees', label: 'Committees', app: 'AMS' },
]

function serializeValue(v) {
  if (v == null) return v
  if (typeof v?.toDate === 'function') return v.toDate().toISOString()
  if (Array.isArray(v)) return v.map(serializeValue)
  if (typeof v === 'object') {
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = serializeValue(val)
    return out
  }
  return v
}

export async function exportCollections(collectionIds) {
  const payload = {
    exportedAt: new Date().toISOString(),
    project: 'hae-operating-tracker',
  }
  for (const id of collectionIds) {
    const snap = await getDocs(collection(db, id))
    payload[id] = snap.docs.map((d) => ({
      _id: d.id,
      ...serializeValue(d.data()),
    }))
  }
  return payload
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function stripMeta(row) {
  const { _id, id, ...rest } = row
  // Drop server-only fields that shouldn't be re-written as-is if missing
  return rest
}

/**
 * Upsert documents from { collectionName: [ { _id, ...fields } ] }.
 * Users: profile fields only (does not create Firebase Auth accounts).
 */
export async function importCollections(payload, { replaceExtras = false } = {}) {
  const summary = {}
  const keys = Object.keys(payload).filter(
    (k) => Array.isArray(payload[k]) && EXPORT_COLLECTIONS.some((c) => c.id === k)
  )

  for (const collectionId of keys) {
    const rows = payload[collectionId]
    let written = 0
    // Firestore batches max 500
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400)
      const batch = writeBatch(db)
      for (const row of chunk) {
        const docId = row._id || row.id
        if (!docId) continue
        const data = stripMeta(row)
        if (collectionId !== 'users' && data.createdAt == null) {
          data.createdAt = serverTimestamp()
        }
        batch.set(doc(db, collectionId, docId), data, { merge: true })
        written += 1
      }
      await batch.commit()
    }

    let deleted = 0
    if (replaceExtras && collectionId !== 'users') {
      const keep = new Set(rows.map((r) => r._id || r.id).filter(Boolean))
      const snap = await getDocs(collection(db, collectionId))
      const extras = snap.docs.filter((d) => !keep.has(d.id))
      for (let i = 0; i < extras.length; i += 400) {
        const batch = writeBatch(db)
        for (const d of extras.slice(i, i + 400)) {
          batch.delete(d.ref)
          deleted += 1
        }
        await batch.commit()
      }
    }

    summary[collectionId] = { written, deleted }
  }

  return summary
}
