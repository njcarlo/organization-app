#!/usr/bin/env node
/**
 * One-time backfill: sync each task's denormalized programId/programName/
 * projectName to match its live parent project + program/category, for
 * tasks left stale by project moves/renames that predate the cascade fix
 * in MoveCopyProjectModal.jsx / ProjectCard.jsx.
 *
 * Auth: FIREBASE_TOKEN (Firebase CLI refresh token) or GOOGLE_ACCESS_TOKEN.
 * Dry-run by default; pass --apply to actually write changes.
 */
const PROJECT = process.env.FIREBASE_PROJECT || 'hae-operating-tracker'
const APPLY = process.argv.includes('--apply')

// Mirrors PROJECT_DESTINATION_GROUPS / PROGRAM_PATH_PREFIX_BY_COLLECTION in
// apps/operating-tracker/src/constants.js.
const PROGRAM_COLLECTIONS = [
  'programs',
  'academyPrograms',
  'customPrograms',
  'trackerGraphics',
  'trackerData',
  'boardCommitments',
  'chapters',
]

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

function patchWrite(docName, patch) {
  const fields = {}
  for (const [k, v] of Object.entries(patch)) fields[k] = toFirestoreValue(v)
  return {
    update: { name: docName, fields },
    updateMask: { fieldPaths: Object.keys(patch) },
  }
}

async function main() {
  const accessToken = await getAccessToken()
  console.log(`Authenticated. Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN'}`)

  const projects = await listCollectionFull(accessToken, 'projects')
  const projectsById = new Map(projects.map((p) => [p.id, p.fields]))

  const programsById = new Map()
  for (const collection of PROGRAM_COLLECTIONS) {
    const docs = await listCollectionFull(accessToken, collection)
    for (const d of docs) programsById.set(d.id, d.fields)
  }
  const customSectionItems = await listCollectionFull(accessToken, 'customSectionItems')
  for (const d of customSectionItems) programsById.set(d.id, d.fields)

  const tasks = await listCollectionFull(accessToken, 'tasks')
  console.log(
    `Loaded ${projects.length} projects, ${programsById.size} program/category docs, ${tasks.length} tasks.`
  )

  const writes = []
  let orphaned = 0
  let unchanged = 0

  for (const task of tasks) {
    const project = task.fields.projectId ? projectsById.get(task.fields.projectId) : null
    if (!project) {
      orphaned += 1
      continue
    }

    const expected = {
      projectName: project.name || '',
      programId: project.programId || '',
      programName: project.programId ? programsById.get(project.programId)?.name || '' : '',
    }

    const patch = {}
    for (const [key, value] of Object.entries(expected)) {
      if ((task.fields[key] || '') !== value && value) {
        patch[key] = value
      }
    }

    if (Object.keys(patch).length === 0) {
      unchanged += 1
      continue
    }

    console.log(
      `[${APPLY ? 'FIX' : 'WOULD FIX'}] task ${task.id} "${task.fields.name || ''}": ` +
        Object.entries(patch)
          .map(([k, v]) => `${k}: ${JSON.stringify(task.fields[k] ?? null)} -> ${JSON.stringify(v)}`)
          .join(', ')
    )
    writes.push(patchWrite(task.name, patch))
  }

  console.log(
    `\n${writes.length} tasks need fixing, ${unchanged} already correct, ${orphaned} orphaned (no matching project, skipped).`
  )

  if (!APPLY) {
    console.log('Dry run only — re-run with --apply to write these changes.')
    return
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = writes.slice(i, i + 400)
    await commitWrites(accessToken, batch)
    console.log(`Committed ${Math.min(i + 400, writes.length)}/${writes.length}`)
  }
  console.log('Backfill complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
