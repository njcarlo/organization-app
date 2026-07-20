export const DEFAULT_PROGRAMS = [
  { name: 'Startup World Cup 2026', lead: '', order: 0 },
  { name: 'Strategic Advisory Network', lead: '', order: 1 },
  { name: 'Membership & Community', lead: '', order: 2 },
  { name: 'Sponsorship & Partnerships', lead: '', order: 3 },
  { name: 'Chapters', lead: '', order: 4 },
  { name: 'Operations & Technology', lead: '', order: 5 },
  { name: '1636 Partners', lead: '', order: 6 },
  { name: 'A Foundery', lead: '', order: 7 },
  { name: 'EiR', lead: '', order: 8 },
  { name: 'Investor Network', lead: '', order: 9 },
  { name: 'Accelerator', lead: '', order: 10 },
]

export const TASK_STATUSES = [
  'Not Started',
  'Ongoing',
  'Needs Attention',
  'Time Sensitive',
  'Complete',
]

/** Legacy task status values kept for backward-compat with existing data. */
export const TASK_STATUS_ALIASES = {
  'In Progress': 'Ongoing',
  Waiting: 'Needs Attention',
  Review: 'Needs Attention',
}

export const PRIORITIES = ['', 'HIGH', 'MEDIUM', 'LOW']

export const LEADERSHIP_ATTENTION = [
  'None',
  'Review Needed',
  'Decision Needed',
]

export const EXEC_INBOX_EMAILS = ['rmarchadesch@harvardae.org', 'rryan@harvardae.org']

export const HEALTH_OPTIONS = [
  { value: 'not-started', label: 'Not Started', className: 'bg-gray-200 text-black' },
  { value: 'ongoing', label: 'Ongoing', className: 'bg-orange-200 text-amber-900' },
  { value: 'needs-attention', label: 'Needs Attention', className: 'bg-yellow-200 text-black' },
  { value: 'time-sensitive', label: 'Time Sensitive', className: 'bg-hae-crimson text-white' },
  { value: 'completed', label: 'Complete', className: 'bg-green-900 text-green-400' },
]

/** Legacy project health values kept for backward-compat with existing data. */
export const HEALTH_ALIASES = {
  'on-track': 'ongoing',
  'at-risk': 'needs-attention',
}

export const EVENT_FORMAT_OPTIONS = ['Online', 'In-Person']

export const EVENT_TYPE_OPTIONS = [
  { value: 'Accelerator', label: 'Accelerator', className: 'bg-purple-200 text-purple-900' },
  { value: 'Live event (in-person)', label: 'Live event (in-person)', className: 'bg-sky-200 text-sky-900' },
  { value: 'Hybrid event (live and online)', label: 'Hybrid event (live and online)', className: 'bg-cyan-200 text-cyan-900' },
  { value: 'Podcast', label: 'Podcast', className: 'bg-green-200 text-green-900' },
  { value: 'Webinar', label: 'Webinar', className: 'bg-amber-200 text-amber-900' },
  { value: 'Info Sessions', label: 'Info Sessions', className: 'bg-rose-100 text-rose-900' },
  { value: 'GAC Meeting', label: 'GAC Meeting', className: 'bg-red-200 text-red-900' },
  { value: 'Global Pitch Event', label: 'Global Pitch Event', className: 'bg-slate-900 text-white' },
  { value: 'In Person luncheon', label: 'In Person luncheon', className: 'bg-stone-500 text-white' },
  { value: 'Announcement', label: 'Announcement', className: 'bg-red-900 text-white' },
  { value: 'Chapter Events', label: 'Chapter Events', className: 'bg-red-600 text-white' },
  { value: 'Include in Enews', label: 'Include in Enews', className: 'bg-yellow-300 text-black' },
  { value: 'Startup Bootcamp', label: 'Startup Bootcamp', className: 'bg-yellow-100 text-black' },
  { value: 'Online Event', label: 'Online Event', className: 'bg-purple-900 text-white' },
  { value: 'Academy', label: 'Academy', className: 'bg-blue-600 text-white' },
  { value: 'Social Media Post', label: 'Social Media Post', className: 'bg-indigo-950 text-white' },
  { value: 'Board', label: 'Board', className: 'bg-blue-800 text-white' },
]

export const GRAPHICS_STATUS_OPTIONS = [
  'Not Started',
  'Ongoing',
  'Ready for posting',
  'For Approval by Regina',
  'Complete',
]

export const MEMBERSHIP_STATUS_OPTIONS = [
  'Non-Member',
  'Full Member',
  'Legacy Member',
  'Lifetime Member',
  'Expired',
]

/**
 * Top-level collections that host projects (via a project's `programId`),
 * used by the "Move / copy project" picker. `customSectionItems` (user-
 * created sections) is handled separately since it's one shared collection
 * spanning many sections, tagged by `sectionId`.
 */
export const PROJECT_DESTINATION_GROUPS = [
  { collectionName: 'programs', label: 'Programs', pathPrefix: '/programs' },
  { collectionName: 'academyPrograms', label: 'Academy', pathPrefix: '/academy' },
  { collectionName: 'customPrograms', label: 'Custom Programs', pathPrefix: '/custom-programs' },
  { collectionName: 'trackerGraphics', label: 'Graphics', pathPrefix: '/graphics' },
  { collectionName: 'trackerData', label: 'Data Projects', pathPrefix: '/data' },
  { collectionName: 'boardCommitments', label: 'Board Commitments', pathPrefix: '/board-commitments' },
  { collectionName: 'chapters', label: 'Chapters', pathPrefix: '/chapters' },
]

export const WHERE_TO_POST_OPTIONS = [
  "Regina's LinkedIn",
  'Instagram',
  'Facebook',
  'HAE Network LinkedIn Group',
  'HAE page',
]
