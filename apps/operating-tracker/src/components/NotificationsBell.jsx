import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { FEATURES, NavIcon, useFeatures } from '@hae/ui'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function NotificationsBell() {
  const { isEnabled } = useFeatures()
  const { user } = useAuth()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  const loadUnread = useCallback(async () => {
    if (!user?.uid) {
      setUnreadCount(0)
      return
    }
    const snap = await getDocs(
      query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('read', '==', false)
      )
    )
    setUnreadCount(snap.size)
  }, [user?.uid])

  useEffect(() => {
    loadUnread()
  }, [loadUnread, location.pathname])

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
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-hae-crimson px-1 text-[10px] font-semibold leading-none text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      ) : null}
    </Link>
  )
}
