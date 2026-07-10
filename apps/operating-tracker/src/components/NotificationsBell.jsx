import { Link, useLocation } from 'react-router-dom'
import { FEATURES, NavIcon, useFeatures } from '@hae/ui'

export default function NotificationsBell() {
  const { isEnabled } = useFeatures()
  const location = useLocation()

  if (!isEnabled(FEATURES.NOTIFICATIONS)) return null

  const active = location.pathname === '/notifications'

  return (
    <Link
      to="/notifications"
      className={`hae-platform-header__bell${active ? ' is-current' : ''}`}
      aria-current={active ? 'page' : undefined}
      title="Notifications"
    >
      <NavIcon name="bell" className="[&>svg]:h-5 [&>svg]:w-5" />
    </Link>
  )
}
