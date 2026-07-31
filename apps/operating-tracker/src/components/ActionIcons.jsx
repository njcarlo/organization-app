/** Small inline action icons (comment / edit / delete / add) for compact buttons. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ children, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      {children}
    </svg>
  )
}

export function CommentIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 6h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </Svg>
  )
}

export function EditIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 7.5l3 3" />
    </Svg>
  )
}

export function TrashIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 7h16" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  )
}

export function PlusIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}
