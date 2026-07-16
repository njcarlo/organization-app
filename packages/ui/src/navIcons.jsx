/** Simple inline nav icons — no external icon package. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ children, className = 'h-8 w-8' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      {...stroke}
    >
      {children}
    </svg>
  )
}

const ICONS = {
  home: (
    <Svg>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
    </Svg>
  ),
  grid: (
    <Svg>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </Svg>
  ),
  checklist: (
    <Svg>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M4 6.5 5.2 7.7 7.5 5" />
      <path d="M4 12.5 5.2 13.7 7.5 11" />
      <path d="M4 18.5 5.2 19.7 7.5 17" />
    </Svg>
  ),
  bell: (
    <Svg>
      <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Svg>
  ),
  survey: (
    <Svg>
      <path d="M8 4h8a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" />
      <path d="M9 9h6M9 13h6" />
    </Svg>
  ),
  help: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8" />
      <path d="M12 17h.01" />
    </Svg>
  ),
  admin: (
    <Svg>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </Svg>
  ),
  users: (
    <Svg>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 19c1.2-3 3.3-4.5 5.5-4.5S13.3 16 14.5 19" />
      <path d="M14 14.5c1.5-.3 3 .4 4.5 2.5" />
    </Svg>
  ),
  book: (
    <Svg>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 5.5v16" />
    </Svg>
  ),
  calendar: (
    <Svg>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
    </Svg>
  ),
  certificate: (
    <Svg>
      <circle cx="12" cy="10" r="5.5" />
      <path d="M9.5 14.5 8 21l4-2 4 2-1.5-6.5" />
    </Svg>
  ),
  chart: (
    <Svg>
      <path d="M4 19h16" />
      <path d="M7 16V10M12 16V7M17 16v-4" />
    </Svg>
  ),
  message: (
    <Svg>
      <path d="M4 6h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </Svg>
  ),
  pipeline: (
    <Svg>
      <path d="M4 7h6v4H4zM14 7h6v4h-6zM9 13h6v4H9z" />
      <path d="M10 9h4M12 11v2" />
    </Svg>
  ),
  contact: (
    <Svg>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M8.5 16.5c.8-1.5 2-2.2 3.5-2.2s2.7.7 3.5 2.2" />
    </Svg>
  ),
  folder: (
    <Svg>
      <path d="M3.5 8.5V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </Svg>
  ),
  star: (
    <Svg>
      <path d="M12 3.5 14.4 9l5.6.5-4.3 3.7 1.4 5.5L12 15.8 6.9 18.7l1.4-5.5L4 9.5 9.6 9z" />
    </Svg>
  ),
  building: (
    <Svg>
      <path d="M4 21h16M6 21V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V21" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
    </Svg>
  ),
  default: (
    <Svg>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </Svg>
  ),
  kebab: (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden fill="currentColor">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  ),
  plus: (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  history: (
    <Svg>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M4 4v4h4" />
      <path d="M12 8v4l3 2" />
    </Svg>
  ),
  grip: (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  ),
  edit: (
    <Svg>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 7.5l3 3" />
    </Svg>
  ),
}

export function NavIcon({ name, className }) {
  const node = ICONS[name] || ICONS.default
  if (!className) return node
  return (
    <span className={`inline-flex text-current ${className}`}>{node}</span>
  )
}

/** Guess an icon from a route label / path. */
export function iconForNavItem(item = {}) {
  if (item.icon) return item.icon
  const hay = `${item.label || ''} ${item.to || ''}`.toLowerCase()
  if (/dashboard|home|overview|my learning/.test(hay)) return 'home'
  if (/task/.test(hay)) return 'checklist'
  if (/notif/.test(hay)) return 'bell'
  if (/survey/.test(hay)) return 'survey'
  if (/help/.test(hay)) return 'help'
  if (/admin|user|member(?!ship)/.test(hay)) return 'admin'
  if (/course|catalog|author|learn|enroll/.test(hay)) return 'book'
  if (/session|office|event|calendar/.test(hay)) return 'calendar'
  if (/certif/.test(hay)) return 'certificate'
  if (/track|progress|point|badge|pipeline/.test(hay)) return 'chart'
  if (/check-?in/.test(hay)) return 'checklist'
  if (/contact/.test(hay)) return 'contact'
  if (/interact|message/.test(hay)) return 'message'
  if (/program|committee|folder/.test(hay)) return 'folder'
  if (/expert|eir|sme/.test(hay)) return 'star'
  if (/membership|ams|company/.test(hay)) return 'building'
  if (/people|directory/.test(hay)) return 'users'
  return 'grid'
}

export function Chevron({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    >
      <path
        d="M5 3.5 9 7l-4 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
