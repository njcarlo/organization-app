#!/usr/bin/env node
/**
 * One-time backfill: the first run of add-swc-final-countdown-punch-list.mjs
 * created the "Final Countdown Punch List" subcategory's tasks without a
 * numeric `order` field. Since every task in a given day-project shares the
 * same `dueDate`, CategoryProgramPage.jsx's dueDate sort leaves same-day
 * tasks in Firestore's arbitrary fetch order instead of the PDF sequence.
 * This script matches each already-created task by (project name, task
 * text) against the source list below and patches in the correct `order`
 * (0-based, per day) so TaskTable.jsx's sortByOrder renders them in PDF order.
 *
 * Auth: FIREBASE_TOKEN (Firebase CLI refresh token, via `firebase login:ci`)
 * or GOOGLE_ACCESS_TOKEN. Dry-run by default; pass --apply to actually write.
 */
const PROJECT = process.env.FIREBASE_PROJECT || 'hae-operating-tracker'
const APPLY = process.argv.includes('--apply')

const SECTION_LABEL = 'Startup World Cup 2026'
const ITEM_NAME = 'Final Countdown Punch List'

const DAYS = [
  {
    date: '2026-09-14',
    name: 'Mon, Sept 14 — Launch + Confirm',
    tasks: [
      'Nudge all finalists for final pitch decks; communicate hard deck-lock deadline.',
      'Ask every founder to send HAE their investor / investor-prospect list, highlighting priority investors they want invited.',
      'Confirm missing finalist assets: intro recording/material, logo, photo, bio, title and company information.',
      'Send all 13 founders ready-to-post social media copy/assets; ask them to post this week.',
      'Build consolidated investor list and begin final investor invitation push.',
      'Post SWC on Luma.',
      'Finalize and distribute FUNDEX offer.',
      'Prepare WHOOP post featuring John and Emily Capodilupo.',
      'Launch/promote Virtual Admission — livestream ticket as a distinct attendance option.',
      'Finalize and distribute discount and comp promo codes; define audience, offer, expiration and usage limits.',
      'Send student discount code to i-Lab, Rock Center and other Harvard student entrepreneurship channels.',
      'Create Promo Code Tracker: code / audience / offer / distributed by / date / uses / limit / expiration.',
      'Reach out to Harvard communications offices inviting them to attend and/or cover SWC.',
      'Finalize digital program content, including finalist/judge/sponsor information, schedule, QR codes and links.',
      'Start final banners/signage preparation.',
      'Confirm with Jenna green light for 20th Anniversary sizzle and delivery of required slides/assets; set hard deadlines.',
      'Confirm all sponsors: commitment, payment/in-kind status, correct logo/name, deliverables, stage/program/signage recognition and guest attendance.',
      'Confirm VIP Reception attendance and Sept. 24 event attendance separately; track VIP / SWC / BOTH.',
      'Confirm HMS/Martin Conference Center logistics: load-in, access, AV, stage, registration, catering/bar, security, parking, Wi-Fi, signage, finalist/judge/VIP spaces and breakdown.',
      'Set HMS physical walk-through for Sept. 16 or 17.',
      'Confirm purchase/order and delivery of SWC hats.',
      'Confirm rental of mobile credit-card device; fees, delivery/pickup, connectivity, $10/$15 pricing and operator.',
      'Confirm HMS alcohol-service requirements and bartender/server responsibilities.',
      'Confirm final volunteer list and identify staffing gaps.',
      'Begin assigning volunteers by role and shift.',
      'Schedule volunteer onboarding/briefing.',
      'Set up Zoom for livestream; identify technical owner, host/co-host and backup host.',
      'Assign Evan to monitor ticket/livestream email accounts for last-minute sales, confirmations, codes and access issues.',
      'Confirm photographer shot requirements and start final shot list.',
      'Start printing name tags in batches.',
      'Confirm name-tag supplies: badges/holders, lanyards/clips, printer/toner, blanks, Sharpies and alphabetized trays.',
      'Confirm guest flow plan.',
      'Confirm photo booth, setup, location, branding, props, attendant, social sharing and breakdown.',
    ],
  },
  {
    date: '2026-09-15',
    name: 'Tue, Sept 15 — Build the Show',
    tasks: [
      'Create Master Run of Show V1, minute by minute.',
      'Lock pitch length, transition timing, Q&A and hard-stop rules.',
      'Assign show caller/stage manager, AV lead, finalist wrangler, judge/scoring lead, front-of-house lead, sponsor/VIP lead, media lead and volunteer lead.',
      'Create master production asset list: decks, show slides, sizzle, videos, music, logos, timer, awards and holding slides.',
      'Confirm detailed AV specifications with HMS.',
      'Launch FUNDEX, WHOOP and founder social promotion.',
      'Continue investor outreach and direct follow-up.',
      'Push both in-person and Virtual Admission through HAE channels.',
      'Complete volunteer role matrix and onboarding materials.',
      'Test Zoom configuration internally and confirm virtual-ticket link delivery process.',
      'Confirm Evan has access to the email accounts and ticket systems he needs.',
      'Continue name-tag printing.',
      'Draft physical room/guest-flow diagram for HMS walk-through.',
      'Finalize photographer shot-list draft and photo-booth requirements.',
      'Chase any missing sponsor confirmations/logos/guest lists.',
    ],
  },
  {
    date: '2026-09-16',
    name: 'Wed, Sept 16 — Finalists + Judges + Venue',
    tasks: [
      'Review finalist decks as they arrive; immediately return readability, timing or technical fixes.',
      'Prepare one-page Finalist Instructions: arrival, pitch time, tech, dress, stage process, holding area, contacts and deadlines.',
      'Build Judge Packet and scoring instructions.',
      'Test judge scoring system and prepare paper backup.',
      'Confirm all judges individually and obtain mobile numbers.',
      'Conduct HMS walk-through today if possible.',
      'Map entrance, registration, name-tag pickup, banners, photo booth, stage, finalist holding, judges, VIP seating, general seating, bar/reception, photographer positions and exits.',
      'Confirm livestream internet path and backup connectivity.',
      'Confirm photographer/video/livestream coverage.',
      'Confirm VIP Reception photography requirements.',
      'Continue VIP and event RSVP reconciliation.',
      'Review promo-code distribution and resolve any access/usage issues.',
    ],
  },
  {
    date: '2026-09-17',
    name: 'Thu, Sept 17 — One Week to Go',
    tasks: [
      'Launch ONE WEEK TO GO campaign.',
      'Do major investor invitation/follow-up push.',
      'Amplify finalist social posts.',
      'Push WHOOP, FUNDEX and Virtual Admission.',
      'Send Board/Advancement Committee personal ticket-sales ask.',
      'Push HAE members, Accelerator alumni, mentors and ecosystem.',
      'Repeat student promotion.',
      'Draft Regina opening/welcome and closing.',
      'Draft emcee transitions and speaker/judge/finalist introductions.',
      'Finalize WHOOP fireside introduction/briefing.',
      'Lock sponsor acknowledgments and recognition.',
      'Determine judge-deliberation content and backup filler.',
      'Complete sponsor deliverables reconciliation.',
      'Close volunteer staffing gaps.',
      'Send volunteer onboarding/briefing materials.',
      'Complete HMS walk-through today if not completed Wednesday.',
    ],
  },
  {
    date: '2026-09-18',
    name: 'Fri, Sept 18 — Content Lock',
    tasks: [
      'Receive all 13 final decks — HARD DEADLINE.',
      'Complete final deck review; no substantive redesign after lock unless essential.',
      'Create production-ready versions and PDF backups.',
      'Build master presentation sequence.',
      'Back up all decks/show files to production computer, backup computer, cloud and USB.',
      'Check fonts, animations, videos, aspect ratios and transitions.',
      'Finalize and proof digital program.',
      'Send banners/signage to production if not already ordered.',
      "Review final/near-final sizzle and Jenna's show slides.",
      'Complete main name-tag print batch; maintain late-add list.',
      'Confirm hats, photo booth/props, payment device and physical supplies are on track.',
      'Finalize photographer shot list.',
      'Review investor RSVPs and in-person/virtual ticket sales.',
      'Review discount/comp promo-code usage and identify groups that received codes but have not converted.',
    ],
  },
  {
    date: '2026-09-19',
    name: 'Sat, Sept 19 — QA',
    tasks: [
      'Proof every founder/company/judge/speaker/sponsor name and title.',
      'Verify pronunciation guide.',
      'Test every QR code, ticket link, investor-interest link and livestream link.',
      'Check sponsor/logo usage across program, slides and signage.',
      'Verify hats, badges, photo booth, props and other physical materials are on schedule.',
      'Confirm no outdated sponsor information remains anywhere.',
    ],
  },
  {
    date: '2026-09-20',
    name: 'Sun, Sept 20 — Prep Final Sprint',
    tasks: [
      'Calculate exact remaining in-person ticket target.',
      'Calculate exact remaining virtual ticket target.',
      'Review paid vs. comped attendance separately.',
      "Segment Monday outreach: investors, members, founders' networks, students, mentors, alumni and virtual audience.",
      'Prepare FINAL COUNTDOWN / 3 DAYS campaign.',
      'Assemble Production Bible: ROS, contacts, scripts, finalist order, judge process, venue/flow plan, AV/livestream plan, volunteers, sponsor matrix and contingency sheet.',
    ],
  },
  {
    date: '2026-09-21',
    name: 'Mon, Sept 21 — Tabletop + Final Sales Push',
    tasks: [
      'Conduct full show tabletop: load-in → arrivals → 5:00 start → WHOOP → pitches → transitions → judging → awards → reception → close.',
      'For every transition confirm WHO / WHAT / WHERE / MIC / SCREEN / CUE / DURATION / BACKUP.',
      'Stress-test late founder/speaker, failed deck, livestream issue, judge absence, scoring delay and extended deliberation.',
      'Revise Master Run of Show to V2.',
      'Conduct volunteer onboarding/briefing or final lead briefing.',
      'Review guest flow, registration/name tags, VIP flow, late registrants and escalation.',
      'Confirm all volunteer arrival times support full readiness by 4:30 PM.',
      'Launch 3 DAYS TO GO campaign.',
      'Do direct investor follow-up.',
      'Do final founder social amplification.',
      'Push Virtual Admission aggressively to those who cannot attend in Boston.',
      'Reconcile VIP Reception and SWC RSVPs; chase priority non-responses.',
      'Review underused discount/comp codes and decide whether to extend, close or push them.',
      'Confirm hats have arrived or are trackable.',
      'Confirm payment device test plan.',
      'Reconfirm photo booth setup/props and photographer.',
    ],
  },
  {
    date: '2026-09-22',
    name: 'Tue, Sept 22 — Show Lock',
    tasks: [
      'Distribute final Run of Show.',
      'Lock master deck, sizzle, scripts, digital program, finalist instructions, judge packet, photo shot list, sponsor recognition and volunteer assignments.',
      'Back up all production files twice.',
      'Confirm every speaker, judge and finalist by text/mobile.',
      'Run full Zoom/livestream test with HMS AV: audio, camera, screen/deck sharing, recording, host/co-host and backup.',
      'Confirm virtual-ticket link distribution and resend process.',
      "Confirm Evan's Sept. 23-24 email-monitoring schedule.",
      'Finalize attendee/check-in process and VIP list.',
      'Finalize signage/flow inventory.',
      'Test mobile credit-card device with a small live transaction and refund.',
      'Verify $10/$15 drink pricing and on-site connectivity.',
      'Final HMS technical/logistics confirmation.',
      'Launch 48 HOURS campaign.',
      'Lock routine complimentary admissions; establish approval for late comp requests.',
    ],
  },
  {
    date: '2026-09-23',
    name: 'Wed, Sept 23 — Physical Readiness + VIP',
    tasks: [
      'Complete equipment/material inventory.',
      'Print final late-add name tags and prepare blank badges for walk-ins.',
      'Alphabetize/organize registration materials.',
      'Print judge backups, ROS, scripts, finalist list, VIP list, sponsor matrix and staff assignments.',
      'Verify banners/signage, hats, awards, photo booth/props, computers, clickers, adapters, chargers and USBs.',
      'Final AV/HMS confirmation.',
      'Send separate Tomorrow emails to in-person attendees, virtual attendees and VIPs.',
      'Evan begins intensive monitoring of ticket/livestream email accounts.',
      'Keep in-person and virtual attendee lists current.',
      'Final VIP Reception RSVP reconciliation.',
      'Execute VIP Reception mini Run of Show and photography requirements.',
    ],
  },
  {
    date: '2026-09-24',
    name: 'Thu, Sept 24 — Show Day',
    tasks: [
      'Load in production, signage, registration/name tags, photo booth, stage, AV, master deck, mics, lighting, timer, recording/livestream and bar/payment.',
      'Test livestream end-to-end.',
      'Test mobile credit-card device on site.',
      '3:00-4:00: finalist stage/tech checks, speaker mic checks and judge scoring test.',
      'Brief photographer/video team and reconfirm hero shots, sponsor/VIP shots and all-finalist photo.',
      'Confirm photo booth operational and social-sharing process.',
      '4:00: full production/team briefing; confirm emergency contacts and decision authority.',
      'Evan actively monitors last-minute in-person/virtual ticket purchases and access issues.',
      '4:15: SHOW/ROOM LOCKED - all operational elements complete.',
      '4:30: everyone in position for arrivals/check-in.',
      '5:00 PM SHARP: GO.',
      'Before announcing winner, scoring lead verifies final results.',
      'Post-show: reconcile bar/payment sales.',
      'Secure decks, scoring records, photo/video files and investor-interest data.',
      'Capture sponsor/VIP follow-up notes for next business day.',
    ],
  },
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

function patchWrite(collection, id, patch) {
  const fields = {}
  for (const [k, v] of Object.entries(patch)) fields[k] = toFirestoreValue(v)
  return {
    update: { name: docPath(collection, id), fields },
    updateMask: { fieldPaths: Object.keys(patch) },
  }
}

async function main() {
  const accessToken = await getAccessToken()
  console.log(`Authenticated. Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN'}`)

  const [sections, items] = await Promise.all([
    listCollectionFull(accessToken, 'customSections'),
    listCollectionFull(accessToken, 'customSectionItems'),
  ])

  const section = sections.find((s) => s.fields.label === SECTION_LABEL)
  if (!section) throw new Error(`No customSections doc found with label "${SECTION_LABEL}".`)

  const item = items.find((i) => i.fields.sectionId === section.id && i.fields.name === ITEM_NAME)
  if (!item) throw new Error(`No customSectionItems doc found named "${ITEM_NAME}" under "${SECTION_LABEL}".`)
  console.log(`Found customSectionItems/${item.id} "${ITEM_NAME}".`)

  const [projects, tasks] = await Promise.all([
    listCollectionFull(accessToken, 'projects'),
    listCollectionFull(accessToken, 'tasks'),
  ])
  const dayProjects = projects.filter((p) => p.fields.programId === item.id)
  const dayTasks = tasks.filter((t) => t.fields.programId === item.id)
  console.log(`Found ${dayProjects.length} day-project(s) and ${dayTasks.length} task(s) under this subcategory.\n`)

  const writes = []
  let matched = 0
  const unmatchedTasks = []

  for (const day of DAYS) {
    const project = dayProjects.find((p) => p.fields.name === day.name)
    if (!project) {
      console.log(`WARNING: no project found named "${day.name}" — skipping its ${day.tasks.length} task(s).`)
      continue
    }
    const tasksInProject = dayTasks.filter((t) => t.fields.projectId === project.id)
    const usedTaskIds = new Set()

    day.tasks.forEach((taskName, taskIndex) => {
      const task = tasksInProject.find((t) => t.fields.name === taskName && !usedTaskIds.has(t.id))
      if (!task) {
        unmatchedTasks.push(`${day.name} / "${taskName}"`)
        return
      }
      usedTaskIds.add(task.id)
      if (task.fields.order === taskIndex) return // already correct
      writes.push(patchWrite('tasks', task.id, { order: taskIndex }))
      matched += 1
    })

    const extras = tasksInProject.filter((t) => !usedTaskIds.has(t.id))
    if (extras.length) {
      console.log(
        `WARNING: ${extras.length} extra task(s) under "${day.name}" didn't match any PDF line (possible duplicates from a partial earlier run): ` +
          extras.map((t) => `"${t.fields.name}"`).join(', ')
      )
    }
  }

  if (unmatchedTasks.length) {
    console.log(`\nWARNING: ${unmatchedTasks.length} PDF line(s) had no matching task doc:`)
    for (const u of unmatchedTasks) console.log(`  - ${u}`)
  }

  console.log(`\nWill patch \`order\` on ${matched} task(s).`)

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
