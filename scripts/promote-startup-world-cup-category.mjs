#!/usr/bin/env node
/**
 * One-time migration: move "Startup World Cup 2026" out of the built-in
 * `programs` collection (the "Programs" section) and turn it into its own
 * top-level category (a new `customSections` doc), with five subcategories
 * (`customSectionItems` docs) underneath it:
 *   - Assets      (kind: 'documents' — a Links/Documents bucket)
 *   - Invitations (task/project mode — no `kind`)
 *   - Marketing   (task/project mode — no `kind`)
 *   - Onboarding  (task/project mode — no `kind`)
 *   - General     (task/project mode — no `kind`; catch-all for existing
 *                  projects that don't fit the other buckets)
 *
 * Existing `projects`/`tasks` docs that reference the old `programs` doc are
 * reassigned to one of the 5 new subcategories per PROJECT_TARGET (matched
 * by project name), mirroring exactly what MoveCopyProjectModal.jsx's "move"
 * action writes: on the project doc, `programId` (+ recomputed `order`); on
 * each of its task docs, `programId` and `programName`.
 *
 * Mirrors the shapes used by Sidebar.jsx's submitAddSection/seedSectionTemplate
 * and CategoryProgramPage.jsx's promoteToCategory.
 *
 * Auth: FIREBASE_TOKEN (Firebase CLI refresh token, via `firebase login:ci`)
 * or GOOGLE_ACCESS_TOKEN. Dry-run by default; pass --apply to actually write.
 *
 * By default the old `programs/{id}` doc is left in place (its id is printed
 * so you can remove it manually once you've confirmed the new category looks
 * right in the app). Pass --delete-old to also delete it — refused if any
 * `projects`/`tasks` still reference it via `programId`, since deleting would
 * silently orphan them (see backfill-task-project-fields.mjs).
 */
const PROJECT = process.env.FIREBASE_PROJECT || 'hae-operating-tracker'
const APPLY = process.argv.includes('--apply')
const DELETE_OLD = process.argv.includes('--delete-old')

const OLD_PROGRAM_NAME = 'Startup World Cup 2026'
const NEW_SECTION_LABEL = 'Startup World Cup 2026'
const NEW_ITEMS = [
  { name: 'Assets', kind: 'documents' },
  { name: 'Invitations' },
  { name: 'Marketing' },
  { name: 'Onboarding' },
  { name: 'General' },
]

// Maps existing project names -> target subcategory name. Confirmed with the
// user from the actual dry-run project list.
const PROJECT_TARGET = {
  'Investor invitations': 'Invitations',
  'Marketing campaign': 'Marketing',
  'Semi-Finalist onboarding': 'Onboarding',
  'Judge Recruitment and Onboarding': 'Onboarding',
  'Semi-Finals': 'General',
  'Sponsor outreach': 'General',
  'Application Tracking & Review': 'General',
  'Venue logistics': 'General',
}

async function getAccessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN

  const refresh = process.env.FIREBASE_TOKEN
  if (!refresh) {
    throw new Error('Set FIREBASE_TOKEN (firebase login:ci) or GOOGLE_ACCESS_TOKEN')
  }

  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const { clientId, clientSecret } = require('firebase-tools/lib/api.js')
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: clientId(),
    client_secret: clientSecret(),
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${JSON.stringify(json)}`)
  }
  return json.access_token
}

function fromFirestoreValue(v) {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue)
  if ('mapValue' in v) return fromFirestoreFields(v.mapValue.fields || {})
  if ('timestampValue' in v) return v.timestampValue
  return null
}

function fromFirestoreFields(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields || {})) out[k] = fromFirestoreValue(v)
  return out
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return { integerValue: String(Math.trunc(v)) }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  return { stringValue: String(v) }
}

async function listCollectionFull(accessToken, collection) {
  const docs = []
  let pageToken = ''
  do {
    const q = new URLSearchParams({ pageSize: '300' })
    if (pageToken) q.set('pageToken', pageToken)
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}?${q}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    const json = await res.json()
    if (!res.ok) throw new Error(`List ${collection} failed: ${JSON.stringify(json)}`)
    for (const d of json.documents || []) {
      const id = d.name.split('/').pop()
      docs.push({ id, name: d.name, fields: fromFirestoreFields(d.fields) })
    }
    pageToken = json.nextPageToken || ''
  } while (pageToken)
  return docs
}

async function commitWrites(accessToken, writes) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Commit failed: ${JSON.stringify(json)}`)
  return json
}

function docPath(collection, id) {
  return `projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`
}

function createWrite(collection, id, fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields)) out[k] = toFirestoreValue(v)
  return { update: { name: docPath(collection, id), fields: out } }
}

function deleteWrite(collection, id) {
  return { delete: docPath(collection, id) }
}

function patchWrite(collection, id, patch) {
  const fields = {}
  for (const [k, v] of Object.entries(patch)) fields[k] = toFirestoreValue(v)
  return {
    update: { name: docPath(collection, id), fields },
    updateMask: { fieldPaths: Object.keys(patch) },
  }
}

// 20-char base62 id, matching the shape (not the exact algorithm) of
// Firestore client auto-IDs — good enough as a unique doc id.
function randomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < 20; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

async function main() {
  const accessToken = await getAccessToken()
  console.log(`Authenticated. Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN'}`)

  const programs = await listCollectionFull(accessToken, 'programs')
  const oldProgram = programs.find((p) => p.fields.name === OLD_PROGRAM_NAME)
  if (!oldProgram) {
    console.log(`No "programs" doc named "${OLD_PROGRAM_NAME}" found — nothing to migrate.`)
    return
  }
  console.log(`Found programs/${oldProgram.id}: ${JSON.stringify(oldProgram.fields)}`)

  const [projects, tasks, sections] = await Promise.all([
    listCollectionFull(accessToken, 'projects'),
    listCollectionFull(accessToken, 'tasks'),
    listCollectionFull(accessToken, 'customSections'),
  ])
  const linkedProjects = projects.filter((p) => p.fields.programId === oldProgram.id)
  const linkedTasks = tasks.filter((t) => t.fields.programId === oldProgram.id)
  console.log(
    `${linkedProjects.length} project(s) and ${linkedTasks.length} task(s) currently reference programId=${oldProgram.id}.`
  )
  if (linkedProjects.length || linkedTasks.length) {
    console.log('They will be reassigned per PROJECT_TARGET below.\n')
    if (linkedProjects.length) {
      console.log('Projects:')
      for (const p of linkedProjects) console.log(`  - [project ${p.id}] ${p.fields.name || '(unnamed)'}`)
    }
    if (linkedTasks.length) {
      console.log('Tasks:')
      for (const t of linkedTasks) {
        const proj = t.fields.projectId ? projects.find((p) => p.id === t.fields.projectId) : null
        console.log(
          `  - [task ${t.id}] ${t.fields.name || '(unnamed)'}${proj ? ` (project: ${proj.fields.name})` : ''}`
        )
      }
    }
    console.log('')
  }

  const maxOrder = sections.reduce((m, d) => Math.max(m, d.fields.order ?? 0), -1)
  const sectionId = randomId()
  const now = new Date()

  const writes = [createWrite('customSections', sectionId, {
    label: NEW_SECTION_LABEL,
    order: maxOrder + 1,
    createdAt: now,
  })]

  console.log(`\nWill create customSections/${sectionId} "${NEW_SECTION_LABEL}" (order ${maxOrder + 1}).`)

  const itemIdByName = new Map()

  for (const item of NEW_ITEMS) {
    const itemId = randomId()
    itemIdByName.set(item.name, itemId)
    const fields = { name: item.name, lead: [], sectionId, createdAt: now }
    if (item.kind) fields.kind = item.kind
    writes.push(createWrite('customSectionItems', itemId, fields))
    console.log(`Will create customSectionItems/${itemId} "${item.name}"${item.kind ? ` (kind: ${item.kind})` : ''}`)

    if (item.kind === 'documents') {
      const groupId = randomId()
      writes.push(
        createWrite('trackerDocumentGroups', groupId, {
          name: 'Links',
          programId: itemId,
          order: 1,
          createdAt: now,
        })
      )
      console.log(`Will create trackerDocumentGroups/${groupId} "Links" (programId: ${itemId})`)
    }
  }

  console.log('')
  const orderByTarget = new Map()
  const reassignedProjectIds = new Set()
  for (const p of linkedProjects) {
    const targetName = PROJECT_TARGET[p.fields.name]
    const targetId = targetName && itemIdByName.get(targetName)
    if (!targetId) {
      console.log(`WARNING: no target mapped for project "${p.fields.name}" — leaving it on the old program.`)
      continue
    }
    const nextOrder = (orderByTarget.get(targetId) || 0) + 1
    orderByTarget.set(targetId, nextOrder)
    writes.push(patchWrite('projects', p.id, { programId: targetId, order: nextOrder }))
    console.log(`Will move project "${p.fields.name}" -> ${targetName} (customSectionItems/${targetId}, order ${nextOrder})`)
    reassignedProjectIds.add(p.id)

    for (const t of linkedTasks.filter((task) => task.fields.projectId === p.id)) {
      writes.push(patchWrite('tasks', t.id, { programId: targetId, programName: targetName }))
      console.log(`  Will move task "${t.fields.name}" -> ${targetName}`)
    }
  }
  const unassignedTasks = linkedTasks.filter((t) => !t.fields.projectId || !reassignedProjectIds.has(t.fields.projectId))
  if (unassignedTasks.length) {
    console.log(
      `WARNING: ${unassignedTasks.length} task(s) have no reassigned parent project and were left untouched: ` +
        unassignedTasks.map((t) => t.fields.name).join(', ')
    )
  }

  const unreassignedProjects = linkedProjects.filter((p) => !reassignedProjectIds.has(p.id))
  if (DELETE_OLD) {
    if (unreassignedProjects.length || unassignedTasks.length) {
      console.log(
        `\nRefusing to delete programs/${oldProgram.id}: ${unreassignedProjects.length} project(s) and ` +
          `${unassignedTasks.length} task(s) still unassigned. Fix PROJECT_TARGET or reassign them first.`
      )
    } else {
      writes.push(deleteWrite('programs', oldProgram.id))
      console.log(`Will delete programs/${oldProgram.id} (all projects/tasks reassigned).`)
    }
  } else {
    console.log(`\nLeaving programs/${oldProgram.id} in place (pass --delete-old to remove it once verified).`)
  }

  if (!APPLY) {
    console.log('\nDry run only — re-run with --apply to write these changes.')
    return
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = writes.slice(i, i + 400)
    await commitWrites(accessToken, batch)
    console.log(`Committed ${Math.min(i + 400, writes.length)}/${writes.length}`)
  }
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
