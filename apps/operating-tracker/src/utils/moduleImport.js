/**
 * Per-module import specs: required columns, examples, and row → Firestore mapping.
 * Admins can upload CSV/JSON or paste a table; AI agents can follow the same format.
 */

export const MODULE_IMPORT_SPECS = {
  surveys: {
    id: 'surveys',
    label: 'Surveys',
    collection: 'surveys',
    description: 'Create survey shells (title, status, description). Add questions in the editor after import, or include a questions_json column.',
    required: ['title'],
    optional: ['status', 'description', 'questions_json', '_id'],
    defaults: { status: 'Draft' },
    exampleCsv: `title,status,description,questions_json
Post-event feedback,Open,Tell us how the event went,"[{""id"":""q1"",""prompt"":""Overall rating"",""type"":""rating"",""required"":true,""order"":1}]"
Membership pulse,Draft,Quick check-in,`,
    exampleJson: [
      {
        title: 'Post-event feedback',
        status: 'Open',
        description: 'Tell us how the event went',
        questions: [
          {
            id: 'q1',
            prompt: 'Overall rating',
            type: 'rating',
            required: true,
            order: 1,
          },
        ],
      },
    ],
    mapRow(row) {
      const title = String(row.title || '').trim()
      if (!title) return null
      let questions = []
      if (row.questions_json) {
        try {
          questions = JSON.parse(String(row.questions_json))
        } catch {
          throw new Error(`Invalid questions_json for survey "${title}"`)
        }
      } else if (Array.isArray(row.questions)) {
        questions = row.questions
      }
      const status = ['Draft', 'Open', 'Closed'].includes(row.status)
        ? row.status
        : 'Draft'
      return {
        _id: row._id || row.id || undefined,
        title,
        description: String(row.description || '').trim(),
        status,
        questions,
        inviteSubject: `HAE survey: ${title}`,
        updatedAt: new Date().toISOString(),
      }
    },
  },

  contacts: {
    id: 'contacts',
    label: 'CRM contacts',
    collection: 'contacts',
    description: 'Alumni, donors, partners, prospects.',
    required: ['name'],
    optional: ['email', 'type', 'region', 'stage', 'tags', 'notes', 'followUpDate', '_id'],
    defaults: { type: 'alumni', region: 'North America', stage: 'prospect' },
    exampleCsv: `name,email,type,region,stage,tags,notes,followUpDate
Jamie Lee,jamie@example.com,alumni,North America,engaged,"SWC,mentor",Met at mixer,2026-08-01`,
    exampleJson: [
      {
        name: 'Jamie Lee',
        email: 'jamie@example.com',
        type: 'alumni',
        region: 'North America',
        stage: 'engaged',
        tags: ['SWC', 'mentor'],
        notes: 'Met at mixer',
        followUpDate: '2026-08-01',
      },
    ],
    mapRow(row) {
      const name = String(row.name || '').trim()
      if (!name) return null
      const tags = Array.isArray(row.tags)
        ? row.tags
        : String(row.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
      return {
        _id: row._id || row.id || undefined,
        name,
        email: String(row.email || '').trim().toLowerCase(),
        type: row.type || 'alumni',
        region: row.region || 'North America',
        stage: row.stage || 'prospect',
        tags,
        notes: String(row.notes || '').trim(),
        followUpDate: row.followUpDate || '',
      }
    },
  },

  members: {
    id: 'members',
    label: 'AMS members',
    collection: 'members',
    description: 'Membership directory. Use login email so members see their own records.',
    required: ['name'],
    optional: ['email', 'cohort', 'chapter', 'status', 'joinDate', '_id'],
    defaults: { status: 'active' },
    exampleCsv: `name,email,cohort,chapter,status,joinDate
Alex Kim,alex@harvardae.org,2024,Boston,active,2024-09-01`,
    exampleJson: [
      {
        name: 'Alex Kim',
        email: 'alex@harvardae.org',
        cohort: '2024',
        chapter: 'Boston',
        status: 'active',
        joinDate: '2024-09-01',
      },
    ],
    mapRow(row) {
      const name = String(row.name || '').trim()
      if (!name) return null
      return {
        _id: row._id || row.id || undefined,
        name,
        email: String(row.email || '').trim().toLowerCase(),
        cohort: String(row.cohort || '').trim(),
        chapter: String(row.chapter || '').trim(),
        status: row.status || 'active',
        joinDate: row.joinDate || '',
      }
    },
  },

  experts: {
    id: 'experts',
    label: 'EiR experts',
    collection: 'experts',
    description: 'Expert Office Hours directory profiles.',
    required: ['name'],
    optional: [
      'title',
      'organization',
      'email',
      'bio',
      'expertise',
      'linkedinUrl',
      'bookingUrl',
      'photoUrl',
      'status',
      '_id',
    ],
    defaults: { status: 'Active' },
    exampleCsv: `name,title,organization,email,expertise,status,bookingUrl
Sam Rivera,Partner,Example Ventures,sam@example.com,"Fundraising, B2B SaaS",Active,https://calendly.com/example`,
    exampleJson: [
      {
        name: 'Sam Rivera',
        title: 'Partner',
        organization: 'Example Ventures',
        email: 'sam@example.com',
        expertise: ['Fundraising', 'B2B SaaS'],
        status: 'Active',
        bookingUrl: 'https://calendly.com/example',
      },
    ],
    mapRow(row) {
      const name = String(row.name || '').trim()
      if (!name) return null
      const expertise = Array.isArray(row.expertise)
        ? row.expertise
        : String(row.expertise || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
      return {
        _id: row._id || row.id || undefined,
        name,
        title: String(row.title || '').trim(),
        organization: String(row.organization || '').trim(),
        email: String(row.email || '').trim().toLowerCase(),
        bio: String(row.bio || '').trim(),
        expertise,
        linkedinUrl: String(row.linkedinUrl || '').trim(),
        bookingUrl: String(row.bookingUrl || '').trim(),
        photoUrl: String(row.photoUrl || '').trim(),
        status: row.status || 'Active',
      }
    },
  },

  courses: {
    id: 'courses',
    label: 'LMS courses',
    collection: 'courses',
    description: 'Academy courses. path is academy or flagship.',
    required: ['name'],
    optional: ['path', 'facilitator', 'description', 'durationWeeks', 'status', '_id'],
    defaults: { path: 'academy', status: 'Draft' },
    exampleCsv: `name,path,facilitator,description,durationWeeks,status
Fast Track GTM,academy,Jamie Chen,Go-to-market basics,6,Open`,
    exampleJson: [
      {
        name: 'Fast Track GTM',
        path: 'academy',
        facilitator: 'Jamie Chen',
        description: 'Go-to-market basics',
        durationWeeks: 6,
        status: 'Open',
      },
    ],
    mapRow(row) {
      const name = String(row.name || '').trim()
      if (!name) return null
      return {
        _id: row._id || row.id || undefined,
        name,
        path: row.path || 'academy',
        facilitator: String(row.facilitator || '').trim(),
        description: String(row.description || '').trim(),
        durationWeeks: row.durationWeeks ? Number(row.durationWeeks) : null,
        status: row.status || 'Draft',
      }
    },
  },

  enrollments: {
    id: 'enrollments',
    label: 'LMS enrollments',
    collection: 'enrollments',
    description:
      'Learner enrollments. learnerEmail must match the student’s login email. Include courseName (or courseId if known).',
    required: ['learnerName', 'learnerEmail', 'courseName'],
    optional: ['courseId', 'path', 'status', 'progress', '_id'],
    defaults: { status: 'Enrolled', progress: 0, path: 'academy' },
    exampleCsv: `learnerName,learnerEmail,courseName,path,status,progress
Taylor Ng,taylor@harvardae.org,Fast Track GTM,academy,Enrolled,0`,
    exampleJson: [
      {
        learnerName: 'Taylor Ng',
        learnerEmail: 'taylor@harvardae.org',
        courseName: 'Fast Track GTM',
        path: 'academy',
        status: 'Enrolled',
        progress: 0,
      },
    ],
    mapRow(row) {
      const learnerName = String(row.learnerName || '').trim()
      const learnerEmail = String(row.learnerEmail || '').trim().toLowerCase()
      const courseName = String(row.courseName || '').trim()
      if (!learnerName || !learnerEmail || !courseName) return null
      return {
        _id: row._id || row.id || undefined,
        learnerName,
        learnerEmail,
        courseName,
        courseId: String(row.courseId || '').trim(),
        path: row.path || 'academy',
        status: row.status || 'Enrolled',
        progress: Number(row.progress) || 0,
      }
    },
  },

  courseRegistrations: {
    id: 'courseRegistrations',
    label: 'Academy course registrations',
    collection: 'courseRegistrations',
    description:
      'Manual enrollee registrations for Academy courses, with amount paid. Tag each row Academy or Academy Flagship via programType.',
    required: ['course', 'firstName', 'lastName'],
    optional: ['programType', 'email', 'amountPaid', '_id'],
    defaults: { amountPaid: 0, programType: 'Academy' },
    exampleCsv: `course,programType,firstName,lastName,email,amountPaid
Fast Track GTM,Academy,Taylor,Ng,taylor@harvardae.org,250
Venture Lab,Academy Flagship,Jordan,Lee,jordan@harvardae.org,500`,
    exampleJson: [
      {
        course: 'Fast Track GTM',
        programType: 'Academy',
        firstName: 'Taylor',
        lastName: 'Ng',
        email: 'taylor@harvardae.org',
        amountPaid: 250,
      },
      {
        course: 'Venture Lab',
        programType: 'Academy Flagship',
        firstName: 'Jordan',
        lastName: 'Lee',
        email: 'jordan@harvardae.org',
        amountPaid: 500,
      },
    ],
    mapRow(row) {
      const course = String(row.course || '').trim()
      const firstName = String(row.firstName || '').trim()
      const lastName = String(row.lastName || '').trim()
      if (!course || !firstName || !lastName) return null
      const programType = String(row.programType || '').trim()
      return {
        _id: row._id || row.id || undefined,
        course,
        programType: programType === 'Academy Flagship' ? 'Academy Flagship' : 'Academy',
        firstName,
        lastName,
        email: String(row.email || '').trim().toLowerCase(),
        amountPaid: Number(row.amountPaid) || 0,
      }
    },
  },

  tasks: {
    id: 'tasks',
    label: 'Tracker tasks',
    collection: 'tasks',
    description:
      'Tasks need programName + projectName (or IDs). Owner should match the person’s directory name for My Tasks.',
    required: ['name', 'programName', 'projectName'],
    optional: [
      'owner',
      'dueDate',
      'status',
      'priority',
      'waitingOn',
      'leadershipAttention',
      'nextAction',
      'programId',
      'projectId',
      '_id',
    ],
    defaults: { status: 'Not Started', leadershipAttention: 'None' },
    exampleCsv: `name,owner,programName,projectName,dueDate,status,priority,waitingOn,leadershipAttention,nextAction
Follow-up judges,Jeffrey,Startup World Cup 2026,Judge Recruitment,2026-07-11,Waiting,HIGH,Responses,Review Needed,Board outreach`,
    exampleJson: [
      {
        name: 'Follow-up judges',
        owner: 'Jeffrey',
        programName: 'Startup World Cup 2026',
        projectName: 'Judge Recruitment',
        dueDate: '2026-07-11',
        status: 'Waiting',
        priority: 'HIGH',
        waitingOn: 'Responses',
        leadershipAttention: 'Review Needed',
        nextAction: 'Board outreach',
      },
    ],
    mapRow(row) {
      const name = String(row.name || '').trim()
      const programName = String(row.programName || '').trim()
      const projectName = String(row.projectName || '').trim()
      if (!name || !programName || !projectName) return null
      return {
        _id: row._id || row.id || undefined,
        name,
        owner: String(row.owner || '').trim(),
        programName,
        projectName,
        programId: String(row.programId || '').trim(),
        projectId: String(row.projectId || '').trim(),
        dueDate: row.dueDate || '',
        status: row.status || 'Not Started',
        priority: row.priority || '',
        waitingOn: String(row.waitingOn || '').trim(),
        leadershipAttention: row.leadershipAttention || 'None',
        nextAction: String(row.nextAction || '').trim(),
      }
    },
  },
}

export const HOW_TO_PROVIDE_DATA = {
  title: 'How to give us a list of data',
  intro:
    'Use one of the formats below. Keep a header row with exact column names. One record per row (CSV) or one object per array item (JSON).',
  rules: [
    'First row / object keys must match the column names shown for that module (case-sensitive).',
    'Required columns must be filled. Optional columns can be blank.',
    'Emails: use the person’s login email when the record must show up in student/member views.',
    'Dates: use YYYY-MM-DD (example: 2026-07-11).',
    'Lists (tags, expertise): comma-separated in CSV, or a JSON array.',
    'Do not mix different modules in one file — one module type per import.',
    'For Cursor / AI help: paste the CSV or JSON in chat and say which module (e.g. “import these as CRM contacts”).',
  ],
  forAi: [
    'Say the module name: surveys | contacts | members | experts | courses | enrollments | courseRegistrations | tasks.',
    'Paste CSV with a header row, or a JSON array of objects.',
    'Mention if rows should update existing records (include _id) or always create new ones.',
  ],
}

/** Minimal CSV parser supporting quotes and commas inside quotes. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let i = 0
  let inQuotes = false
  const src = String(text || '').replace(/^\uFEFF/, '')

  while (i < src.length) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      cell += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      i += 1
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1
      row.push(cell)
      cell = ''
      if (row.some((c) => String(c).trim() !== '')) rows.push(row)
      row = []
      i += 1
      continue
    }
    cell += ch
    i += 1
  }
  row.push(cell)
  if (row.some((c) => String(c).trim() !== '')) rows.push(row)

  if (rows.length < 2) return []
  const headers = rows[0].map((h) => String(h).trim())
  return rows.slice(1).map((cols) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] != null ? String(cols[idx]).trim() : ''
    })
    return obj
  })
}

export function parseImportText(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed
    // { contacts: [...] } or { items: [...] }
    const firstArray = Object.values(parsed).find((v) => Array.isArray(v))
    if (firstArray) return firstArray
    return [parsed]
  }
  return parseCsv(trimmed)
}

export function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadExample(spec, format = 'csv') {
  if (format === 'json') {
    downloadText(
      `${spec.id}-example.json`,
      JSON.stringify(spec.exampleJson, null, 2),
      'application/json'
    )
    return
  }
  downloadText(`${spec.id}-example.csv`, spec.exampleCsv, 'text/csv')
}
