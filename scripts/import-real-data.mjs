#!/usr/bin/env node
/**
 * Upsert real production programs/projects/tasks/users into Firestore,
 * preserving document IDs from scripts/real-data-import.json.
 *
 * Auth: FIREBASE_TOKEN (Firebase CLI refresh token) or GOOGLE_ACCESS_TOKEN.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PROJECT = process.env.FIREBASE_PROJECT || 'hae-operating-tracker'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(
  readFileSync(join(__dirname, 'real-data-import.json'), 'utf8')
)

async function getAccessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN

  // Prefer firebase-tools token refresh (no secrets in this repo).
  const refresh = process.env.FIREBASE_TOKEN
  if (!refresh) {
    throw new Error(
      'Set FIREBASE_TOKEN (firebase login:ci) or GOOGLE_ACCESS_TOKEN'
    )
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

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFirestoreValue) } }
  }
  if (typeof v === 'object') {
    const fields = {}
    for (const [k, val] of Object.entries(v)) {
      fields[k] = toFirestoreValue(val)
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function docToFields(doc) {
  const fields = {}
  for (const [k, v] of Object.entries(doc)) {
    if (k === '_id') continue
    fields[k] = toFirestoreValue(v)
  }
  return fields
}

async function commitWrites(accessToken, writes) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Commit failed: ${JSON.stringify(json)}`)
  }
  return json
}

async function listCollection(accessToken, collection) {
  const docs = []
  let pageToken = ''
  do {
    const q = new URLSearchParams({ pageSize: '300' })
    if (pageToken) q.set('pageToken', pageToken)
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}?${q}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(`List ${collection} failed: ${JSON.stringify(json)}`)
    }
    for (const d of json.documents || []) {
      const id = d.name.split('/').pop()
      docs.push({ id, name: d.name })
    }
    pageToken = json.nextPageToken || ''
  } while (pageToken)
  return docs
}

function upsertWrite(collection, id, fields) {
  return {
    update: {
      name: `projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`,
      fields,
    },
  }
}

function deleteWrite(name) {
  return { delete: name }
}

async function main() {
  const accessToken = await getAccessToken()
  console.log('Authenticated. Importing…')

  const keep = {
    programs: new Set(data.programs.map((d) => d._id)),
    projects: new Set(data.projects.map((d) => d._id)),
    tasks: new Set(data.tasks.map((d) => d._id)),
    users: new Set(data.users.map((d) => d._id)),
  }

  const upserts = []
  for (const [collection, rows] of Object.entries(data)) {
    for (const row of rows) {
      upserts.push(upsertWrite(collection, row._id, docToFields(row)))
    }
  }

  // Commit upserts in batches of 400
  for (let i = 0; i < upserts.length; i += 400) {
    const batch = upserts.slice(i, i + 400)
    await commitWrites(accessToken, batch)
    console.log(`Upserted ${Math.min(i + 400, upserts.length)}/${upserts.length}`)
  }

  // Clean conflicting seed docs in programs/projects/tasks (not users)
  for (const collection of ['programs', 'projects', 'tasks']) {
    const existing = await listCollection(accessToken, collection)
    const toDelete = existing.filter((d) => !keep[collection].has(d.id))
    if (toDelete.length === 0) {
      console.log(`${collection}: no extras to delete (${existing.length} kept)`)
      continue
    }
    for (let i = 0; i < toDelete.length; i += 400) {
      const batch = toDelete.slice(i, i + 400).map((d) => deleteWrite(d.name))
      await commitWrites(accessToken, batch)
    }
    console.log(
      `${collection}: deleted ${toDelete.length} extras, kept ${keep[collection].size}`
    )
  }

  // Users: upsert only; do not delete other profiles
  const users = await listCollection(accessToken, 'users')
  console.log(
    `users: upserted ${data.users.length}; total profiles now ${users.length}`
  )
  console.log('Import complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
