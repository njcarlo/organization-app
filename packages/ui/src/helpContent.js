/**
 * In-app help content for the HAE platform.
 * Sections can limit visibility with `roles` (normalized role ids).
 * Omit `roles` to show to everyone signed in.
 */

export const HELP_SECTIONS = [
  {
    id: 'start',
    title: 'Getting started',
    roles: null,
    body: [
      {
        heading: 'Sign in',
        steps: [
          'Open the app URL you were given (Tracker, LMS, EiR, CRM, or AMS).',
          'Sign in with your HAE email and password.',
          'If you cannot sign in, ask an admin to create your account under Tracker → Admin → Users.',
        ],
      },
      {
        heading: 'Your role',
        steps: [
          'Your role appears under your name in the sidebar (Admin, Staff, Member, or Student).',
          'What you can see and edit depends on that role — use the sections below that match yours.',
        ],
      },
      {
        heading: 'Switching between apps',
        steps: [
          'Use the Platform list in the left sidebar (Tracker, LMS, EiR, CRM, AMS).',
          'If you are already signed in, clicking another app should keep you signed in.',
          'Each app has its own URL — bookmark the ones you use most.',
        ],
      },
    ],
  },
  {
    id: 'roles',
    title: 'Roles at a glance',
    roles: null,
    body: [
      {
        heading: 'What each role can do',
        steps: [
          'Admin — full access: users, import/export, and every app.',
          'Staff — day-to-day HAE team work across Tracker, LMS manage, EiR manage, CRM, and AMS.',
          'Member — alumni: EiR directory/booking, AMS events and own membership.',
          'Student — Academy: LMS My learning, catalog, certificates; can browse EiR.',
        ],
      },
    ],
  },
  {
    id: 'tracker',
    title: 'Operating Tracker',
    roles: ['admin', 'staff'],
    body: [
      {
        heading: 'Dashboard',
        steps: [
          'Shows program health, priorities, and items needing leadership attention.',
          'Use it for a quick weekly scan of what is at risk.',
        ],
      },
      {
        heading: 'My Tasks / All Tasks',
        steps: [
          'My Tasks lists work assigned to your name (Owner field).',
          'Staff can switch to All Tasks to see everyone’s work.',
          'Filter by Active, status, then Edit a row — the form opens in a full panel so fields are readable.',
          'Set Status, Due, Priority (or leave Priority on Auto), Waiting On, Leadership, and Next Action.',
        ],
      },
      {
        heading: 'Programs → Projects → Tasks',
        steps: [
          'Open a program from the sidebar.',
          'Add a Project (name, lead, health, target date).',
          'Expand a project and Add Task for the detailed work items.',
          'Keep Owner names consistent with user directory names so My Tasks works.',
        ],
      },
      {
        heading: 'Admin (admins only)',
        steps: [
          'Users — create login accounts and set roles (admin / staff / member / student).',
          'Programs — add or rename programs.',
          'Add items — create records for LMS, EiR, CRM, and AMS from one place.',
          'Import / Export — download or upload JSON backups of collections.',
        ],
      },
    ],
  },
  {
    id: 'lms',
    title: 'LMS (Academy)',
    roles: ['admin', 'staff', 'student', 'member'],
    body: [
      {
        heading: 'Students — My learning',
        steps: [
          'Your enrollments, upcoming office hours, check-ins, and certificates appear on the home page.',
          'Enrollments must use your login email as learner email — otherwise you will not see them.',
          'Catalog shows open courses; My certificates lists issued certificates for your email.',
        ],
        roles: ['student', 'admin', 'staff'],
      },
      {
        heading: 'Staff — manage learning',
        steps: [
          'Manage courses — create a course (path, facilitator, status).',
          'Open a course to add modules (lessons, quizzes, office hours, etc.).',
          'Enrollments — add learners with name + login email + course.',
          'Office Hours / Check-ins / Issue certificates — schedule sessions and track milestones.',
          'Tip: put the learner’s login email on check-ins too so students can see them.',
        ],
        roles: ['admin', 'staff'],
      },
    ],
  },
  {
    id: 'eir',
    title: 'EiR (Experts)',
    roles: ['admin', 'staff', 'member', 'student'],
    body: [
      {
        heading: 'Browse and book',
        steps: [
          'Directory lists Active experts with expertise tags.',
          'Open an expert for bio, LinkedIn, and booking link (if provided).',
          'How it works explains the Expert Office Hours model.',
        ],
      },
      {
        heading: 'Staff — manage experts',
        steps: [
          'Manage experts — add or edit profiles (name, title, expertise, booking URL, status).',
          'Set status to Inactive or On Leave to hide from the public directory.',
        ],
        roles: ['admin', 'staff'],
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM (Relationships)',
    roles: ['admin', 'staff'],
    body: [
      {
        heading: 'Contacts & pipeline',
        steps: [
          'Contacts — add alumni, donors, partners, or prospects with region, tags, and stage.',
          'Interactions — log emails, calls, meetings, and notes linked to a contact.',
          'Pipeline — move contacts between Prospect → Engaged → Committed → Closed.',
        ],
      },
    ],
  },
  {
    id: 'ams',
    title: 'AMS (Membership)',
    roles: ['admin', 'staff', 'member'],
    body: [
      {
        heading: 'Members (alumni view)',
        steps: [
          'My membership shows your membership records (matched by your login email).',
          'Events lists upcoming HAE events you can attend.',
        ],
        roles: ['member', 'admin', 'staff'],
      },
      {
        heading: 'Staff — manage membership',
        steps: [
          'Members — directory of people (include email = login email for member view).',
          'Memberships — tier, renewal, payment status (stores memberEmail automatically).',
          'Events — create events with date, location, capacity.',
          'Committees — assign members to committee roles.',
        ],
        roles: ['admin', 'staff'],
      },
    ],
  },
  {
    id: 'tips',
    title: 'Tips & troubleshooting',
    roles: null,
    body: [
      {
        heading: 'Common fixes',
        steps: [
          'I do not see my LMS data — ask staff to set learner email to your exact login email.',
          'I do not see my AMS membership — memberships need memberEmail matching your login.',
          'Wrong app access — ask an admin to change your role under Tracker → Admin → Users.',
          'Page looks unstyled or huge logo — hard-refresh (Ctrl/Cmd+Shift+R); you may be on a cached build.',
          'Signed out after switching apps — sign in once on that app; later switches should stay signed in.',
        ],
      },
      {
        heading: 'Good habits',
        steps: [
          'Use consistent Owner / learner / member names and emails.',
          'Prefer Add items (Admin) or each app’s manage pages — avoid duplicate records.',
          'Export JSON from Admin before large imports.',
        ],
        roles: ['admin', 'staff'],
      },
    ],
  },
]

export function sectionsForRole(role) {
  const r = (role || 'member').toLowerCase()
  return HELP_SECTIONS.filter((section) => {
    if (!section.roles || section.roles.length === 0) return true
    return section.roles.includes(r)
  }).map((section) => ({
    ...section,
    body: (section.body || []).filter((block) => {
      if (!block.roles || block.roles.length === 0) return true
      return block.roles.includes(r)
    }),
  }))
}
