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

export const GRAPHICS_STATUS_OPTIONS = [
  'Not Started',
  'Ongoing',
  'Ready for posting',
  'For Approval by Regina',
  'Complete',
]

export const WHERE_TO_POST_OPTIONS = [
  "Regina's LinkedIn",
  'Instagram',
  'Facebook',
  'HAE Network LinkedIn Group',
  'HAE page',
]
